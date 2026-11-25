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

1. ~~Move `#agent` ("For developers", 970px) to `/for-developers`~~ **done** —
   home page measured 9,754px → **8,784px** at 768 wide, the exact height the
   section occupied. Linked from the header nav, the footer and the sitemap.
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
| ⬜ | publish the spec catalog | audited and publishable (`catalog-publication-audit.md`), but **blocked on hydration**: its search is a React control, and shipping it broken would be a decorative search box. The founder has also asked for the manufacturers' own source terms to be checked before publication — facts are not copyrightable, but these records transcribe the maker's exact wording, and that has not been verified against their terms yet. |
| ⬜ | search-first discovery surface | **blocked on honesty, not on engineering.** The catalog is withheld (all 11 URLs are a real 404), so a prominent search box on the home page would be a control that searches nothing — which the founder's own instruction forbids. The buildable honest version is a search over the pages that DO exist (guides, FAQ, how-we-rank, commission-blind, verified-savings); that is real and worth doing. A product search ships when there is a product corpus. |
| ⬜ | category navigation | — |
| ⬜ | comparison layout | domain side is done and tested (`rankByTotal`, `allInPrice`, `comparableTotal` in `@nexus/shared`); the UI waits on a real corpus for the same reason as search |
| ⬜ | price-verification and source indicators | the catalog already labels every spec with its source and date |
| ⬜ | empty states | — |

---

## Where this stands — 25 November 2026, end of session

**Live on honesttotal.com:** Worker version `c3673d87` (rollback `ea8caad5`).
React hydrates for the first time, the mobile menu and theme toggle work, and
the waitlist works with and without JavaScript. All eight security headers
intact, no `Set-Cookie`, production KV unchanged at 2 entries.

**PR #123 is open with six commits and was NOT merged.** Its CI had
`ci-gate` green; CodeQL reported one new alert (my test shim's regex missed
`<SCRIPT>`), which is fixed in `ad82ec7`, and the re-run had not finished when
the machine lost all network — DNS itself stopped resolving, so GitHub and
Cloudflare are both unreachable.

### Exact resume point

1. `git push origin feat/csp-nonce-hydration` — commit `bd7161f` is committed
   locally but unpushed.
2. Confirm PR #123's CodeQL re-run is clean, then merge.
3. Deploy. The new provenance gate will refuse until the commit is pushed,
   on a shipping branch and green — that is it working, not a fault.

### What shipped since the last update

| | |
|---|---|
| ✅ | nonce CSP; hydration restored; `run_worker_first` was the missing piece |
| ✅ | waitlist works with no JavaScript (303 + `?joined=`), proven on production |
| ✅ | deploy provenance gate — refuses an unpushed, dirty or un-green deploy |
| ✅ | artifact manifest — build records 103 file hashes, deploy verifies before upload |
| ✅ | home page: mobile 9,583 → 6,746px, desktop 6,497 → 5,023px, no claims removed |
| ⬜ | home page to 4,000–5,000px — needs disclosures removed; founder's call |
| ⬜ | catalog publication — copyright exposure measured and small; **manufacturer terms unread** |
| ⬜ | Playwright at 320/375/390/412/768/1024/1440/1920 — the in-app pane cannot go below ~412px |

## THE BLOCKER THAT MATTERS RIGHT NOW — React does not hydrate in production

Measured on the live site, 25 November 2026: `reactFiberAttached: false`.

`script-src 'self'` in `apps/web/public/_headers` blocks Next's inline
bootstrap scripts (`self.__next_f.push(...)`), which is how a static export
starts React. The browser console says so on every page load. Consequences, in
order of how much they cost:

1. **The waitlist lost every signup.** The form had no `action`, no `method`
   and no field `name`, because React's `onSubmit` was the only path. Fixed in
   PR #122 — a native post now works with no JavaScript at all — but the fix
   is a floor, not a repair of hydration.
2. The theme toggle, the mobile menu and the hero disclosure do nothing.
3. **It also blocks publishing the catalog.** `/products` search is a React
   control; shipping it while hydration is broken would put a search box on
   the site that searches nothing — the exact thing the founder forbade.

So this one header gates most of the remaining customer-facing work.

### The options, measured

| | approach | cost |
|---|---|---|
| **A** | `script-src 'self' 'unsafe-inline'` | Gives up inline-injection protection. Keeps the part that matters here: no external script origin is permitted, so the privacy notice's "no third-party anything" stays enforced. The site renders no user content, sets no cookie and has no login. |
| **B** | Per-request nonce injected by the Worker with `HTMLRewriter` | Strictly stronger, no weakening. Costs HTML edge-caching (the nonce must not be reused, so HTML becomes `no-store`) and needs a small, non-weakening change to the `new Response(` guard in `verify-headers.mjs`, which was written when the Worker only emitted JSON. |
| ~~C~~ | Hash-pin every inline script | **Measured and rejected.** 144 unique inline scripts across 27 pages, only 3 shared, because each page's flight payload embeds that page's own content — a ~7.8KB header that breaks whenever any copy changes. |

A is prepared and held at `scratchpad/csp-hydration-fix.patch`, together with
the build check that would have caught this: it scans every built page and
fails when the CSP does not permit that page's own inline scripts. Run against
the old build it found **364 blocked scripts**; with the fix, 38 pages clean.

**This is the founder's decision, not an engineering one** — it changes the
security posture of a live site, and the automated safety control in this
session blocked the change for exactly that reason. Nothing here is shipped
until that call is made.

### Why nothing caught it

Every existing check passed: the headers were present, the CSP was not
weakened, the pages built, the links worked. The one question nobody asked was
whether the policy permits the page's **own** scripts — and the Worker, which
decides whether a signup is kept, was the only part of the app with no test at
all. Both gaps are now closed.

## Blocked on something engineering cannot fix

| blocker | what it stops | who |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` not set | `deploy-web` and `staging-verify` workflows; immutable artifact promotion | owner — creating and pasting a token is a credential interaction |
| no affiliate network approval | any real affiliate link, commission data, referral revenue | owner — commercial agreement |
| no authorized product feed | real prices, availability, merchant offers | owner — commercial agreement |

Everything else on this page is ordinary engineering and needs no permission.

---

# Status, 26 November 2026

Everything above about the CSP decision is now **history**: option B shipped,
React hydrates in production, and the catalog is no longer blocked by it. What
follows is the current state.

## Landed

| PR | what | into |
|---|---|---|
| #123 | nonce CSP, provenance gate, homepage consolidation | `release/product-catalog` |
| #124 | artifact manifest extended to cover the **Worker bundle** | `release/product-catalog` |
| #125 | **CJ feed ingestion, reconciliation, Postgres persistence** | `main` |
| #126 | source-terms audit, 8 of 10 records quarantined | `release/product-catalog` |
| #127 | the search box suggested three queries matching nothing | `release/product-catalog` |
| #128 | Playwright at eight exact widths, wired into `ci-gate` | open — CI is its first real run |

`main` and `release/product-catalog` are still separate lineages: `main` holds
the services, `release/product-catalog` holds `wrangler.toml` and the deploy.
**The feed pipeline is therefore merged but not deployed, because nothing on
the release lineage consumes it yet.** That is the next structural job, and it
is bigger than it looks: the two lineages have different data flows, so nothing
can simply be copied across.

## The automation engine exists, and what it still lacks

PR #125 is the core of the automation-first design, verified against a real
PostgreSQL in CI — 139 tests, 131 pass, 0 fail, and **0 Postgres tests
skipped**. Of the fifteen pipeline capabilities, this covers the middle of the
chain:

| # | capability | state |
|---|---|---|
| 2 | CSV/XML/JSON/ZIP feed ingestion | **done** (`feed/archive.ts`, `feed/cj-shopping-feed.ts`) |
| 3 | automatic product creation and updates | **done** (`sync/import-feed.ts`) |
| 6 | GTIN/MPN-based matching | **partial** — identity is `(merchant_id, merchant_offer_id)`; GTIN matching across merchants is not built |
| 8 | automatic price and stock updates | **done** |
| 9 | historical price tracking | **done** — records movement, not sightings |
| 13 | deactivation of expired offers | **done** — absence marks inactive, never deletes |
| 14 | retry, failure recovery, monitoring | **partial** — transactional rollback, an import ledger and quarantine exist; no retry policy, no alerting |
| 1 | **scheduled feed retrieval** | **not built** — an archive is handed to the package; it fetches nothing |
| 4 | automatic category classification | **not built** |
| 5 | authorized image ingestion | **not built** |
| 7 | multi-merchant offer matching | **not built** — needs #6 first |
| 10 | commission-independent total-cost ranking | **primitives only** (`packages/shared/src/offer.ts`) |
| 11 | affiliate link generation | **not built**, and deliberately disabled |
| 12 | automatic publication of eligible products | **not built** |
| 15 | scalable database architecture | **done** for this shape — see the identity note in #125 |

The honest summary: **the pipeline can ingest and reconcile an archive
correctly. It cannot yet go and get one, classify what it finds, or match the
same product across two merchants.** Items 1, 4, 6 and 7 are the next
increment, and none of them needs a merchant approval to build.

## Why the hand-transcribed catalog is a dead end

The source-terms audit (`docs/engineering/source-terms-audit.md`) settled this.
Six of nine manufacturer domains have terms that bar reproduction, commercial
use or automated extraction with no carve-out for factual data; two could not
be read at all. **2 of 10 records are eligible**, and they are in different
categories, so side-by-side comparison — the central feature — cannot be built
on them at all.

This is not a setback to work around. It is the measurement that confirms the
automation-first design was right: an authorized feed carries reproduction
rights **with the agreement**, which is exactly what the manufacturers' terms
withhold. One authorized merchant feed has more comparable products than this
catalog will ever have.

## Next, in order

1. **Scheduled retrieval** (pipeline #1) — a Cloudflare cron that fetches an
   archive and hands it to the existing importer. The importer is done and
   tested; this is the missing front end.
2. **GTIN/MPN matching and multi-merchant offers** (#6, #7) — the prerequisite
   for comparison across merchants, and for ranking to mean anything.
3. **Auth and RBAC**, then the admin dashboard — in that order, because the
   dashboard's job is to control and monitor the automation, and an
   unauthenticated control surface for a data pipeline is worse than none.
4. **Playwright in CI** at 320/375/390/412/768/1024/1440/1920, asserting
   `window.innerWidth` — now PR #128, wired into `ci-gate` and run against
   `wrangler dev` so the Worker's CSP and waitlist are exercised too. Two
   Chromium installs failed on the dev machine, so **CI is the first place it
   actually runs** and it is not claimed as passing until it does.

## What production verification found that source review could not

The catalog shipped, and then driving the real search box on the live site
showed the placeholder read `e.g. OLED, NVMe, tenkeyless` — three terms
matching the LG television, the Samsung SSD and a keyboard, **all quarantined**.
Measured live: OLED 0 results, NVMe 0, tenkeyless 0, while `Sennheiser` → 1 and
the model number `508824` → 1.

Search was never broken. The box's own advice matched nothing, which is the
same dishonesty as a decorative control and is invisible to a test that only
asks whether search narrows. Fixed in #127 by deriving the hints from published
data, with a gate check that refuses a hard-coded `e.g. ...` literal outright.

**The lesson worth keeping:** a fixture or a hint that names a specific product
goes stale the moment eligibility changes — and eligibility will change again,
since two records are quarantined only because their terms could not be read.
Two search tests had already gone stale the same way.

## Still blocked on something engineering cannot fix

| blocker | what it stops | who |
|---|---|---|
| no affiliate network approval | any real affiliate link, commission data, referral revenue | owner — commercial agreement |
| no authorized feed beyond the two CJ exports | a live catalog rather than two archived days | owner — commercial agreement |
| legal sign-off on the two eligible records | certainty rather than a reasonable position on Sennheiser and Das Keyboard | owner — counsel |
| Keychron and Crucial terms unreadable by automation | clearing or confirming those two records | owner, or a human reading the pages |
