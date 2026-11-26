/*
 * THE CATALOGUE, IN A REAL BROWSER, AT EVERY WIDTH.
 *
 * These pages are rendered by the Worker from D1 on each request, so unlike
 * the exported pages there is no build artefact to inspect instead. The only
 * way to know what a visitor sees is to be one.
 *
 * WHAT IS ASSERTED, AND WHY IT IS NOT "the page loaded". A 200 proves nothing
 * here: the whole risk is that the page renders something it should not — a
 * fabricated price, a product nobody authorised, or a total assembled from an
 * item price. So the assertions are about CONTENT, and the strongest ones are
 * negative.
 */
import { expect, test } from '@playwright/test';

/** Text that must never appear on a page serving an empty catalogue. */
const FORBIDDEN_WHEN_EMPTY = [
  'Coming soon',
  'Lorem ipsum',
  'Sample product',
  'Example product',
  'Placeholder',
];

test.describe('the published catalogue', () => {
  test('the products page renders and says what it is', async ({ page }) => {
    const response = await page.goto('/products');
    expect(response?.status()).toBe(200);

    await expect(page.getByRole('heading', { name: 'Products', level: 1 })).toBeVisible();
    // The claim the whole site rests on, stated on the page itself.
    await expect(page.getByText(/price here is one a merchant has published/i)).toBeVisible();
  });

  test('AN EMPTY CATALOGUE SAYS SO, and invents nothing', async ({ page }) => {
    await page.goto('/products');

    const body = (await page.locator('body').innerText()).toLowerCase();
    const hasProducts = !body.includes('no products are published yet');

    test.skip(
      hasProducts,
      'this deployment has published products; the empty-state test does not apply',
    );

    // The wording matters: it must say WHY, not imply a catalogue is loading.
    await expect(page.getByText(/no products are published yet/i)).toBeVisible();
    await expect(
      page.getByText(/only lists a product once a merchant has authorised/i),
    ).toBeVisible();

    for (const phrase of FORBIDDEN_WHEN_EMPTY) {
      expect(body, `an empty catalogue must not contain "${phrase}"`).not.toContain(
        phrase.toLowerCase(),
      );
    }

    /*
     * NO PRICE ANYWHERE. A currency amount on a page with no products would
     * mean something was rendered from nothing, which is the single failure
     * this project exists to avoid.
     */
    expect(body).not.toMatch(/\b(usd|eur|gbp|\$|€|£)\s?\d/i);
  });

  test('the catalogue API answers with a shape, not an error', async ({ request }) => {
    const summary = await request.get('/api/catalog/summary');
    expect(summary.status()).toBe(200);
    const body = (await summary.json()) as Record<string, unknown>;

    // Present even when empty — a missing key and a zero are different facts.
    for (const key of ['generation', 'products', 'categories', 'brands']) {
      expect(body, `summary should carry ${key}`).toHaveProperty(key);
    }
    expect(typeof body.products).toBe('number');
  });

  test('a product listing is a page object, even with nothing in it', async ({ request }) => {
    const listed = await request.get('/api/catalog/products?limit=5');
    expect(listed.status()).toBe(200);
    const body = (await listed.json()) as { items: unknown[]; total: number; limit: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe('number');
  });

  test('an unknown product is 404, not a different product', async ({ page }) => {
    const response = await page.goto('/products/no-such-product-at-all');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: /not published/i })).toBeVisible();
  });

  test('THE WAITLIST AND THE LEGAL PAGES STILL WORK', async ({ page }) => {
    // The catalogue routes were added in front of the asset service, so the
    // thing most worth checking is that everything else still falls through.
    for (const path of ['/', '/how-we-rank', '/privacy', '/terms', '/contact']) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should still be served`).toBe(200);
    }
  });

  test('the catalogue page carries no horizontal overflow', async ({ page }, testInfo) => {
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
    // Readable by a cache for a minute, which is what makes "no redeploy"
    // true without turning every view into a database read.
    expect(headers['cache-control'] ?? '').toMatch(/s-maxage=\d+/);
  });
});
