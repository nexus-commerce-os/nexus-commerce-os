/**
 * The mobile menu is the only header navigation below 820px, and it is wired
 * up in two places that have no compile-time link to each other: a component
 * mounted in `layout.tsx`, and the rules in the shared stylesheet. Remove
 * either and the header silently goes back to having no navigation on a phone
 * — which is exactly the state this replaced, and it is invisible on a
 * desktop, where everything about the header still looks right.
 *
 * Behaviour (opening, Escape, focus return, 44px targets) is verified in a
 * real browser; what these assertions protect is the wiring, which is what
 * would actually get deleted by accident.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (...parts) => readFileSync(join(webRoot, ...parts), 'utf8');

const layout = read('src', 'app', 'layout.tsx');
const component = read('src', 'components', 'MobileNav.tsx');
const styles = read('..', '..', 'packages', 'ui', 'styles.css');

test('the layout mounts the mobile navigation on every page', () => {
  assert.match(layout, /<MobileNav\s*\/>/, 'MobileNav must be rendered');
  assert.match(layout, /import \{ MobileNav \}/, 'and imported');
});

test('the menu button is a real button with the disclosure attributes', () => {
  assert.match(component, /createElement\('button'\)/);
  assert.match(component, /button\.type = 'button'/, 'not a submit button inside a form');
  assert.match(component, /aria-expanded/);
  assert.match(component, /aria-controls/);
});

test('Escape closes the menu and returns focus to the button', () => {
  assert.match(component, /event\.key !== 'Escape'/);
  assert.match(component, /button\.focus\(\)/, 'focus must come back, or it is lost in the page');
});

test('following a link closes the menu', () => {
  assert.match(component, /links\.addEventListener\('click'/);
});

test('the stylesheet shows the button only where the links are hidden', () => {
  // The breakpoint must match: a button that appears at a width where the
  // links are still shown gives two navigations, and a gap between the two
  // numbers gives none.
  const breakpoint = styles.match(/@media \(max-width: 820px\) \{[\s\S]*?\n\}/);
  assert.ok(breakpoint, 'the 820px breakpoint block must exist');
  assert.match(breakpoint[0], /\.nav-links \{\s*display: none;/);
  assert.match(breakpoint[0], /\.nav-toggle \{\s*display: inline-flex;/);
  assert.match(breakpoint[0], /\.nav-open \.nav-links \{[\s\S]*?display: flex;/);
});

test('the button is hidden by default, so desktop is unaffected', () => {
  assert.match(styles, /\.nav-toggle \{\s*display: none;/);
});

test('the open panel keeps 44px touch targets', () => {
  assert.match(styles, /\.nav-open \.nav-links a \{[\s\S]*?min-height: 44px;/);
  assert.match(styles, /\.nav-toggle \{[\s\S]*?height: 44px;/);
  // `flex: none`, or the flex row shrinks the button below the target size.
  assert.match(styles, /\.nav-toggle \{[\s\S]*?flex: none;/);
});

test('the panel is opaque, so page text cannot show through it', () => {
  // --card is the opaque surface. The header itself is a translucent --paper
  // blur, and a menu panel that inherited that would be unreadable over body
  // text on a phone.
  assert.match(
    styles,
    /\.nav-open \.nav-links \{[\s\S]*?background: var\(--card\);/,
    'the open panel must use the opaque --card surface',
  );
});
