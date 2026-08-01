# Design — P0.3 Commerce Thin Slice

**Status:** 🟡 DESIGN ONLY, awaiting CTO approval. **No implementation has begun.**
**Prepared:** 2026-08-01 · **Scope:** the first real shopping capability, deliberately narrow.

> Repo root, so the [ADR-0023](docs/adr/ADR-0023-doc-freeze-and-approval-gate.md) freeze is intact.
> Nothing here modifies the certified architecture; every decision below is a *narrowing* of it.

---

## 0. What this slice is, and what it is not

The thin slice proves one path end to end: **a real query → real offers from an authorized source →
a correctly computed all-in price → a commission-blind ranking → a signed hand-off to an
allow-listed merchant.**

**It does not close P0.3.** The roadmap's P0.3 exit gate requires **≥4 connectors and demonstrated
failover with no SPOF**. This slice ships **one** connector. That is a deliberate difference, stated
here so it cannot be mistaken later: completing the slice earns *"the commerce path works"*, not
*"P0.3 is done"*.

Out of scope, per the ruling and repeated here so scope creep is visible: AI, cashback, coupons,
travel, marketplace, money ledger, conversion accounting.

## 1. One product category — over-ear headphones

| Criterion | Why headphones |
|---|---|
| Identity | Almost always carry a **GTIN/UPC** and a stable MPN, so duplicate matching can be exact rather than fuzzy — §9 depends on this |
| Variants | Colour only. No size matrix, so one product ≠ forty SKUs |
| Price shape | Item + shipping + tax. No configuration, no subscription, no perishability |
| Regulation | No age-gating, no compliance regime, unlike supplements or alcohol |
| Continuity | The landing page's illustrative example is already a Sony WH-1000XM5, so demo and real content describe the same world |

**Rejected:** apparel (variant explosion, sizing), grocery (perishable, hyper-local), electronics
broadly (too wide for a slice). The point of a category this narrow is that a wrong all-in price is
*obvious* to a reviewer.

## 2. One launch geography — United States

Follows [ADR-0007](docs/adr/ADR-0007-phased-global-rollout.md) P1 verbatim. Consequences that shape
the design:

- **Sales tax is destination-based and not knowable without an address.** This is the single hardest
  honesty problem in the slice; §5 handles it explicitly rather than guessing.
- USD only, so no FX in the slice.
- One residency region (`us-east-1`), matching the Identity default already shipped.

## 3. One authorized connector

**Recommendation: a single affiliate network with a product-catalog API and real-time postbacks —
Impact or CJ.** Both expose a product/offer feed plus a click-tracking endpoint, which is exactly
the surface the slice needs.

**Not Amazon PA-API for the first connector**, despite the largest catalogue: access requires
qualifying sales within a trial window (a chicken-and-egg problem before launch), the TOS constrains
price display and caps caching, and postbacks are batch rather than real-time — three variables that
would be under test simultaneously with our own code.

**This is a decision only the founder can settle**, because it depends on which partner account can
actually be obtained. The design is connector-agnostic: everything below sits behind one port.

```
ProductFeedConnector          (authorized data in)
  search(query, region)     → RawOffer[]
  fetchByIdentifier(gtin)   → RawOffer[]
  capabilities()            → { hasShipping, hasTax, cacheTtlMaxS, postbackMode }
```

`capabilities()` is not decoration. A connector that cannot supply shipping is a connector whose
offers can never claim a complete all-in price, and §5 reads this rather than assuming.

**[ADR-0001](docs/adr/ADR-0001-data-sourcing.md) is absolute: authorized APIs and licensed feeds
only. No scraping, ever.** If a merchant is not reachable through the authorized connector, that
merchant does not appear. Not "appears with estimated data" — does not appear.

## 4. Catalog normalization

Two aggregates, deliberately separate:

- **Product** — the thing a person means. Identity: GTIN. Attributes: brand, model, MPN, title,
  category, image.
- **Offer** — one merchant's proposition for a Product at a point in time. Carries price components,
  merchant, availability, `as_of`, `source`, `license_tag`, and freshness tier.

One Product has many Offers. **The Offer never edits the Product**: a merchant's marketing title
must not overwrite canonical brand/model, or one bad feed poisons identity for everyone.

Normalization pipeline: raw → field mapping → unit/currency normalization → identity resolution
(§9) → validation → persisted Offer. **A raw record that fails validation is rejected and counted,
never coerced.** Silent coercion is how a wrong price becomes a claim.

## 5. All-in price — and the honesty rule

```
all_in = item + shipping + tax + fees − order-level discounts
```

Each component carries its own state: `known` | `unknown` | `not_applicable`.

**The rule that governs the whole slice:**

> If any component required for a jurisdiction is `unknown`, the offer has **no all-in price**. It is
> not estimated, not approximated, not shown with an asterisk in the ranking. It is **excluded from
> the best-price comparison** and may only be displayed as an item price explicitly labelled
> incomplete.

This is what makes NFR-COMP-01 (price-claim audit ≥ 99%) achievable rather than aspirational: we
only ever claim what we can substantiate. The alternative — estimating tax to keep an offer in the
ranking — manufactures exactly the claim we cannot defend.

**US sales tax, concretely.** Destination-based, so with no address the tax is genuinely unknown.
Options for the slice:

| Option | Consequence |
|---|---|
| **A. Compare pre-tax, labelled "before tax"** (recommended) | Honest and comparable, because every offer is treated identically. The comparison is still meaningful — tax is broadly merchant-independent for a given destination |
| B. Ask for a ZIP code | More precise, adds friction and a personal-data question at the top of the funnel |
| C. Estimate from IP | **Rejected.** A guessed tax presented as a total is precisely the false claim NFR-COMP-01 measures |

Recommending **A**, with the label carried in the API response and rendered in the UI — not a
footnote. Shipping *is* required and must be `known`, because it differs sharply between merchants
and is the component most likely to reverse a ranking.

## 6. Best-offer ranking — commission-blind by construction

[ADR-0021 D5](docs/adr/ADR-0021-legal-product-truth.md) requires ranking that commission cannot
move. Stating that in a policy document is not enough; the slice enforces it **structurally**:

```
RankingCandidate = {
  offerId, productId, allInPrice, currency,
  shippingSpeedDays, merchantReturnWindowDays,
  merchantTrustTier, availability, freshness
}
```

**There is no commission field on the type.** The ranking function is pure over this shape and
literally cannot read commission, because commission is not in its input. Commission lives on the
Offer, is used only for the hand-off and for reporting, and is stripped when candidates are built.

Ordering: complete all-in price ascending → then shipping speed → then return window → then trust
tier. Deterministic; ties broken by a stable id so results never shuffle between identical requests.

**Fitness test (build-failing):** rank a fixed set, then re-rank with every commission value
inverted, and assert the output order is **byte-identical**. This is the neutrality wall as a test,
and it is the single most important test in the slice.

## 7. Signed affiliate redirect

```
GET /v1/handoff/{token}  →  302 to the merchant's authorized affiliate URL
```

- Token is **HMAC-signed** server-side, carries `click_id` (NEXUS-minted), `offerId`, `productId`,
  `merchantId`, `issuedAt`, `expiresAt`; **short TTL** and **single-use**.
- The destination is **never taken from the token**. The token names an offer; the server resolves
  the merchant URL from its own record and checks it against a **merchant allow-list**. A token that
  resolves off-list is refused. This is what stops the redirect becoming an open redirect.
- Every redirect writes `handoff.redirected` to the **NEXUS-owned click-out ledger** with our own
  `click_id`, per [ADR-0011](docs/adr/ADR-0011-attribution-reconciliation.md) — the source of truth
  we control, independent of the network's reporting.
- **No funds, no custody, no order** ([ADR-0006](docs/adr/ADR-0006-referral-only-model.md)).

Reusing the I-7f lesson: the merchant URL is resolved from a trusted record, never from
caller-supplied input — the same defect class as a client nominating a `DeviceId`.

## 8. Freshness and provenance — the five data states

Every offer that reaches a caller is labelled with exactly one state. **This is the taxonomy the
ruling asks to be explicit, and it is carried in the API, not just in prose.**

| State | Meaning | Shown? | Rankable? |
|---|---|---|---|
| **LIVE** | Fetched from the connector during this request | ✅ | ✅ |
| **CACHED** | Within the freshness budget **and** within `license_tag.cache_ttl_max_s` | ✅ with `as_of` | ✅ |
| **STALE** | Past the freshness budget, still within the licence cap | ✅ **explicitly labelled stale** | ❌ never in a best-price claim |
| **UNAVAILABLE** | Connector error, or licence TTL exceeded | ❌ omitted entirely | ❌ |
| **ILLUSTRATIVE** | Demo content | ✅ only on demo surfaces, structurally separated | ❌ |

Mapping to the three-tier model in [06 §7](docs/06-database-architecture.md): Redis hot → LIVE/CACHED,
feed-synced warm → CACHED/STALE, on-demand live check → LIVE, taken **at purchase intent** (SDD §8),
which is what reconciles NFR-PERF-01 with NFR-COMP-01.

**Every cached entry's TTL is capped by `license_tag.cache_ttl_max_s`.** Past the cap the data is
UNAVAILABLE, not stale — we lose the right to show it at all. This is a licence boundary, not a
performance tuning knob.

**ILLUSTRATIVE never mixes with the other four.** A demo offer cannot enter a real result set, and
the type system enforces it: demo content is a different type that the ranking function does not
accept. Today's landing-page receipt is illustrative and stays on the marketing surface.

## 9. Duplicate-product matching

Tiered, most-confident first, and **never auto-merging on a guess**:

1. **GTIN exact** → auto-merge. High confidence, and the reason §1 chose this category.
2. **Brand + MPN exact** (normalized) → auto-merge.
3. **Fuzzy title + brand + attributes** → **never auto-merged.** Emits a candidate to a **review
   queue** — the same pattern already used for curriculum candidates elsewhere in the estate.

A wrong merge is worse than a missed one: it attributes one merchant's price to another product and
produces a confidently wrong "best price". Precision over recall, deliberately.

## 10. Failure and fallback

| Failure | Behaviour |
|---|---|
| Connector timeout / 5xx | Serve CACHED within budget; else STALE **labelled**; else UNAVAILABLE |
| Connector returns malformed offers | Reject those records, count them, serve the rest. Never coerce |
| Licence TTL exceeded | UNAVAILABLE. Not shown at any label |
| Shipping unknown | Offer has no all-in price → excluded from comparison (§5) |
| **All offers unavailable** | **Honest empty state**: "We can't verify prices for this right now." Never a fabricated or illustrative result |
| Merchant off allow-list | Hand-off refused |
| Rate limited by connector | Backoff; degrade to CACHED; alert |

**Fail toward saying less, never toward saying something unverified.** That is the inverse of the
rate-limiter's fail-open posture, and deliberately so: there, refusing meant locking users out of
their own accounts; here, guessing means making a false price claim.

## 11. Disclosure and neutrality

- **Every** API response carrying offers includes a `disclosure` field ([04 §5.2](docs/04-system-architecture.md)); the surface must render it before any redirect.
- Ranking is commission-blind by construction (§6) and audited by the inversion test.
- Sponsored placement: **out of scope for the slice.** None exists, so none can leak into ranking.
- The click-out ledger makes the claim falsifiable later (ADR-0011).

## 12. End-to-end acceptance tests

Against a **contract-recorded connector fixture** (real recorded payloads, replayed — not
hand-written fakes), plus the live-connector smoke test in §13.

1. **Golden path** — query → offers → complete all-in prices → ranked → hand-off token → 302 to an
   allow-listed merchant → `handoff.redirected` written with a NEXUS `click_id`.
2. **Neutrality (build-failing)** — invert every commission; ranking output byte-identical.
3. **Incomplete price excluded** — an offer with unknown shipping never appears in the best-price
   comparison, and is labelled incomplete if displayed.
4. **Cheapest item price does not win when shipping reverses it** — the test that proves "all-in"
   means something.
5. **Stale labelling** — a past-budget offer is labelled and excluded from the claim.
6. **Licence cap** — past `cache_ttl_max_s` the offer disappears entirely.
7. **Connector down** — degrades correctly; all-down yields the honest empty state, never demo data.
8. **Malformed records** — rejected and counted; siblings still served.
9. **Duplicate matching** — GTIN merges; near-title does **not** auto-merge, it queues.
10. **Hand-off security** — expired token refused; replayed token refused; tampered token refused;
    off-allow-list destination refused.
11. **Disclosure present** on every offer-bearing response.
12. **Illustrative isolation** — demo content cannot enter a real result set (type-level + runtime).

## 13. What cannot be verified in CI

Stated now so it is not discovered at the end, consistent with how FU-1 was handled:

- **Real connector behaviour** — rate limits, payload drift, sandbox-vs-production differences. Needs
  a real partner account; a recorded fixture proves our parsing, not their API.
- **Price-claim accuracy against reality (NFR-COMP-01)** — requires sampling real merchant pages and
  comparing. That is an operational activity, not a unit test.
- **Failover with no SPOF** — needs ≥2 connectors, which this slice does not ship.

## 14. Decisions required before implementation

1. **Which connector**, and can the account actually be obtained? Blocks everything.
2. **Pre-tax comparison (§5 option A)** — approve, or require ZIP-code entry?
3. **Confirm the slice does not close the P0.3 exit gate** (1 connector, no failover) and that this
   is understood as a staged step.
4. **Review-queue ownership** — who adjudicates fuzzy duplicate candidates?
5. **Category scope** — over-ear headphones only, or all headphones?

Nothing is implemented pending these answers.
