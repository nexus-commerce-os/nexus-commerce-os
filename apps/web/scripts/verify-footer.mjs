// Fails if any generated public page is missing the shared footer's legal navigation.
//
// This exists because the defect it guards against was invisible in review: every
// page *had* a <footer>, so nothing looked wrong, but sixteen of them contained a
// copyright line and no links. From a buying guide — the page that will carry
// affiliate links — /disclosure, /privacy, /terms, /cookies and /contact were
// unreachable. A structural check is the only thing that catches "present but
// empty".
//
// Runs against the static export in ./out, so it tests what is actually shipped
// rather than what the source appears to say.

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not URL.pathname: on Windows the latter yields "/C:/a%20b",
// which is neither a valid path nor decoded.
const OUT = fileURLToPath(new URL('../out/', import.meta.url));

/** Must be reachable from every public page. Mirrors REQUIRED_FOOTER_LINKS. */
const REQUIRED = [
  '/disclosure',
  '/privacy',
  '/terms',
  '/cookies',
  '/contact',
  '/about',
  '/how-we-rank',
  '/commission-blind',
];

/** Not public pages: the 404 and the internal, noindexed component gallery. */
const EXEMPT = new Set(['404.html', 'ui.html']);

async function htmlFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '_next') continue;
      found.push(...(await htmlFiles(full)));
    } else if (entry.name.endsWith('.html')) {
      found.push(full);
    }
  }
  return found;
}

const files = (await htmlFiles(OUT)).filter(
  (f) => !EXEMPT.has(relative(OUT, f).replace(/\\/g, '/')),
);

if (files.length === 0) {
  console.error('verify-footer: no HTML found in out/ — run `next build` first.');
  process.exit(1);
}

const failures = [];
for (const file of files) {
  const html = await readFile(file, 'utf8');
  const page =
    '/' +
    relative(OUT, file)
      .replace(/\\/g, '/')
      .replace(/(index)?\.html$/, '');

  if (!/<footer[\s>]/.test(html)) {
    failures.push(`${page}: no <footer> element`);
    continue;
  }
  const missing = REQUIRED.filter((href) => !html.includes(`href="${href}"`));
  if (missing.length > 0) failures.push(`${page}: footer missing links -> ${missing.join(', ')}`);
}

if (failures.length > 0) {
  console.error(`verify-footer: ${failures.length} page(s) failed:\n  ` + failures.join('\n  '));
  process.exit(1);
}

console.log(
  `verify-footer: OK — ${files.length} public pages all expose the ${REQUIRED.length} required links`,
);
