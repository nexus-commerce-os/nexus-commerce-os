// Keeps the product catalog out of the deployed artifact until the founder
// decides to publish it.
//
// WHY THIS EXISTS. The catalog shipped `noindex` and absent from the sitemap,
// with nothing on the site linking to it. That is an instruction to search
// engines, not an access control: `/products` and all ten product pages
// answered 200 to anyone who typed the URL. `verify-catalog.mjs` already says
// the catalog "stays out of the index until the founder decides otherwise" --
// this makes that true of the artifact rather than only of the robots meta.
//
// The pages themselves are honest and finished for what they claim to be:
// specifications read off each manufacturer's own page, with the source URL
// and the date, no price, no merchant, no buy link, no ordering. What is not
// finished is the product AROUND them -- there is no price verification, no
// merchant relationship and no ranking -- so publishing them would invite a
// visitor to expect a comparison site and find a spec sheet.
//
// TO PUBLISH THEM, set one environment variable:
//
//     PUBLISH_CATALOG=1 pnpm --filter @nexus/web build
//
// Nothing else changes: the pages are still built, still checked by
// `verify-catalog`, and still carry their own `noindex` until that is removed
// deliberately. This script only decides whether they reach `out/`.

import { rm, access, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../out/', import.meta.url));
const INDEX = OUT + 'products.html';
const DIR = OUT + 'products';

const publish = process.env.PUBLISH_CATALOG === '1';

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

if (publish) {
  // Fail loudly rather than publishing an empty section: if someone sets the
  // flag and the pages are missing, that is a broken build, not a quiet no-op.
  const missing = [];
  if (!(await exists(INDEX))) missing.push('out/products.html');
  if (!(await exists(DIR))) missing.push('out/products/');
  if (missing.length > 0) {
    console.error(`gate-catalog: PUBLISH_CATALOG=1 but ${missing.join(' and ')} not built.`);
    process.exit(1);
  }
  const pages = (await readdir(DIR)).filter((f) => f.endsWith('.html')).length;
  console.log(`gate-catalog: PUBLISHING the catalog — index + ${pages} product pages.`);
  process.exit(0);
}

const removed = [];
if (await exists(INDEX)) {
  await rm(INDEX);
  removed.push('products.html');
}
if (await exists(DIR)) {
  const pages = (await readdir(DIR)).filter((f) => f.endsWith('.html')).length;
  await rm(DIR, { recursive: true });
  removed.push(`products/ (${pages} pages)`);
}

// Assert the result rather than trusting the delete, because the whole point
// is that these URLs must not answer.
for (const [label, path] of [
  ['out/products.html', INDEX],
  ['out/products/', DIR],
]) {
  if (await exists(path)) {
    console.error(`gate-catalog: ${label} is still present after removal — refusing to ship.`);
    process.exit(1);
  }
}

console.log(
  removed.length > 0
    ? `gate-catalog: catalog withheld from the artifact — removed ${removed.join(', ')}. ` +
        `Set PUBLISH_CATALOG=1 to ship it.`
    : 'gate-catalog: no catalog pages in out/ — nothing to withhold.',
);
