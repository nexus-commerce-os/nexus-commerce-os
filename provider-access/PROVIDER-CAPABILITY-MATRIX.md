# Artifact 2 — Provider Capability Matrix

**Requirements source:** the approved P0.3 thin-slice design.
**Evidence source:** official documentation only, retrieved 2026-08-01.

---

## 0. Marking rules

| Marking | Meaning |
| --- | --- |
| `SUPPORTED` | Documented, and it satisfies the design requirement as written |
| `PARTIAL` | Documented, but it does **not** fully satisfy the requirement — the gap is stated |
| `UNSUPPORTED` | Documentation shows the capability is absent |
| `UNKNOWN` | Not determinable from reachable official documentation |

**A marking of `SUPPORTED` describes the schema, never the data.** No cell in this table asserts
that merchants populate a field. Coverage is measured in artifact 3, never inferred here.

## 1. Capability matrix

| Required field | Design requirement | Impact | Evidence / gap | CJ |
| --- | --- | --- | --- | --- |
| Product title | Human-readable product name | `SUPPORTED` | `Name` | `UNKNOWN` |
| Brand | Canonical consumer-facing brand for identity resolution | `PARTIAL` | `Manufacturer` exists; no `Brand` field. Manufacturer ≠ brand in general (an ODM builds for several brands) | `UNKNOWN` |
| Model | Consumer model designation, e.g. "WH-1000XM5" | `PARTIAL` | `Mpn` is a manufacturing part number, not a model name. May require derivation from `Name`, which the design forbids treating as authoritative | `UNKNOWN` |
| GTIN | Global Trade Item Number | `SUPPORTED` | `Gtin` + `GtinType` | `UNKNOWN` |
| UPC | UPC identifier | `PARTIAL` | No `Upc` field. Expressed as `Gtin` with `GtinType == UPC` — functionally sufficient, structurally different | `UNKNOWN` |
| EAN | EAN identifier | `PARTIAL` | No `Ean` field. `Gtin` with `GtinType == EAN` | `UNKNOWN` |
| Merchant | Which merchant is making the offer | `SUPPORTED` | `AdvertiserId`, `AdvertiserName` on Catalog; `CampaignId`, `CampaignName` on both | `UNKNOWN` |
| Currency | ISO 4217 currency of the price | `SUPPORTED` | `Currency` | `UNKNOWN` |
| Price | Current consumer price | `SUPPORTED` | `CurrentPrice` (also `OriginalPrice`, `DiscountPercentage`) | `UNKNOWN` |
| Availability | In-stock signal | `SUPPORTED` | `StockAvailability` enum: InStock, OutOfStock, BackOrder, PreOrder, LimitedAvailability | `UNKNOWN` |
| Shipping eligibility | Is this offer shippable to the US destination | `UNKNOWN` | `ServiceAreas` exists on **Catalog** (geographic regions served); no documented per-item destination eligibility | `UNKNOWN` |
| **Explicit free shipping** | **Free shipping explicitly verified by provider data** | **`UNKNOWN`** | **No free-shipping boolean is documented.** Only `ShippingRate` — "standard rate to ship the item" — with no documented destination sensitivity. `ShippingRate == 0` is an *inference from a numeric field*, not an explicit eligibility statement. **This is the gate condition of §4a** | `UNKNOWN` |
| Affiliate URL | Compliant tracked deep link to the merchant | `SUPPORTED` | `POST …/Programs/{ProgramId}/TrackingLinks` with `DeepLink`; `subId1`–`subId3` / `sharedId` can carry our `click_id` | `UNKNOWN` |
| Timestamp | When this offer's price was observed | `PARTIAL` | `DateLastUpdated` is on **Catalog**, not Item. Catalog-level granularity only — see artifact 1 §4 and risk R-06 | `UNKNOWN` |
| Cache TTL | Contractual maximum caching duration | `UNKNOWN` | Contractual, not in the API reference. **Blocks `license_tag.cache_ttl_max_s`** | `UNKNOWN` |
| Display permission | Right to display price, title and image | `UNKNOWN` | Contractual, not in the API reference | `UNKNOWN` |

## 2. Design requirements not satisfiable on documentation alone

| Requirement | Status | Why |
| --- | --- | --- |
| Exact-identifier product matching | `UNKNOWN` | `Gtin` exists; the design's exact-match-only rule needs **coverage**, which is unmeasured |
| Complete all-in price | `UNKNOWN` | Depends entirely on the free-shipping row above |
| Commission-blind ranking | **Not a provider capability** | Enforced structurally in our own code; no provider field can grant or deny it |
| Condition = NEW filter | `SUPPORTED` (schema) | `Condition` enum includes New. Whether it is populated and trustworthy is `UNKNOWN` |
| US-only launch geography | `PARTIAL` | `AdvertiserLocation` / `ServiceAreas` exist at catalog level; per-offer US shippability is `UNKNOWN` |

## 3. Gate assessment

Against the §4a mandatory list:

| Mandatory field | Impact | Blocking? |
| --- | --- | --- |
| Authorized API or licensed feed | `SUPPORTED` | No |
| Merchant and offer identity | `SUPPORTED` | No |
| Product title | `SUPPORTED` | No |
| Brand | `PARTIAL` | Not yet — resolvable if `Manufacturer` proves reliable in sampling |
| Model | `PARTIAL` | Not yet — same |
| Stable product identifier | `SUPPORTED` (coverage unmeasured) | Pending §4b |
| USD price | `SUPPORTED` | No |
| Availability | `SUPPORTED` | No |
| Condition | `SUPPORTED` | No |
| Affiliate deep link | `SUPPORTED` | No |
| Freshness / retrieval timestamp | `PARTIAL` | **Possibly** — catalog granularity may be too coarse |
| Caching and display rules | `UNKNOWN` | **Yes, until obtained** |
| **Explicit free-shipping eligibility** | **`UNKNOWN`** | **Yes — this is the decisive one** |

**Gate result: NOT PASSED.** Two mandatory fields are `UNKNOWN` and one is `PARTIAL`.

Per the ruling, the gate is not passed by reasoning about it. It is passed by evidence from an
approved account, or the outcome is
**`BLOCKED — PROVIDER CANNOT SUPPORT HONEST ALL-IN COMPARISON`** and steps 1–5 re-run against CJ.
