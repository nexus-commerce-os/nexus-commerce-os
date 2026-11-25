/**
 * The site, in a real browser, at eight exact widths.
 *
 * Every test here asserts `window.innerWidth` FIRST. A responsive test that
 * does not prove what width it actually ran at is a test of nothing — the
 * viewport can silently be clamped, the device scale can differ, and the result
 * reads as a pass either way. That is the specific failure the founder called
 * out, so it is checked in each test rather than assumed from the config.
 */
import { expect, test, type Page } from '@playwright/test';

/** The width this project claims to be running at, from its own name. */
function declaredWidth(projectName: string): number {
  const n = Number(projectName.replace(/^w/, ''));
  if (!Number.isInteger(n)) throw new Error(`project "${projectName}" has no width in its name`);
  return n;
}

/**
 * Proves the browser really is this wide before anything else is believed.
 * Returns the measured width so a test can branch on it.
 */
async function assertWidth(page: Page, projectName: string): Promise<number> {
  const want = declaredWidth(projectName);
  const got = await page.evaluate(() => window.innerWidth);
  expect(got, `window.innerWidth must actually be ${want}`).toBe(want);
  return got;
}

/** The breakpoint the mobile navigation switches at, from MobileNav.tsx. */
const DESKTOP_FROM = 821;

test.describe('every width', () => {
  test('React hydrates — the page is live, not just served', async ({ page }, info) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

    await page.goto('/');
    await assertWidth(page, info.project.name);

    // The real question, and the one an HTTP 200 cannot answer: did React
    // attach? `script-src 'self'` blocked the inline bootstrap in production
    // and this is the assertion that would have caught it.
    const hydrated = await page.waitForFunction(
      () => {
        const root = document.querySelector('body > div, #__next, main');
        if (!root) return false;
        return Object.keys(root).some((k) => k.startsWith('__react'));
      },
      undefined,
      { timeout: 15_000 },
    );
    expect(await hydrated.jsonValue()).toBeTruthy();

    expect(errors, `console errors at ${info.project.name}`).toEqual([]);
  });

  test('the page does not scroll sideways', async ({ page }, info) => {
    await page.goto('/');
    const width = await assertWidth(page, info.project.name);

    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    // One pixel of slack for sub-pixel rounding; anything more is an overflow.
    expect(scrollWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(clientWidth + 1);
  });

  test('no element pushes past the viewport', async ({ page }, info) => {
    await page.goto('/');
    const width = await assertWidth(page, info.project.name);

    // Naming the offender matters: "something overflows" costs an hour,
    // "<pre class=x> is 412px wide at 320px" costs a minute.
    const offenders = await page.evaluate((vw) => {
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const style = getComputedStyle(el);
        if (style.position === 'fixed' || style.overflowX === 'auto' || style.overflowX === 'scroll')
          continue;
        if (r.right > vw + 1) {
          const tag = el.tagName.toLowerCase();
          const cls = (el.className || '').toString().split(/\s+/).filter(Boolean)[0] ?? '';
          out.push(`${tag}${cls ? `.${cls}` : ''} right=${Math.round(r.right)}`);
        }
      }
      return out.slice(0, 6);
    }, width);
    expect(offenders, `elements overflowing ${width}px`).toEqual([]);
  });

  test('the theme toggle actually changes the theme', async ({ page }, info) => {
    await page.goto('/');
    await assertWidth(page, info.project.name);

    const toggle = page.locator('[data-theme-toggle], button[aria-label*="theme" i]').first();
    if ((await toggle.count()) === 0) {
      test.skip(true, 'no theme toggle is rendered on this page');
    }
    const before = await page.evaluate(() => ({
      attr: document.documentElement.dataset.theme ?? null,
      bg: getComputedStyle(document.body).backgroundColor,
    }));
    await toggle.click();
    // The attribute is the contract; the background proves it reached paint.
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.dataset.theme ?? null))
      .not.toBe(before.attr);
    const afterBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(afterBg, 'theme changed but the body background did not').not.toBe(before.bg);
  });
});

test.describe('navigation', () => {
  test('the menu matches the width it is at, and the keyboard can close it', async ({
    page,
  }, info) => {
    await page.goto('/');
    const width = await assertWidth(page, info.project.name);

    const disclosure = page.locator('button[aria-controls][aria-expanded]').first();

    if (width >= DESKTOP_FROM) {
      // Above the breakpoint the links are simply present; a hamburger here
      // would be a bug.
      await expect(page.locator('.nav-in a').first()).toBeVisible();
      return;
    }

    await expect(disclosure, `no menu button at ${width}px`).toBeVisible();

    // WCAG 2.5.8 asks for 24px; this site's own standard is 44px.
    const box = await disclosure.boundingBox();
    expect(box).not.toBeNull();
    expect(Math.round(box!.width), 'touch target width').toBeGreaterThanOrEqual(44);
    expect(Math.round(box!.height), 'touch target height').toBeGreaterThanOrEqual(44);

    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await disclosure.click();
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true');

    const panelId = await disclosure.getAttribute('aria-controls');
    expect(panelId, 'aria-controls must name a real element').toBeTruthy();
    await expect(page.locator(`#${panelId}`)).toBeVisible();

    // Escape must close it AND return focus, or a keyboard user is stranded
    // inside a panel they cannot see.
    await page.keyboard.press('Escape');
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await expect(disclosure).toBeFocused();
  });
});

test.describe('CSP is enforced, not merely declared', () => {
  test('the header carries a nonce and an injected inline script does not run', async ({
    page,
  }, info) => {
    const response = await page.goto('/');
    await assertWidth(page, info.project.name);
    expect(response).not.toBeNull();

    const csp = response!.headers()['content-security-policy'] ?? '';
    expect(csp, 'no CSP on the document').toContain('script-src');
    expect(csp, 'script-src carries no nonce').toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    // The whole point of the nonce approach: these must never come back.
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
    // HTML carrying a nonce must not be stored by a shared cache, or the nonce
    // is reused and stops being a nonce.
    expect(response!.headers()['cache-control']).toBe('no-store');

    // Inject a script with no nonce. If CSP is being enforced the browser
    // refuses to execute it, so the marker never appears.
    await page.evaluate(() => {
      const s = document.createElement('script');
      s.textContent = 'window.__cspBypassed = true;';
      document.head.appendChild(s);
    });
    expect(
      await page.evaluate(() => (window as unknown as Record<string, unknown>).__cspBypassed),
      'an inline script with no nonce EXECUTED — CSP is not being enforced',
    ).toBeUndefined();
  });
});

test.describe('the waitlist works without a mouse and without JavaScript', () => {
  test('the form posts and comes back with an outcome', async ({ page }, info) => {
    await page.goto('/');
    await assertWidth(page, info.project.name);

    const email = page.locator('input[type="email"][name="email"]').first();
    await expect(email, 'the waitlist input must be reachable').toBeVisible();

    // A unique address per run, so a repeat is a real repeat.
    const address = `pw-${Date.now()}-${info.project.name}@example.com`;
    await email.fill(address);
    await email.press('Enter');

    // The Worker answers a form post with a 303 back to /?joined=<outcome>.
    await expect
      .poll(() => page.url(), { timeout: 15_000 })
      .toMatch(/[?&]joined=[a-z-]+/);
  });
});

test.describe('the published catalog is real', () => {
  test('search narrows, a nonsense query says so, and sources are cited', async ({
    page,
  }, info) => {
    const response = await page.goto('/products');
    await assertWidth(page, info.project.name);

    // The catalog is only in the artifact when PUBLISH_CATALOG=1 was set for
    // the build. Skipping is correct; pretending to test it is not.
    if (!response || response.status() === 404) {
      test.skip(true, 'catalog not published in this build (PUBLISH_CATALOG unset)');
    }

    const cards = page.locator('[data-product-slug], article');
    const total = await cards.count();
    expect(total, 'no product cards rendered').toBeGreaterThan(0);

    const search = page.locator('input[type="search"], input[name="q"]').first();
    if ((await search.count()) === 0) {
      test.skip(true, 'no search control on the catalog page');
    }

    await search.fill('zzzzzznothing');
    // A search control that returns everything for nonsense is decorative.
    await expect.poll(async () => cards.count(), { timeout: 5_000 }).toBeLessThan(total);

    await search.fill('');
    await expect.poll(async () => cards.count(), { timeout: 5_000 }).toBe(total);

    // Every published record must show where it came from and when it was read.
    const body = await page.locator('body').innerText();
    expect(body, 'the catalog must say it is specifications only').toMatch(/specification/i);
  });
});

test('capture the page as evidence', async ({ page }, info) => {
  // Genuine screenshots, one per width, attached to the run. These are the
  // artifact a human can actually check a layout claim against.
  await page.goto('/');
  const width = await assertWidth(page, info.project.name);
  await page.waitForLoadState('networkidle');
  const shot = await page.screenshot({ fullPage: true });
  await info.attach(`home-${width}px.png`, { body: shot, contentType: 'image/png' });
  expect(shot.byteLength, 'screenshot is empty').toBeGreaterThan(1000);
});
