# Commerce platform — development checklist

The working list for turning HonestTotal from an honest landing page into a
commerce discovery platform. It exists so that work can resume accurately
after a gap: each item says what is done, what is not, and what is blocked on
something no amount of engineering will unblock.

**Ground rule, which outranks every item below:** no fabricated prices,
merchants, reviews, availability or affiliate relationships, ever. Synthetic
fixtures live in tests and are labelled as such. A feature that cannot be
honest yet stays disabled rather than shipping a plausible-looking lie.

Last updated: 25 November 2026.

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
| ⬜ | `Offer` type per `docs/06 §4`, deterministic `offer_id` | next batch |
| ⬜ | all-in price: item + shipping + tax, in one currency | next batch |
| ⬜ | `PriceObservation` and `PriceHistory` + analysis (min/max/trailing low, volatility) | next batch |
| ⬜ | regional availability | next batch |
| ⬜ | product variants | next batch |
| ⬜ | offer and product validation | next batch |
| ⬜ | CSV and JSON import/export | next batch |

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
| ⬜ | **mobile navigation** — `.nav-links` is hidden below 820px with no menu | the footer carries all 19 links, so nothing is unreachable, but there is no header nav on a phone |
| ⬜ | shorten the home page | currently 7,251px tall at 1280 wide |
| ⬜ | search-first discovery surface | search exists on the withheld catalog page |
| ⬜ | category navigation | — |
| ⬜ | comparison layout | — |
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
