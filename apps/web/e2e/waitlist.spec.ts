/**
 * The waitlist, end to end, with one expected outcome per test.
 *
 * WHY THIS FILE EXISTS SEPARATELY. The per-width suite once asserted only that
 * the form produced *some* visible response. That is too weak to be worth
 * much: "something appeared" passes when the wrong thing appears, and the bug
 * this form is haunted by — accepting an address and silently doing nothing —
 * is the only one it would reliably catch.
 *
 * So each test below names the exact outcome it expects.
 *
 * THE RATE LIMIT IS THE REASON THIS IS SERIAL. The Worker allows 5 posts per
 * 60 seconds, and under `wrangler dev` every request shares one bucket because
 * CF-Connecting-IP is absent. That budget is spent deliberately here, in a
 * known order, so the limit can be asserted ON PURPOSE rather than tripped
 * over. Nothing else in the suite submits.
 *
 * Budget, in order: invalid costs 0 (refused in the browser, before any
 * request), then new, duplicate, no-JS new, no-JS duplicate = 4, leaving the
 * 5th and 6th to prove the limit.
 */
import { expect, test, type Page } from '@playwright/test';

// Serial: these share the rate-limit budget and the stored addresses, so the
// order below is part of the contract.
test.describe.configure({ mode: 'serial' });

/** Unique per run, so a "duplicate" is a duplicate of OUR address and nothing else. */
const RUN = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const addr = (tag: string) => `pw-${tag}-${RUN}@example.com`;

const JS_ADDRESS = addr('js');
const NOJS_ADDRESS = addr('nojs');

async function submit(page: Page, email: string): Promise<void> {
  const input = page.locator('input[type="email"][name="email"]').first();
  await expect(input).toBeVisible();
  await input.fill(email);
  await input.press('Enter');
}

/** The page is only interactive once React has attached. */
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const root = document.querySelector('body > div, #__next, main');
      return root ? Object.keys(root).some((k) => k.startsWith('__react')) : false;
    },
    undefined,
    { timeout: 15_000 },
  );
}

test('an invalid address is refused in the browser, before any request', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/api/waitlist')) posts.push(r.method());
  });

  await page.goto('/');
  await waitForHydration(page);
  await submit(page, 'not-an-email');

  await expect(page.locator('.wl-note')).toHaveText(/valid email address/i);
  await expect(page.locator('.wl-ok')).toHaveCount(0);
  // This is what makes it cost no rate-limit budget, and it is a real property
  // worth holding: a typo should not consume a visitor's allowance.
  expect(posts, 'an invalid address must not reach the network').toEqual([]);
});

test('a new address is accepted and confirmed by name', async ({ page }) => {
  await page.goto('/');
  await waitForHydration(page);

  const response = page.waitForResponse(
    (r) => r.url().includes('/api/waitlist') && r.request().method() === 'POST',
  );
  await submit(page, JS_ADDRESS);
  const res = await response;

  expect(res.status(), 'a first-time address must be accepted').toBe(200);
  const body = (await res.json()) as { ok: boolean; status: string };
  expect(body.ok).toBe(true);
  // The store's own vocabulary is 'added' | 'duplicate' (see
  // src/lib/waitlist-contract.ts). Asserting an invented 'new' tested my
  // guess about the contract rather than the contract.
  expect(body.status, 'the first submission is not a duplicate').toBe('added');

  const ok = page.locator('.wl-ok');
  await expect(ok).toBeVisible();
  // The confirmation names the local part back to the visitor, which is the
  // only evidence on screen that the address it kept is the one they typed.
  await expect(ok).toContainText(JS_ADDRESS.split('@')[0]);
});

test('the same address again is reported as already on the list', async ({ page }) => {
  await page.goto('/');
  await waitForHydration(page);

  const response = page.waitForResponse(
    (r) => r.url().includes('/api/waitlist') && r.request().method() === 'POST',
  );
  await submit(page, JS_ADDRESS);
  const res = await response;

  expect(res.status()).toBe(200);
  const body = (await res.json()) as { ok: boolean; status: string; message: string };
  // The STORE is what must not double-write. This is the assertion that
  // actually proves storage behaviour from the outside.
  expect(body.status, 'a repeat address must be recognised as a duplicate').toBe('duplicate');
  expect(body.message).toMatch(/already on the list/i);

  // And the visitor must be told which of the two happened — the page used to
  // render the same "You're on the list" either way, discarding a distinction
  // the Worker had already computed.
  await expect(page.locator('.wl-ok')).toContainText(/already on the list/i);
});

test('a browser with NO JavaScript can still join, and is redirected with the outcome', async ({
  browser,
}) => {
  // Not a simulation: JavaScript is genuinely off, so this exercises the native
  // form post and the Worker's 303 — the path that was broken in production
  // when the CSP stopped React hydrating and signups vanished in silence.
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await submit(page, NOJS_ADDRESS);
    await page.waitForURL(/[?&]joined=/, { timeout: 15_000 });
    expect(new URL(page.url()).searchParams.get('joined')).toBe('ok');
  } finally {
    await context.close();
  }
});

test('without JavaScript, a repeat address says "already" rather than "ok"', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await submit(page, NOJS_ADDRESS);
    await page.waitForURL(/[?&]joined=/, { timeout: 15_000 });
    expect(new URL(page.url()).searchParams.get('joined')).toBe('already');
  } finally {
    await context.close();
  }
});

test('the rate limit refuses the 6th post in a window, and says why', async ({ page }) => {
  /*
   * Four posts have been spent above (new, duplicate, no-JS new, no-JS
   * duplicate). The Worker allows 5 per 60 seconds from one bucket, so the
   * 5th here should be accepted and the 6th refused.
   *
   * Asserted as "refused within a bounded number of attempts" rather than
   * "exactly the 6th", because a window boundary could roll between tests and
   * a test that fails on a clock tick is worse than one that states its bound.
   * What matters is that the limit exists, bites, and explains itself.
   */
  await page.goto('/');
  await waitForHydration(page);

  let refusedAt = 0;
  for (let attempt = 1; attempt <= 6 && refusedAt === 0; attempt += 1) {
    const response = page.waitForResponse(
      (r) => r.url().includes('/api/waitlist') && r.request().method() === 'POST',
    );
    await submit(page, addr(`limit-${attempt}`));
    const res = await response;
    if (res.status() === 429) {
      refusedAt = attempt;
      const body = (await res.json()) as { ok: boolean; error: string };
      expect(body.ok).toBe(false);
      expect(body.error, 'a refusal must explain itself').toMatch(/too many attempts/i);
      expect(res.headers()['retry-after'], 'and must say when to come back').toBe('60');
    }
    await page.reload();
    await waitForHydration(page);
  }

  expect(refusedAt, 'the rate limit never engaged within 6 further posts').toBeGreaterThan(0);
  // The visitor must see the refusal, not a false confirmation.
  await expect(page.locator('.wl-ok')).toHaveCount(0);
});
