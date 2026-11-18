/*
 * Regression guard for the mobile hero.
 *
 * WHAT WENT WRONG. `.hero h1 em` carried an unconditional `white-space: nowrap`.
 * On a phone the h1's clamp() bottoms out at 2.5rem, so the emphasised phrase
 * measured ~423px against a 342px content box — and, being unbreakable, it set
 * the grid item's min-content width. A grid item defaults to `min-width: auto`
 * and so refused to shrink, pushing the whole column 57px past the viewport.
 * `.hero` sets `overflow-x: hidden`, so the excess was CLIPPED rather than
 * scrollable: the headline read "We only make mon…" and there was no scrollbar
 * to hint that anything was missing.
 *
 * Measured at 390x844 DPR 2: 25 elements overflowed, all of them clipped.
 *
 * WHY A STYLESHEET TEST. The real assertion is "nothing overflows at 320-430px",
 * which needs a browser and a layout engine; this suite is plain `node --test`.
 * So these check the two properties the browser result depended on. They are a
 * tripwire, not a substitute for the viewport matrix — if either disappears,
 * the clipping comes straight back, silently, which is what made this expensive
 * to find the first time.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const CSS = readFileSync(new URL('../../../packages/ui/styles.css', import.meta.url), 'utf8');

/** Strip comments so prose about a property is never mistaken for the property. */
const code = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

/** The body of the first rule whose selector matches, comments removed. */
function ruleBody(selector) {
  const i = code.indexOf(selector);
  if (i === -1) return null;
  const open = code.indexOf('{', i);
  const close = code.indexOf('}', open);
  if (open === -1 || close === -1) return null;
  return code.slice(open + 1, close);
}

test('hero grid items may shrink below their min-content width', () => {
  const body = ruleBody('.hero-grid > *');
  assert.ok(body, '.hero-grid > * rule is missing — grid items default to min-width:auto');
  assert.match(
    body,
    /min-width:\s*0/,
    'min-width:0 is what allows a long unbreakable phrase to be wrapped by the ' +
      'track instead of overflowing it',
  );
});

test('the emphasised headline phrase is allowed to wrap on small screens', () => {
  assert.match(
    code,
    /\.hero h1 em\s*\{[^}]*white-space:\s*nowrap/,
    'expected the desktop nowrap to still be present — if it has gone entirely ' +
      'this test should be rewritten, not deleted',
  );

  // Somewhere after it, a max-width media query must release it again.
  const after = code.slice(code.indexOf('.hero h1 em'));
  const released =
    /@media\s*\(max-width:\s*(\d+)px\)\s*\{\s*\.hero h1 em\s*\{[^}]*white-space:\s*normal/.exec(
      after,
    );
  assert.ok(
    released,
    'white-space:nowrap on .hero h1 em must be released at small widths, or the ' +
      'phrase becomes unbreakable and the hero clips again',
  );

  // The release has to happen before the phrase stops fitting. At the clamp
  // floor the phrase needs roughly 470px of viewport; anything at or below
  // that is already too late.
  const px = Number(released[1]);
  assert.ok(
    px >= 560,
    `the nowrap is only released below ${px}px, which is too late — it must be ` +
      'released while the phrase still fits, not after it has already overflowed',
  );
});

test('the hero still hides its decorative overflow', () => {
  // `.hero` clips on purpose: the ::after glow is deliberately oversized and
  // positioned outside the section. That is fine — what is not fine is layout
  // depending on it. This asserts the intent is still declared, so a future
  // reader does not "fix" the clipping by removing the thing that frames the art.
  const body = ruleBody('.hero {');
  assert.ok(body, '.hero rule is missing');
  assert.match(body, /overflow-x:\s*hidden|overflow:\s*hidden/);
});
