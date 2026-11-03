# Artifact 8 — Risk Register

**External risks only** — things outside our code that can stop or invalidate P0.3.

> **No mitigation in this register may involve fabricated data.** Not a mock provider, not a
> simulated response, not an assumed field, not a "temporary" placeholder value. Where the honest
> mitigation is *stop*, the register says stop.

---

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
| --- | --- | --- | --- | --- | --- |
| **R-01** ⚠️ **MATERIALISED 2026-08-05** | **Provider approval delayed or refused.** Affiliate networks approve accounts, then approve merchants individually | **Occurred** | **Blocks P0.3 entirely** | Impact created the account and verified the property, then **declined the Marketplace application** — insufficient traffic/audience, per their published reasons. Direct brand sign-up links and brand invitations still work, so the account is usable. Options, in order: build real content and traffic then re-apply; join brands directly by their own sign-up links; or apply to CJ per the ratified sequence. **No connector is written meanwhile, and no provider is simulated** | Founder |
| **R-02** | **Rate limits change.** Impact's documentation states limits are "subject to change at any given time" | Medium | Degraded or failing catalogue reads | Read limits from response headers (`X-RateLimit-*`, `Retry-After`) at runtime rather than hard-coding; treat 429 as a first-class outcome, not an exception | Engineering |
| **R-03** | **Affiliate relationship terminated**, or a merchant leaves the programme | Low–Medium | Offers vanish; comparisons thin out | Connector-agnostic port (design §3) so a second network can be added without touching the domain. ADR-0008 failover is the P0.3 exit gate, not this slice | Engineering |
| **R-04** | **Insufficient GTIN coverage** in over-ear headphones | **Unknown — this is why we sample** | Exact-match identity resolution yields too few products to demonstrate anything | Measure it (§4b) before implementing. If coverage is too low, **stop and report**. **No fuzzy or AI matching is authorized to compensate** | Engineering |
| **R-05** | **Missing or non-explicit shipping data.** Impact documents `ShippingRate` but no explicit free-shipping eligibility, and no destination sensitivity | **High** | **The qualification gate fails; the slice cannot make an honest all-in claim** | Per **Ruling 1**, accept only a documented zero-means-free-shipping rule or a dedicated flag; an undocumented zero is `UNKNOWN` and not rankable. If absent → **`BLOCKED — PROVIDER CANNOT SUPPORT HONEST ALL-IN COMPARISON`**, re-run steps 1–5 against CJ. **The ranking rules are not weakened to force a demonstration** | Engineering |
| **R-06** | **Freshness granularity too coarse.** `DateLastUpdated` is on the Catalog; no per-item timestamp was found | Medium | Three-tier freshness and the NFR-COMP-01 price-claim audit lose per-offer precision | Per **Ruling 2**, freshness state stays `UNKNOWN` until provider evidence proves item-level timestamps exist, and **unknown freshness can never become LIVE**. A catalogue-only timestamp is recorded as an external provider limitation. **Item timestamps are never invented**, and a catalogue refresh time is never presented as a per-offer observation time | Engineering |
| **R-07** | **Display-licence restrictions** on price, image or trademark use | Medium | Parts of the UI may be contractually impermissible | Obtain written display terms before implementation (checklist item 8). Do not display anything whose permission is `UNKNOWN` | Founder / Engineering |
| **R-08** | **Caching terms tighter than the architecture assumes** | Medium | `license_tag.cache_ttl_max_s` may force near-live fetching, changing cost and latency | Read the contractual cap and set the value from it. **Never choose the TTL for performance reasons** | Engineering |
| **R-09** | **Merchant catalogue too narrow.** Approved merchants may carry few or no over-ear headphones | Medium | Nothing meaningful to compare even with a working connector | Confirm merchant list and category depth (checklist item 10) before implementing | Founder |
| **R-10** | **Identity fields do not mean what their names suggest.** `Manufacturer` may not be the consumer brand; `Mpn` is not a model designation | Medium | Wrong product grouping — two different products merged, or one product split | Verify semantics against real records; leave the mapping `Unknown? = YES` until proven. Do not derive brand or model from titles without an approved, recorded rule | Engineering |
| **R-11** | **Attribution model unknown** — window and rules are not publicly documented | Medium | Savings verification and the click-out ledger (ADR-0011) depend on attribution we have not read | Obtain written attribution terms (checklist item 9) before any conversion accounting is designed | Founder |
| **R-12** | **CJ cannot be evaluated without an account** — the developer portal is client-rendered on every public route | **Confirmed** | Provider comparison cannot be completed from public sources; a decision made now would rest on nothing | Accept that the comparison finishes only after account access. **Do not fill CJ cells from recollection or third-party summaries** | Engineering |

## Risks explicitly *not* listed

- **"Connector might have bugs"** — internal, not external, and not a risk register entry.
- **"Provider data might be wrong"** — real, but handled structurally: validation rejects and counts
  bad records rather than coercing them.

## Standing rule

If a risk materialises and the only way forward is invented data, **that is not a way forward**. The
correct outcome is a `BLOCKED` status with the evidence attached.
