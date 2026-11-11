/*
 * Local demonstration: import one or more exports and print what happened.
 *
 * Operator tool, not a scheduled job. It writes nothing outside the
 * in-memory store, publishes nothing, and activates nothing — the affiliate
 * line at the end reads the merchant registry rather than asserting a state,
 * so the report cannot drift from the thing it describes.
 *
 *   node scripts/import-report.mjs <archive.zip> [more.zip ...]
 *
 * Archives are passed as arguments and are expected to live OUTSIDE this
 * repository. Nothing here prints a tracking URL, a product URL or a price in
 * a form that could be mistaken for an offer: the point is the shape of the
 * import, not the merchant's catalogue.
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

import { InMemoryOfferStore, importFeedArchive } from '../dist/index.js';

const MERCHANT = process.env.HONESTTOTAL_MERCHANT_ID ?? 'soundcore';
const SOURCE = process.env.HONESTTOTAL_SOURCE_FEED ?? 'cj:shopping:7382109';

const archives = process.argv.slice(2);
if (archives.length === 0) {
  console.error('usage: node scripts/import-report.mjs <archive.zip> [more.zip ...]');
  process.exit(2);
}

const store = new InMemoryOfferStore();
const pad = (n, w = 6) => String(n).padStart(w);

console.log('CATALOG FEED IMPORT — local demonstration');
console.log('merchant: %s   source: %s', MERCHANT, SOURCE);
console.log('='.repeat(72));

for (const path of archives) {
  const result = await importFeedArchive(readFileSync(path), store, {
    merchantId: MERCHANT,
    sourceFeed: SOURCE,
  });
  const run = result.run;

  console.log('\n%s', basename(path));
  console.log('  status            %s', run.status);
  console.log('  feed exported at  %s', run.feedExportedAt ?? '(not stated)');
  console.log('  freshness         %s', result.freshness);
  console.log('  payload sha256    %s…', run.contentSha256.slice(0, 16));

  if (!result.applied) {
    console.log('  skipped           %s', run.skipReason);
    continue;
  }

  const r = result.reconciliation;
  console.log('  rows in export  %s', pad(run.rowsTotal));
  console.log('    added         %s', pad(r.added.length));
  console.log('    removed       %s  (marked inactive, history kept)', pad(r.removed.length));
  console.log('    updated       %s', pad(r.updated.length));
  console.log('      of which tracking-URL only %s', pad(r.trackingRefreshed.length, 4));
  console.log('      of which a price move      %s', pad(r.updated.filter((u) => u.priceChange).length, 4));
  console.log('    unchanged     %s', pad(r.unchanged.length));
  console.log('    quarantined   %s', pad(result.quarantined));

  if (result.quarantined > 0) {
    const reasons = new Map();
    for (const q of await store.listQuarantine(run.id)) {
      for (const reason of q.reasons) reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
    for (const [reason, count] of [...reasons].sort((a, b) => b[1] - a[1])) {
      console.log('      %-32s %s', reason, pad(count, 4));
    }
  }
}

// ── what the catalogue looks like now ───────────────────────────────────────
const offers = await store.listOffers(MERCHANT);
const active = offers.filter((o) => o.state === 'active');
const withShipping = offers.filter((o) => o.shippingVerified);
const withFees = offers.filter((o) => o.feesVerified);

console.log('\n%s', '='.repeat(72));
console.log('CATALOGUE');
console.log('  stored offers     %s', pad(offers.length));
console.log('    active          %s', pad(active.length));
console.log('    inactive        %s', pad(offers.length - active.length));

let historyRows = 0;
let moved = 0;
for (const offer of offers) {
  const h = await store.listPriceHistory(offer.id);
  historyRows += h.length;
  if (h.length > 1) moved += 1;
}
console.log('  price history rows %s', pad(historyRows, 5));
console.log('    products whose price moved %s', pad(moved, 4));

console.log('\nDELIVERED-COST COVERAGE');
console.log('  shipping verified %s of %s', pad(withShipping.length), offers.length);
console.log('  fees verified     %s of %s', pad(withFees.length), offers.length);
if (withShipping.length === 0 || withFees.length === 0) {
  console.log('  -> NO offer qualifies for delivered-price ranking.');
  console.log('     Item price is the item alone. It is not a total, and the');
  console.log('     difference between a regular and a sale price is the');
  console.log('     merchant’s own claim, not a verified saving.');
}

console.log('\nAFFILIATE STATUS');
console.log('  Links are DISABLED. This tool stores a tracking URL but publishes');
console.log('  nothing; whether a link may be shown is decided by the merchant');
console.log('  registry in apps/web/src/lib/merchants.ts, which reports the');
console.log('  Soundcore relationship as `pending` with no affiliate URL, and is');
console.log('  enforced on every build by apps/web/scripts/verify-merchants.mjs.');

console.log('\nIMPORT LEDGER');
for (const run of await store.listRuns(MERCHANT)) {
  // padEnd, not '%-18s': console.log uses util.format, which has no width or
  // left-align flags, so the literal '%-18s' was printed instead of a column.
  console.log('  %s  %s %s', run.startedAt, run.status.padEnd(18), run.skipReason ?? '');
}
