/**
 * How big a catalogue this pipeline can actually ingest, measured.
 *
 * EVERY ROW IS SYNTHETIC AND SAYS SO. Fictional "Northwind Trading" products
 * on example.invalid, generated here. None of it is, or may be presented as, a
 * real commercial product, and nothing measured here says anything about a
 * real merchant's catalogue size.
 *
 * WHAT THIS MEASURES AND WHAT IT DOES NOT. It measures the in-process half of
 * the pipeline: archive expansion, parsing, validation, offer construction and
 * reconciliation, against the in-memory store. That is the part whose cost
 * scales with row count and the part that would blow up memory first.
 *
 * It does NOT measure database write throughput — that needs PostgreSQL, which
 * is why the adapter suite runs in CI rather than here. A number from this
 * script is a parse-and-reconcile number, and calling it an end-to-end number
 * would be a lie by omission.
 *
 *   node scripts/benchmark-ingestion.mjs [rows...]      default: 1000 10000 100000
 */

import { buildFeed, gtin12, product, zipOf } from '../test/fixtures/synthetic-feed.mjs';
import { InMemoryOfferStore, importFeedArchive } from '../dist/index.js';

const sizes = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n) && n > 0);
const ROW_COUNTS = sizes.length > 0 ? sizes : [1000, 10_000, 100_000];

const MB = 1024 * 1024;
const mb = (bytes) => (bytes / MB).toFixed(1);
const ms = (n) => `${n.toFixed(0)} ms`;
const perSec = (rows, millis) => Math.round(rows / (millis / 1000)).toLocaleString('en-US');

/** A synthetic export of `count` rows, stamped so the freshness guard passes. */
function syntheticExport(count, exportedAt, { priceShift = 0, drop = 0, add = 0 } = {}) {
  const stamp = exportedAt.toISOString();
  const rows = [];
  for (let i = drop; i < count + add; i += 1) {
    const cents = 1999 + ((i * 7) % 5000) + priceShift;
    rows.push(
      product({
        id: `NW-${1_000_000 + i}`,
        title: `Northwind Trading Synthetic Item ${i}`,
        gtin: gtin12(String(10_000_000_000 + i).slice(0, 11)),
        mpn: `NWTM-${i}`,
        price: `${(cents / 100).toFixed(2)} USD`,
        salePrice: `${((cents - 300) / 100).toFixed(2)} USD`,
        lastUpdated: stamp,
      }),
    );
  }
  return { text: buildFeed(rows), rows: rows.length };
}

/** Peak RSS seen while `fn` runs, sampled on a timer. */
async function withPeakMemory(fn) {
  let peak = process.memoryUsage().rss;
  const timer = setInterval(() => {
    const rss = process.memoryUsage().rss;
    if (rss > peak) peak = rss;
  }, 10);
  try {
    const started = performance.now();
    const value = await fn();
    return { value, elapsed: performance.now() - started, peak };
  } finally {
    clearInterval(timer);
  }
}

console.log('SYNTHETIC DATA ONLY — fictional products, generated for measurement.\n');
console.log(
  'rows'.padStart(8) +
    'archive'.padStart(11) +
    'first import'.padStart(15) +
    'rows/sec'.padStart(12) +
    're-import'.padStart(12) +
    'peak RSS'.padStart(11) +
    '  outcome',
);
console.log('-'.repeat(84));

const at = new Date();

for (const count of ROW_COUNTS) {
  const first = syntheticExport(count, at);
  const archive = zipOf(first.text);

  const store = new InMemoryOfferStore();
  const run1 = await withPeakMemory(() =>
    importFeedArchive(archive, store, {
      merchantId: 'bench',
      sourceFeed: 'synthetic:bench',
      now: at,
    }),
  );

  // A second export where every price moved, which is the expensive case:
  // every row is a real change, so reconciliation cannot take the cheap path.
  const second = syntheticExport(count, at, { priceShift: 100, drop: 1, add: 1 });
  const run2 = await withPeakMemory(() =>
    importFeedArchive(zipOf(second.text), store, {
      merchantId: 'bench',
      sourceFeed: 'synthetic:bench',
      now: at,
    }),
  );

  const r1 = run1.value.reconciliation;
  const r2 = run2.value.reconciliation;
  const stored = (await store.listOffers('bench')).length;

  console.log(
    String(count).padStart(8) +
      `${mb(archive.length)} MB`.padStart(11) +
      ms(run1.elapsed).padStart(15) +
      perSec(count, run1.elapsed).padStart(12) +
      ms(run2.elapsed).padStart(12) +
      `${mb(Math.max(run1.peak, run2.peak))} MB`.padStart(11) +
      `  ${r1?.added.length ?? 0} created, ${r2?.updated.length ?? 0} updated, ` +
      `${r2?.added.length ?? 0} added, ${r2?.removed.length ?? 0} retired, ${stored} stored`,
  );

  if (run1.value.quarantined > 0 || run2.value.quarantined > 0) {
    console.log(
      `${' '.repeat(8)}  quarantined: ${run1.value.quarantined} + ${run2.value.quarantined}`,
    );
  }
}

console.log(
  '\nParse, validate and reconcile only, against the in-memory store.\n' +
    'Database write throughput is NOT measured here — that needs PostgreSQL,\n' +
    'which is why the adapter suite runs in CI. Treating these as end-to-end\n' +
    'numbers would overstate them.',
);
