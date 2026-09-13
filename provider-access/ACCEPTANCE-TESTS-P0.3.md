# Artifact 7 — Acceptance Test Skeletons (AT-P03-01 … AT-P03-20)

**Specifications only.** No test code exists and none is authorized. Every test below is
`NOT EXECUTED`, and none can be executed before an approved provider account exists.

> A test whose evidence is a mock response proves that the mock works. Where a test requires real
> provider data, that is stated in *Evidence Required*, and no substitute is acceptable.

---

## AT-P03-01 — Connector authenticates against the real provider

- **Objective:** The connector authenticates using credentials drawn from the secret store.
- **Evidence Required:** A successful authenticated call to the live provider; credentials sourced
  from the secret store, **never from the repository**; no credential value in logs or output.
- **Pass Criteria:** Authenticated request succeeds; a deliberately wrong credential fails cleanly
  with a typed error; no secret appears in any log line, error message, or test output.
- **Status:** `NOT EXECUTED`

## AT-P03-02 — Missing credentials refuse startup

- **Objective:** An enabled connector with an absent required variable stops the service at boot.
- **Evidence Required:** Boot log showing refusal and the missing variable **named** (name only).
- **Pass Criteria:** Service exits at startup. It does **not** start and fail at first shopper
  request, and it does **not** fall back to a default.
- **Status:** `NOT EXECUTED`

## AT-P03-03 — Catalogue retrieval returns real records

- **Objective:** Over-ear headphone records are retrieved from the authorized catalogue.
- **Evidence Required:** Raw provider response captured from a real account, with retrieval
  timestamp.
- **Pass Criteria:** ≥1 record returned; every record traceable to an approved merchant.
- **Status:** `NOT EXECUTED`

## AT-P03-04 — Field mapping matches observed data

- **Objective:** Each mapping row in artifact 6 holds against real responses.
- **Evidence Required:** Sampled records compared field by field with the mapping table.
- **Pass Criteria:** No mapping row is marked `Unknown? = YES`; no field is mapped on the basis of
  its name alone.
- **Status:** `NOT EXECUTED`

## AT-P03-05 — Invalid records are rejected and counted

- **Objective:** A record failing validation never becomes an Offer.
- **Evidence Required:** Rejection counters, plus the rejected records themselves.
- **Pass Criteria:** Rejected records are absent from the Offer store and present in the count. **No
  coercion, no defaulting, no silent drop.**
- **Status:** `NOT EXECUTED`

## AT-P03-06 — GTIN coverage measured, not assumed

- **Objective:** Establish real identifier coverage for the category.
- **Evidence Required:** Completed §4b sample table with counts and percentages.
- **Pass Criteria:** Coverage is **reported truthfully**, whatever it is. Low coverage is a valid
  outcome that stops implementation; it is not a reason to relax matching.
- **Status:** `NOT EXECUTED`

## AT-P03-07 — Identity resolution is exact-match only

- **Objective:** Products merge on exact identifier equality and nothing else.
- **Evidence Required:** Resolution decisions for a sample containing near-duplicate titles.
- **Pass Criteria:** No merge occurs without identifier equality. **No fuzzy, heuristic, or AI
  matching is present in the code path.**
- **Status:** `NOT EXECUTED`

## AT-P03-08 — Offers never mutate Product identity

- **Objective:** A merchant's marketing title cannot overwrite canonical brand/model.
- **Evidence Required:** Product record before and after ingesting an offer with a divergent title.
- **Pass Criteria:** Canonical fields unchanged.
- **Status:** `NOT EXECUTED`

## AT-P03-09 — Absent shipping data is not treated as zero

- **Objective:** Enforce the binding rule of 2026-08-01.
- **Evidence Required:** A real record with no shipping value, carried through ranking.
- **Pass Criteria:** The offer is **not rankable**. It is not defaulted to zero, not estimated, not
  ranked on item price alone.
- **Status:** `NOT EXECUTED`

## AT-P03-10 — Only explicitly verified free shipping is rankable

- **Objective:** Enforce approved option B.
- **Evidence Required:** Records with (a) verified free shipping, (b) a non-zero shipping cost,
  (c) missing shipping, (d) stale shipping data.
- **Pass Criteria:** Only (a) enters the ranking, and (a) qualifies **only** under Ruling 1 — a
  documented zero-means-free-shipping rule, or a dedicated free-shipping flag. An undocumented zero
  is `UNKNOWN` and excluded. Each of (b), (c), (d) is excluded with a recorded reason.
- **Status:** `NOT EXECUTED`

## AT-P03-11 — Incomplete price claims never enter comparison

- **Objective:** Any `unknown` required component removes the offer from best-price comparison.
- **Evidence Required:** Component state per offer, and the resulting ranking input set.
- **Pass Criteria:** No offer with an `unknown` required component appears in the comparison; if
  displayed at all, it is explicitly labelled incomplete.
- **Status:** `NOT EXECUTED`

## AT-P03-12 — The user-facing label matches what was verified

- **Objective:** The rendered claim is exactly what the data supports.
- **Evidence Required:** Rendered output for a ranked offer.
- **Pass Criteria:** Label reads **"Pre-tax total: $X, including verified free shipping."** The
  string *"Shipping included for ZIP …"* **never appears** unless destination-specific shipping was
  genuinely verified.
- **Status:** `NOT EXECUTED`

## AT-P03-13 — Ranking is commission-blind by construction

- **Objective:** Commission cannot influence order.
- **Evidence Required:** The ranking candidate type and its construction site.
- **Pass Criteria:** No commission, payout, or `ProductBid` field is reachable from the ranking
  input. Structural absence — **not a code comment promising neutrality**.
- **Status:** `NOT EXECUTED`

## AT-P03-14 — Ranking is deterministic and tie-broken explicitly

- **Objective:** Identical inputs produce identical order.
- **Evidence Required:** Repeated runs over a fixed candidate set, including exact-price ties.
- **Pass Criteria:** Byte-identical ordering; ties resolved by the documented rule, never by
  arbitrary iteration order.
- **Status:** `NOT EXECUTED`

## AT-P03-15 — Freshness tier reflects real observation time

- **Objective:** Every offer carries an honest `as_of`.
- **Evidence Required:** Timestamps as returned by the provider (see risk R-06).
- **Pass Criteria:** Tier derives from provider-supplied item time. Under Ruling 2, a catalogue-only
  timestamp leaves freshness `UNKNOWN`, and **an offer with unknown freshness is never assigned
  LIVE**. Catalogue time is labelled as catalogue-level and never presented as per-offer
  observation. No item timestamp is synthesised.
- **Status:** `NOT EXECUTED`

## AT-P03-16 — Cache TTL never exceeds the contractual cap

- **Objective:** `license_tag.cache_ttl_max_s` comes from the licence, and binds.
- **Evidence Required:** Written contractual term alongside the configured value.
- **Pass Criteria:** Effective TTL ≤ contractual maximum. Attempting to configure a longer TTL is
  refused at boot.
- **Status:** `NOT EXECUTED`

## AT-P03-17 — Deep link generation is compliant and carries our click id

- **Objective:** Hand-off uses a provider-sanctioned tracked link.
- **Evidence Required:** Generated link, the destination it resolves to, and the identifier as it
  appears in the provider's own reporting.
- **Pass Criteria:** Link resolves to the intended merchant page; our `click_id` is visible in
  provider reporting. **A 200 response alone is not verification.**
- **Status:** `NOT EXECUTED`

## AT-P03-18 — Hand-off is restricted to allow-listed merchants

- **Objective:** Redirects only ever reach approved domains.
- **Evidence Required:** Redirect attempts for an allow-listed and a non-allow-listed merchant.
- **Pass Criteria:** Non-allow-listed target is refused. **No open redirect exists.**
- **Status:** `NOT EXECUTED`

## AT-P03-19 — Rate limiting is handled from response headers

- **Objective:** Provider throttling degrades gracefully.
- **Evidence Required:** A real 429 with its headers, and the connector's behaviour.
- **Pass Criteria:** `Retry-After` is honoured; no unbounded retry storm; limits are read from
  headers rather than hard-coded.
- **Status:** `NOT EXECUTED`

## AT-P03-20 — Price-claim audit ≥ 99% (NFR-COMP-01)

- **Objective:** Displayed claims are substantiated by source data.
- **Evidence Required:** Audit sample of displayed claims traced to provider records and timestamps.
- **Pass Criteria:** ≥99% substantiated. **Any unsubstantiated claim is reported, never rounded
  away.** A failing audit blocks release rather than adjusting the threshold.
- **Status:** `NOT EXECUTED`

---

## Summary

| Metric | Value |
| --- | --- |
| Tests specified | 20 |
| Executed | **0** |
| Requiring real provider data | 20 |
| Executable today | **0** |

**Every test is `NOT EXECUTED`.** This artifact must never be summarised as test coverage.
