#!/usr/bin/env node
/**
 * Writes the demonstration feed. Explicitly synthetic — see fixtures/README.md.
 *
 *   node scripts/make-fixture.mjs <out.zip> [rows] [--price-shift N] [--add N]
 */
import { writeFile } from 'node:fs/promises';
import { buildFeed, gtin12, product, zipOf } from '../test/fixtures/synthetic-feed.mjs';

const [out, rowsArg] = process.argv.slice(2);
if (!out) {
  console.error('usage: node scripts/make-fixture.mjs <out.zip> [rows]');
  process.exit(2);
}
const count = Number(rowsArg ?? 12);
const shiftIdx = process.argv.indexOf('--price-shift');
const shift = shiftIdx >= 0 ? Number(process.argv[shiftIdx + 1]) : 0;
const addIdx = process.argv.indexOf('--add');
const add = addIdx >= 0 ? Number(process.argv[addIdx + 1]) : 0;

const stamp = new Date().toISOString();
const rows = Array.from({ length: count + add }, (_, i) => {
  const cents = 1999 + ((i * 37) % 4000) + shift;
  return product({
    id: `NW-${2000 + i}`,
    title: `Northwind Trading Demo Item ${i}`,
    gtin: gtin12(String(20000000000 + i).slice(0, 11)),
    mpn: `NWD-${i}`,
    price: `${(cents / 100).toFixed(2)} USD`,
    salePrice: `${((cents - 200) / 100).toFixed(2)} USD`,
    lastUpdated: stamp,
  });
});

await writeFile(out, zipOf(buildFeed(rows)));
console.log(`wrote ${out}: ${rows.length} SYNTHETIC rows, exported ${stamp}`);
