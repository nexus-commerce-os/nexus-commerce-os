# Commerce platform — development checklist

The working list for turning HonestTotal from an honest landing page into a
commerce discovery platform. It exists so that work can resume accurately
after a gap: each item says what is done, what is not, and what is blocked on
something no amount of engineering will unblock.

**Ground rule, which outranks every item below:** no fabricated prices,
merchants, reviews, availability or affiliate relationships, ever. Synthetic
fixtures live in tests and are labelled as such. A feature that cannot be
honest yet stays disabled rather than shipping a plausible-looking lie.

Last updated: 25 November 2026 (Phase 2A complete).

---

## Phase 1 — Production stability

| | item | state |
|---|---|---|
| ✅ | release gate blocks placeholder legal text | enforced on every path |
| ✅ | one canonical build: CI, staging, dry-run and deploy run `pnpm --filter @nexus/web build` | `deploy:cf` was running `next build` directly and skipping five checks |
| ✅ | regression tests that the deploy cannot skip the artifact checks | `apps/web/test/pipeline.test.mjs`, proven to fail when reverted |
| ✅ | catalog withheld from the artifact, not merely `noindex` | `gate-catalog.mjs`; all 11 URLs return a real 404 |
| ✅ | `PUBLISH_CATALOG=1` publishes it again, unchanged | proven both ways |
| ✅ | security headers on pages and on the Worker's own responses | measured on a real Worker, not inferred |
| ✅ | rollback target recorded with every deploy | `wrangler deployments list` |
| ⬜ | **immutable artifact promotion** — build once in CI, upload, deploy that exact artifact | needs `CLOUDFLARE_API_TOKEN`; today each environment rebuilds from the same commit with the same command, which is equivalent in practice and not in guarantee |

## Phase 2A — Catalog domain core

In `packages/shared`, built to `docs/02` (NFR-CONS-01) and `docs/06 §4` rather
than to a new design.

| | item | state |
|---|---|---|
| ✅ | canonical money: integer minor units + ISO-4217, `bigint` | `money.ts` |
| ✅ | currency-safe arithmetic, rational rates, half-even rounding | cross-currency addition throws |
| ✅ | product identifiers: GTIN-8/12/13/14 with check digit, MPN, merchant SKU | `identifiers.ts` |
| ✅ | match strength: `gtin` / `brand-mpn` / `none`, no fuzzy title matching | `identifiers.ts` |
| ✅ | licence tag and its RFC-2119 rules as functions | `license.ts` |
| ✅ | freshness tiers, staleness, future-timestamp handling | `freshness.ts` |
| ✅ | `Offer` type per `docs/06 §4`, deterministic `offer_id` | `offer.ts` |
| ✅ | all-in price: item + shipping + tax, in one currency | `CostComponent` is known-or-explicitly-unknown, so a missing shipping cost can never become a silent zero |
| ✅ | `PriceObservation` and price-history analysis (low/high/mean, trailing low, volatility, daily closes) | `price-history.ts`; a drop is measured from the highest price **actually observed**, never a merchant "was" price |
| ✅ | `Product`, category paths and variants | `product.ts`; variants are products sharing a `variantGroupId`, so each keeps its own GTIN |
| ✅ | regional availability | `region.ts`; licence-region and merchant-shipping refusals are reported **separately** |
| ✅ | offer and product validation | every problem collected per record, not just the first |
| ✅ | CSV and JSON import/export | `serialization.ts`; per-row validation with line numbers, faithful round trip, CSV-injection defence |
| ✅ | the whole package is exported and consumable | 90 public exports from `packages/shared/src/index.ts` |

**Test evidence:** 138 tests across 9 suites, all passing (`pnpm --filter @nexus/shared test`).
Round-trip tests found two real fidelity bugs during this work, both fixed:
the exporter wrote the zero-padded GTIN-14 form so re-import lost the length
the merchant quoted, and the test script's `node --test "dist/*.test.js"` glob
is unsupported on the Node 20 that CI stage 3 runs — while `node --test dist`
"passes" on Node 24 by running one phantom test and no real suite. The runner
now builds the file list itself and **fails if a test source produced no
compiled suite**, so a silently empty run cannot go green.

### Exact next step

Shorten the home page, in this order, each its own commit so a bad call is
cheap to undo:

1. Move `#agent` ("For developers", 970px) to `/for-developers`, linked from
   the nav and the footer. It is a developer pitch in the middle of a
   shopper's page.
2. Cut the hero (2,234px) to roughly one viewport: the claim, the proof row
   and one call to action. The illustration below it is already labelled
   "ILLUSTRATION — not live data"; keep that label wherever it lands.
3. Re-measure at 375 / 768 / 1280 and record the numbers here. The target is
   a home page under ~5,000px at 768, and the measurement is the evidence —
   not an impression that it "feels shorter".

## Phase 2B — Commerce intelligence

| | item | state | blocked by |
|---|---|---|---|
| ⬜ | merchant adapter interface | not started | — (interface is buildable; a live adapter needs a feed) |
| ⬜ | product matching and duplicate detection over a corpus | primitives done | — |
| ⬜ | commission-independent ranking | not started | — |
| ⬜ | total purchase cost incl. known shipping and tax | not started | — |
| ⬜ | price comparison and sorting | not started | — |
| ⬜ | advanced filters | basic search and category filter already live in `apps/web` | — |
| ⬜ | product comparison UI | not started | — |
| ⬜ | affiliate URL resolution | partially exists: `apps/web/src/lib/merchants.ts` resolves links and refuses to claim a relationship that does not exist | **a signed affiliate agreement** |
| ⬜ | privacy-preserving referral tracking | not started | — |
| ⬜ | ingestion and validation pipeline | not started | **an authorized feed** |

## Phase 3 — Administration

Nothing here ships before authentication does. An unauthenticated admin
surface is worse than no admin surface.

| | item | state |
|---|---|---|
| ⬜ | authentication and session management | `services/auth` exists and has real tests (OIDC, passkeys, device-session binding); not wired to any admin UI |
| ⬜ | role-based access control | — |
| ⬜ | product / brand / category / merchant management | — |
| ⬜ | offer and price management | — |
| ⬜ | import / export tools | — |
| ⬜ | approval and publication controls | `PUBLISH_CATALOG` is the current, crude version |
| ⬜ | source verification | — |
| ⬜ | affiliate configuration | — |
| ⬜ | referral analytics | — |
| ⬜ | waitlist management and statistics | data exists in KV; no interface |
| ⬜ | audit log | — |
| ⬜ | system health | — |

## Phase 4 — Customer experience

| | item | state |
|---|---|---|
| ✅ | skip link, heading order, catalog touch targets | WCAG 2.4.1 and 2.5.8 |
| ✅ | mobile header keeps the primary call to action | measured at 375px and 344px |
| ✅ | **mobile navigation** | PR #121: a 44x44 disclosure button injected once from `layout.tsx`, Escape closes and returns focus, measured at 375/768/1024 |
| ⬜ | shorten the home page | **measured at 768px wide, section by section** — hero 2,234px · proof-strip 384 · how 771 · ranking 983 · savings 727 · agent 970 · trust 856 · (unnamed) 544 · faq 671 · cta 511 = 8,651px of sections. The two biggest wins, in order: the hero (2,234px, most of it a mock illustration) and "For developers" (`#agent`, 970px) which is a developer pitch sitting in the middle of a shopper's page and belongs on its own route. |
| ⬜ | search-first discovery surface | **blocked on honesty, not on engineering.** The catalog is withheld (all 11 URLs are a real 404), so a prominent search box on the home page would be a control that searches nothing — which the founder's own instruction forbids. The buildable honest version is a search over the pages that DO exist (guides, FAQ, how-we-rank, commission-blind, verified-savings); that is real and worth doing. A product search ships when there is a product corpus. |
| ⬜ | category navigation | — |
| ⬜ | comparison layout | domain side is done and tested (`rankByTotal`, `allInPrice`, `comparableTotal` in `@nexus/shared`); the UI waits on a real corpus for the same reason as search |
| ⬜ | price-verification and source indicators | the catalog already labels every spec with its source and date |
| ⬜ | empty states | — |

---

## Blocked on something engineering cannot fix

| blocker | what it stops | who |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` not set | `deploy-web` and `staging-verify` workflows; immutable artifact promotion | owner — creating and pasting a token is a credential interaction |
| no affiliate network approval | any real affiliate link, commission data, referral revenue | owner — commercial agreement |
| no authorized product feed | real prices, availability, merchant offers | owner — commercial agreement |

Everything else on this page is ordinary engineering and needs no permission.
