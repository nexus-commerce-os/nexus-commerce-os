/*
 * THE CATALOGUE, IN A REAL BROWSER, AT EVERY WIDTH.
 *
 * These pages are rendered by the Worker from D1 on each request, so unlike
 * the exported pages there is no build artefact to inspect instead. The only
 * way to know what a visitor sees is to be one.
 *
 * THREE STATES, AND THE SUITE INSISTS THEY LOOK DIFFERENT:
 *
 *   1. products published        — they are listed;
 *   2. a migrated, empty database — an honest "nothing published yet";
 *   3. no schema, or a broken read — a LOUD failure, never an empty shop.
 *
 * The third is the one worth protecting. `wrangler dev --local` hands the
 * Worker a database with no tables, so that is the state these run in by
 * default — and for a moment the Worker was changed to call it empty just to
 * get a green run. That would mean a production database which had lost its
 * schema showed a visitor a tidy "no products yet" page while the real answer
 * was "this is broken". Zero products and a broken read are different facts.
 *
 * WHAT IS ASSERTED, AND WHY IT IS NOT "the page loaded". A 200 proves nothing
 * here: the whole risk is that the page renders something it should not — a
 * fabricated price, a product nobody authorised, or a total assembled from an
 * item price. So the strongest assertions are negative.
 */
import { expect, test, type APIRequestContext } from '@playwright/test';

/** Text that must never appear on a page serving an empty catalogue. */
const FORBIDDEN_WHEN_EMPTY = [
  'coming soon',
  'lorem ipsum',
  'sample product',
  'example product',
  'placeholder',
];

/** Which of the three states this deployment is in, asked once. */
async function catalogueState(
  request: APIRequestContext,
): Promise<'published' | 'empty' | 'unavailable'> {
  const response = await request.get('/api/catalog/summary');
  if (response.status() === 503) return 'unavailable';
  const body = (await response.json()) as { products?: number };
  return (body.products ?? 0) > 0 ? 'published' : 'empty';
}

test.describe('the published catalogue', () => {
  test('A BROKEN DATABASE IS NOT AN EMPTY SHOP', async ({ page, request }) => {
    const state = await catalogueState(request);
    test.skip(state !== 'unavailable', 'this deployment can read its catalogue');

    // The API says so with a status, not with an empty list.
    const api = await request.get('/api/catalog/products');
    expect(api.status(), 'an unreadable catalogue must not answer 200 with []').toBe(503);
    expect(api.headers()['cache-control'] ?? '').toContain('no-store');

    const response = await page.goto('/products');
    expect(response?.status()).toBe(503);
    const body = (await page.locator('body').innerText()).toLowerCase();
    expect(body).toContain('unavailable');
    // And it must NOT claim the catalogue is merely empty.
    expect(body).not.toContain('no products are published yet');
  });

  test('the products page renders and says what it is', async ({ page, request }) => {
    const state = await catalogueState(request);
    test.skip(state === 'unavailable', 'the catalogue is unreadable in this environment');

    const response = await page.goto('/products');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Products', level: 1 })).toBeVisible();
    // The claim the whole site rests on, stated on the page itself.
    await expect(page.getByText(/price here is one a merchant has published/i)).toBeVisible();
  });

  test('AN EMPTY CATALOGUE SAYS SO, and invents nothing', async ({ page, request }) => {
    const state = await catalogueState(request);
    test.skip(state !== 'empty', `this deployment is ${state}`);

    await page.goto('/products');
    // The wording matters: it must say WHY, not imply a catalogue is loading.
    await expect(page.getByText(/no products are published yet/i)).toBeVisible();
    await expect(
      page.getByText(/only lists a product once a merchant has authorised/i),
    ).toBeVisible();

    const body = (await page.locator('body').innerText()).toLowerCase();
    for (const phrase of FORBIDDEN_WHEN_EMPTY) {
      expect(body, `an empty catalogue must not contain "${phrase}"`).not.toContain(phrase);
    }

    /*
     * NO PRICE ANYWHERE. A currency amount on a page with no products would
     * mean something was rendered from nothing, which is the single failure
     * this project exists to avoid.
     */
    expect(body).not.toMatch(/\b(usd|eur|gbp|\$|€|£)\s?\d/i);
  });

  test('the catalogue API answers with a shape, not an error', async ({ request }) => {
    const state = await catalogueState(request);
    test.skip(state === 'unavailable', 'the catalogue is unreadable in this environment');

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

  test('an unknown product is 404, not a different product', async ({ page, request }) => {
    const state = await catalogueState(request);
    test.skip(state === 'unavailable', 'the catalogue is unreadable in this environment');

    const response = await page.goto('/products/no-such-product-at-all');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: /not published/i })).toBeVisible();
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
    const state = await catalogueState(request);
    test.skip(state === 'unavailable', 'the catalogue is unreadable in this environment');

    await page.goto('/products');
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(
      scrollWidth,
      `${testInfo.project.name}: the page is wider than the viewport, so it scrolls sideways`,
    ).toBeLessThanOrEqual(clientWidth);
  });

  test('the security headers survive the new routes', async ({ request }) => {
    const response = await request.get('/products');
    const headers = response.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    // The catalogue pages carry no inline script, so no nonce is granted —
    // but the policy must still be present and must still forbid by default.
    expect(headers['content-security-policy'] ?? '').toContain("default-src 'none'");
  });
});
