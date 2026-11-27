/*
 * THE CATALOGUE, IN A REAL BROWSER, AT EVERY WIDTH.
 *
 * The D1-backed pages are rendered by the Worker on each request, so unlike
 * the exported pages there is no build artefact to inspect instead. The only
 * way to know what a visitor sees is to be one.
 *
 * WHAT THIS FILE ASSERTS, AND WHAT IT DELIBERATELY DOES NOT.
 *
 * Which of /products' three sources answers — the D1 catalogue, the exported
 * catalogue, or the honest empty state — depends on the deployment, and a
 * browser cannot reliably tell the second from the first. So the branch
 * selection is asserted in `test/catalog-worker.test.mjs`, against a real SQL
 * engine and a stub asset service, where all five combinations can be set up
 * exactly.
 *
 * What is asserted HERE is what must hold however the page was produced, and
 * the strongest of those are negative, because the risk is not a blank page:
 * it is a page that renders something it should not — a fabricated price, a
 * product nobody authorised, a "coming soon" that implies a catalogue exists.
 *
 * THE ONE CONTRADICTION WORTH NAMING. A page must never show product cards
 * and ALSO say nothing is published, and never claim a catalogue is merely
 * empty when the read that produced it failed. A broken database and an empty
 * one are different facts; the API is where that difference is stated, and it
 * is checked below.
 */
import { expect, test, type APIRequestContext } from '@playwright/test';

/** Text that must never appear on a catalogue page, in any state. */
const FORBIDDEN = ['coming soon', 'lorem ipsum', 'sample product', 'example product'];

/** What the catalogue API says about itself, asked once per test. */
async function apiState(request: APIRequestContext): Promise<'published' | 'empty' | 'unreadable'> {
  const response = await request.get('/api/catalog/summary');
  if (response.status() === 503) return 'unreadable';
  const body = (await response.json()) as { products?: number };
  return (body.products ?? 0) > 0 ? 'published' : 'empty';
}

test.describe('the published catalogue', () => {
  test('A FAILED READ IS STATED BY THE API, NEVER AS AN EMPTY LIST', async ({ request }) => {
    const state = await apiState(request);
    test.skip(state !== 'unreadable', 'catalogue state: this deployment can read its catalogue');

    const listed = await request.get('/api/catalog/products');
    expect(listed.status(), 'an unreadable catalogue must not answer 200 with []').toBe(503);
    expect(listed.headers()['cache-control'] ?? '').toContain('no-store');
    const body = (await listed.json()) as Record<string, unknown>;
    expect(body.items, 'a machine consumer must not be handed an empty list').toBeUndefined();
  });

  test('A FAILED READ DOES NOT TAKE DOWN A CATALOGUE THAT WORKS', async ({ page, request }) => {
    const state = await apiState(request);
    test.skip(state !== 'unreadable', 'catalogue state: this deployment can read its catalogue');

    /*
     * The exported catalogue — the records that passed the source-terms audit
     * — is a real published catalogue sitting one layer below these routes.
     * Answering 503 over the top of it would be an outage this site did not
     * have to have, so the Worker steps aside instead. The failure is still
     * loud: it is logged, and the API above says 503.
     *
     * If the deployment has no exported catalogue either, the 503 stands —
     * and that is the case the rule is really about.
     */
    const response = await page.goto('/products');
    const status = response?.status();
    expect([200, 503], `unexpected status ${status} for /products`).toContain(status);

    const body = (await page.locator('body').innerText()).toLowerCase();
    if (status === 503) {
      expect(body).toContain('could not be read');
      expect(body, 'a broken read must never render as an empty shop').not.toContain(
        'no products are published yet',
      );
    } else {
      // A served page must be a real catalogue, not a consolation prize.
      expect(
        await page.locator('[data-product-slug], article').count(),
        'a 200 here must mean real products were served',
      ).toBeGreaterThan(0);
      expect(body).not.toContain('no products are published yet');
    }
  });

  test('the products page renders and says what it is', async ({ page, request }) => {
    const state = await apiState(request);
    const response = await page.goto('/products');
    const status = response?.status();
    test.skip(
      state === 'unreadable' && status === 503,
      'catalogue state: neither a readable database nor an exported catalogue',
    );

    expect(status).toBe(200);
    await expect(page.getByRole('heading', { name: /products/i, level: 1 }).first()).toBeVisible();

    // Whichever source answered, the page must say what kind of claim it makes.
    const body = (await page.locator('body').innerText()).toLowerCase();
    const statesItsBasis =
      /price here is one a merchant has published/.test(body) ||
      /specification/.test(body) ||
      /no products are published yet/.test(body);
    expect(statesItsBasis, 'the page must state what its records are').toBe(true);
  });

  test('NOTHING IS INVENTED, whatever produced the page', async ({ page, request }) => {
    const state = await apiState(request);
    const response = await page.goto('/products');
    test.skip(response?.status() === 503, 'catalogue state: unavailable in this environment');

    const cards = await page.locator('[data-product-slug], article').count();
    const body = (await page.locator('body').innerText()).toLowerCase();

    for (const phrase of FORBIDDEN) {
      expect(body, `a catalogue page must not contain "${phrase}"`).not.toContain(phrase);
    }

    // The contradiction: cards on the page and "nothing published" in the text.
    if (cards > 0) {
      expect(body).not.toContain('no products are published yet');
    } else {
      expect(body, 'a page with no products must say so plainly').toContain(
        'no products are published yet',
      );
      /*
       * NO PRICE ANYWHERE. A currency amount on a page with no products would
       * mean something was rendered from nothing, which is the single failure
       * this project exists to avoid.
       */
      expect(body).not.toMatch(/\b(usd|eur|gbp|\$|€|£)\s?\d/i);
    }

    if (state === 'empty' && cards > 0) {
      // The exported catalogue answered. It is specifications only, so a
      // currency amount on it would be a published price nobody authorised.
      expect(body, 'a specification-only catalogue must state no price').not.toMatch(/[$£€]\s?\d/);
    }
  });

  test('the catalogue API answers with a shape, not an error', async ({ request }) => {
    const state = await apiState(request);
    test.skip(state === 'unreadable', 'catalogue state: unreadable in this environment');

    const summary = await request.get('/api/catalog/summary');
    expect(summary.status()).toBe(200);
    const body = (await summary.json()) as Record<string, unknown>;

    // Present even when empty — a missing key and a zero are different facts.
    for (const key of ['generation', 'products', 'categories', 'brands']) {
      expect(body, `summary should carry ${key}`).toHaveProperty(key);
    }
    expect(typeof body.products).toBe('number');

    const listed = await request.get('/api/catalog/products?limit=5');
    expect(listed.status()).toBe(200);
    const page = (await listed.json()) as { items: unknown[]; total: number };
    expect(Array.isArray(page.items)).toBe(true);
    expect(typeof page.total).toBe('number');
  });

  test('AN UNKNOWN PRODUCT IS NEVER ANOTHER PRODUCT', async ({ page, request }) => {
    const state = await apiState(request);
    const response = await page.goto('/products/no-such-product-at-all');
    const status = response?.status();

    /*
     * 404 when the catalogue is readable: the slug is genuinely not published.
     *
     * 503 when it is NOT readable, and that is the honest answer rather than a
     * missing case — with the read broken, nothing here knows whether that
     * slug is published or not, and a 404 would be a claim it cannot support.
     * The list page can still fall through to the exported catalogue because
     * the exported page is itself a real published catalogue; an exported 404
     * is not an answer, so there is nothing to fall through TO.
     */
    expect(status, 'an unknown slug must never be 200').not.toBe(200);
    expect(
      state === 'unreadable' ? [404, 503] : [404],
      `unexpected status ${status} for an unknown slug`,
    ).toContain(status);

    // Whichever answered, it must not have reached for a product to show.
    expect(await page.locator('[data-product-slug]').count()).toBe(0);
  });

  test('THE EXISTING SITE STILL WORKS', async ({ page }) => {
    // The catalogue routes were added in front of the asset service, so the
    // thing most worth checking is that everything else still falls through.
    for (const path of ['/', '/how-we-rank', '/privacy', '/terms', '/contact']) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should still be served`).toBe(200);
    }
  });

  test('the catalogue page carries no horizontal overflow', async ({ page, request }, testInfo) => {
    const state = await apiState(request);
    const response = await page.goto('/products');
    test.skip(
      state === 'unreadable' && response?.status() === 503,
      'catalogue state: unavailable in this environment',
    );

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(
      scrollWidth,
      `${testInfo.project.name}: the page is wider than the viewport, so it scrolls sideways`,
    ).toBeLessThanOrEqual(clientWidth + 1);
  });

  test('the security headers survive the new routes', async ({ request }) => {
    const response = await request.get('/products');
    const headers = response.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');

    /*
     * The policy differs by which source answered — the Worker's own pages
     * carry no inline script and so declare `default-src 'none'`, while the
     * exported pages need `'self'` and a nonce for Next's bootstrap — so what
     * is asserted is the part that must hold either way. An earlier version
     * demanded `default-src 'none'` and failed the moment /products was served
     * from the exported catalogue, which is a test tracking one implementation
     * rather than the guarantee.
     */
    const csp = headers['content-security-policy'] ?? '';
    expect(csp, 'a catalogue page must carry a policy at all').not.toBe('');
    expect(csp).toMatch(/default-src '(none|self)'/);
    for (const directive of ["object-src 'none'", "base-uri 'none'", "frame-ancestors 'none'"]) {
      expect(csp, `the policy must keep ${directive}`).toContain(directive);
    }
    // The two that would make a nonce pointless.
    expect(csp, 'script-src must not be weakened').not.toMatch(
      /script-src[^;]*'unsafe-(inline|eval)'/,
    );
  });
});
