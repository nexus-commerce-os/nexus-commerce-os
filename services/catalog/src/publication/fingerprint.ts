/*
 * THE CATALOGUE FINGERPRINT.
 *
 * A cycle that changes nothing cost about 300 row writes — every one of them
 * staging publication candidates identical to the previous set. Measured over
 * twelve consecutive scheduled cycles on staging, where the feed was unchanged
 * each time and the catalogue was republished anyway.
 *
 * WHAT IT IS NOT. It is deliberately NOT a hash of the feed bytes. An offer
 * can expire without the feed changing, a merchant's approval can be withdrawn
 * without any feed moving at all, and a rules change alters what is eligible
 * while every byte stays the same. Skipping on unchanged bytes would make all
 * three invisible.
 *
 * So the fingerprint is taken AFTER the full eligibility pipeline has run.
 * Everything that decides publication is already baked into the candidate set
 * by then:
 *
 *   · source permissions and merchant relationship — an unapproved merchant's
 *     products are not eligible, so withdrawing approval changes the set;
 *   · product freshness and offer expiry — a stale offer stops being eligible
 *     and `dataVerifiedAt` moves when a fresh one arrives;
 *   · product information, price and availability — title, brand, category,
 *     from-price and offer count are all in the digest;
 *   · the publication RULES themselves, through `rulesVersion`.
 *
 * The expensive half of a cycle is reads, and those still happen. Only the
 * WRITES are skipped.
 */
import { createHash } from 'node:crypto';

import type { PublicationCandidate } from './generation';

/**
 * One candidate, rendered as a stable line.
 *
 * Every field that a reader can SEE is included, plus the ones that decide
 * whether they see it at all. `reasonCode` is in here even for eligible rows:
 * a product that becomes eligible for a different reason is a different
 * decision, and an operator looking at the log should find a new generation
 * rather than silence.
 *
 * The separator is a unit separator rather than a comma, because a title
 * containing a comma would otherwise be able to imitate a different row.
 */
function line(candidate: PublicationCandidate): string {
  return [
    candidate.productId,
    candidate.slug,
    candidate.title,
    candidate.brand ?? '',
    candidate.categorySlug ?? '',
    candidate.dataVerifiedAt,
    candidate.searchText,
    candidate.fromPrice ? String(candidate.fromPrice.amountMinor) : '',
    candidate.fromPrice ? candidate.fromPrice.currency : '',
    String(candidate.offerCount),
    candidate.eligible ? '1' : '0',
    candidate.reasonCode,
  ].join('\u001f');
}

/**
 * A digest of the complete eligible catalogue state.
 *
 * Sorted by product id, so the result does not depend on the order the
 * pipeline happened to produce — two runs over the same data must agree, and
 * a Map's insertion order is not a guarantee.
 *
 * INELIGIBLE CANDIDATES ARE EXCLUDED. They are not published, so a change
 * among them cannot change what anybody sees, and including them would force a
 * republication every time a withheld product's reason shifted. Their
 * decisions are still recorded; they simply do not move the catalogue.
 */
export function catalogueFingerprint(
  candidates: readonly PublicationCandidate[],
  rulesVersion: string,
): string {
  const eligible = candidates
    .filter((candidate) => candidate.eligible)
    .map(line)
    .sort();

  const hash = createHash('sha256');
  // The rules version is part of the digest, not a sibling of it: a rules
  // change must produce a different fingerprint even when every product is
  // identical, because the SAME products published under DIFFERENT rules is a
  // different publication.
  hash.update(`rules:${rulesVersion}\n`);
  hash.update(`count:${eligible.length}\n`);
  for (const entry of eligible) {
    hash.update(entry);
    hash.update('\n');
  }
  return hash.digest('hex');
}
