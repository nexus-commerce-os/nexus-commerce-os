/**
 * Real browsers at the exact widths that were only ever asserted from source.
 *
 * WHY THIS EXISTS. Every responsive claim about this site so far came from
 * reading CSS or from a preview pane that cannot emulate below about 412px.
 * That is not measurement. `script-src 'self'` blocked Next's inline bootstrap
 * and React never hydrated on the live site for as long as the policy had been
 * in place, and no check noticed, because every check inspected the artifact
 * rather than running it. An HTTP 200 is not evidence that a page works.
 *
 * WHY `wrangler dev` AND NOT A STATIC SERVER. A static server over `out/` would
 * serve the HTML without the Worker, and the Worker is what mints the CSP
 * nonce, rewrites the policy and handles the waitlist. Testing the assets alone
 * would pass while the thing that broke hydration in production went
 * unexercised. `wrangler dev` runs the real Worker in front of the real assets.
 *
 * The `[build]` hook in wrangler.toml runs on `dev` too, but WRANGLER_COMMAND
 * is then "dev", so the provenance gate reports "not a deploy" and steps aside.
 * The legal release gate still runs, which is correct.
 *
 * 320 is the narrowest width worth supporting (iPhone SE / small Android);
 * 1920 is a desktop monitor. 412 is the common Android logical width and is
 * included because it is the point the in-app preview pane could not go below,
 * so it is the width whose claims were least verified.
 */
import { defineConfig, devices } from '@playwright/test';

/** The widths the founder asked for, exactly. */
const WIDTHS = [320, 375, 390, 412, 768, 1024, 1440, 1920] as const;

/** Tall enough that full-page screenshots are meaningful, short enough to scroll. */
const heightFor = (width: number) => (width < 768 ? 844 : width < 1440 ? 900 : 1080);

const PORT = Number(process.env.PW_PORT ?? 8788);

export default defineConfig({
  testDir: './e2e',
  // A failing responsive assertion is almost never a race; retrying hides a
  // real layout bug behind a second attempt. One retry in CI only, for genuine
  // infrastructure flakes.
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  // Deterministic ordering matters more than speed here: the screenshots are
  // the deliverable and they should come out in a stable order.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // Screenshots and traces only for failures, except where a test asks for
    // one explicitly as evidence.
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  // One project per width, so a failure names the width it failed at.
  projects: WIDTHS.map((width) => ({
    name: `w${width}`,
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width, height: heightFor(width) },
      // Below the tablet breakpoint, behave like a touch device: layout that
      // only works with a mouse is a bug at 320px.
      hasTouch: width < 768,
      isMobile: false,
    },
  })),
  webServer: {
    // `--local` keeps KV in a local simulation: no production namespace is
    // touched and no credential is needed.
    command: `npx wrangler dev --port ${PORT} --ip 127.0.0.1 --local`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
