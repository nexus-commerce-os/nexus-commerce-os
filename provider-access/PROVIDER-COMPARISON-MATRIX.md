# Artifact 1 — Provider Comparison Matrix

**Scope:** Impact and CJ Affiliate only. **Sources:** official vendor documentation only.
**Retrieved:** 2026-08-01. **Status:** partial — completion requires an approved account.

> **No connector code exists and none is authorized.** This is a documentation-gathering artifact.

---

## 0. How to read this table

Every cell is one of:

| Marking | Meaning |
| --- | --- |
| A quoted value with a source link | Stated in official documentation, retrieved on the date above |
| `UNKNOWN` | Not found in publicly reachable official documentation. **Never a guess.** |
| `UNKNOWN — ACCOUNT REQUIRED` | Documentation exists but sits behind authentication |

**The single most important caveat, and it applies to every row below:**

> **A field existing in a provider's schema is not evidence that merchants populate it.**
> Schema presence is a *ceiling* on what we can know, never a floor. Actual coverage is `UNKNOWN`
> until sampled from a real account (artifact 3, and §4b of the readiness check).

## 1. Retrieval evidence — why the two columns are not equally full

| Provider | Documentation reachability | Consequence |
| --- | --- | --- |
| **Impact** | `integrations.impact.com` publishes server-rendered Markdown mirrors (`…/page.md`), a `sitemap.xml` and an `llms.txt` index | Field-level detail was retrievable without an account |
| **CJ** | `developers.cj.com` returned a client-rendered application shell containing only the text "CJ Developer Portal" on **every** route tried: `/docs`, `/docs/data-imports/product-feeds`, `/graphql/reference/Product Feed`, `/sitemap.xml`, `/llms.txt` | Field-level detail is **not** publicly retrievable; nearly every CJ cell is `UNKNOWN — ACCOUNT REQUIRED` |

**This asymmetry is about documentation access, not product quality.** CJ is not worse than Impact;
CJ is *unverified*. Treating "more UNKNOWNs" as "less capable" would be exactly the unevidenced
inference this project rejects. The comparison cannot be concluded from public sources alone.

## 2. Comparison matrix

| # | Attribute | Impact | CJ Affiliate |
| --- | --- | --- | --- |
| 1 | Account approval process | `UNKNOWN` — not stated in the API reference | `UNKNOWN` — portal states only that you "must be logged in to create personal access tokens" |
| 2 | Countries supported | `UNKNOWN` — API reference does not enumerate them. Catalog model exposes `AdvertiserLocation` and `ServiceAreas` | `UNKNOWN` |
| 3 | API availability | **Yes.** REST, Partner API Reference **v16**; "returns XML-encoded or JSON-encoded responses" | **Yes.** GraphQL, per the portal's Product Feed / Product Search references (schema not retrievable) |
| 4 | Product feed availability | **Yes** — partner-side Catalogs endpoints (row 7) | **Yes** — a Product Feed GraphQL API is referenced. Note the separate "Product Import API" is **advertiser-side** (sending a feed *in*), not publisher consumption |
| 5 | Authentication method | **HTTP Basic.** `AccountSID` = username, `AuthToken` = password, Base64 in the `Authorization` header. Created at *User profile → Settings → Technical → API → Create Access Token* | **Personal Access Token** — "a unique identification string for your account that allows for secure authentication when accessing the CJ APIs" |
| 6 | Affiliate deep link support | **Yes.** `POST /Mediapartners/{AccountSID}/Programs/{ProgramId}/TrackingLinks` with a `DeepLink` parameter — "the exact destination URL the tracking link should redirect to after attribution" | `UNKNOWN — ACCOUNT REQUIRED` |
| 7 | Merchant catalog support | **Yes.** `GET /Mediapartners/{AccountSID}/Catalogs`, `…/Catalogs/{Id}`, `…/Catalogs/{CatalogId}/Items`, `…/Catalogs/{CatalogId}/Items/{Id}`, `…/Catalogs/ItemSearch` | `UNKNOWN — ACCOUNT REQUIRED` |
| 8 | Product identifiers (GTIN/UPC/EAN) | **Documented:** `Gtin` plus `GtinType` (enum: EAN, UPC, ISBN, JAN). Also `Asin`, `Mpn`. **No separate UPC/EAN fields** — the type is a discriminator on `Gtin`. **Coverage `UNKNOWN`** | `UNKNOWN — ACCOUNT REQUIRED` |
| 9 | Brand | **`Manufacturer`** — "the person or group that makes the item". There is **no field named `Brand`**; whether `Manufacturer` is reliably the consumer-facing brand is `UNKNOWN` | `UNKNOWN — ACCOUNT REQUIRED` |
| 10 | Model | **`Mpn`** (Manufacturing Part Number). No field named `Model`; MPN is a manufacturer part code, which is **not the same thing** as a consumer model designation | `UNKNOWN — ACCOUNT REQUIRED` |
| 11 | Price | **`CurrentPrice`**, `OriginalPrice`, `DiscountPercentage` | `UNKNOWN — ACCOUNT REQUIRED` |
| 12 | Currency | **`Currency`** — ISO 4217, on both Catalog and Item | `UNKNOWN — ACCOUNT REQUIRED` |
| 13 | Shipping information | **`ShippingRate`** — "standard rate to ship the item". Plus `ShippingWeight/Length/Width/Height` (+ units), `ShippingLabel`, `EstimatedShipDate`. **No documented ZIP/destination sensitivity** — see §3 | `UNKNOWN — ACCOUNT REQUIRED` |
| 14 | Free shipping availability | **`UNKNOWN` — no explicit free-shipping boolean is documented.** Under **Ruling 1**, `ShippingRate == 0` qualifies **only** if the provider documents that zero means free shipping; otherwise `UNKNOWN` and not rankable. See §3 — this is the P0.3 blocker | `UNKNOWN — ACCOUNT REQUIRED` |
| 15 | Availability field | **`StockAvailability`** — enum: InStock, OutOfStock, BackOrder, PreOrder, LimitedAvailability. Also `Inventory` | `UNKNOWN — ACCOUNT REQUIRED` |
| 16 | Product image policy | Fields `ImageUrl` and `AdditionalImageUrls` are documented. The **display/licensing policy** governing their use is `UNKNOWN — ACCOUNT REQUIRED` (contractual, not in the API reference) | `UNKNOWN — ACCOUNT REQUIRED` |
| 17 | Cache policy | `UNKNOWN — ACCOUNT REQUIRED` — contractual. **Blocks `license_tag.cache_ttl_max_s`** | `UNKNOWN — ACCOUNT REQUIRED` |
| 18 | Display policy | `UNKNOWN — ACCOUNT REQUIRED` — contractual | `UNKNOWN — ACCOUNT REQUIRED` |
| 19 | Rate limits | **Documented per endpoint group, hourly:** Product Search (`Catalogs/ItemSearch`, `Catalogs/*/Items`) **3,000**; performance detail **500**; performance aggregate **250**; other **1,000**. Daily: Report Export **100**, Click Export **10**. Exceeding returns **429** with `X-RateLimit-Limit-hour`, `X-RateLimit-Remaining-hour`, `RateLimit-Reset`, `Retry-After`. Documentation states limits are "subject to change at any given time" | `UNKNOWN — ACCOUNT REQUIRED` |
| 20 | Attribution model | `UNKNOWN` — `TrackingLinks` accepts `subId1`–`subId3` and `sharedId`, "surfaced as a column in partner performance reports", which is the mechanism our `click_id` would ride. The **attribution rules themselves** (window, last-click vs other) are `UNKNOWN — ACCOUNT REQUIRED` | `UNKNOWN — ACCOUNT REQUIRED` |
| 21 | Sandbox availability | `UNKNOWN` — no sandbox or test mode found in the public reference | `UNKNOWN — ACCOUNT REQUIRED` |
| 22 | Reporting API | **Yes** — Reports, Actions, Clicks endpoint groups appear in the rate-limit table and the reference sitemap | `UNKNOWN — ACCOUNT REQUIRED` |
| 23 | Webhook / postback support | `UNKNOWN` — not confirmed in the pages retrieved | `UNKNOWN — ACCOUNT REQUIRED` |
| 24 | Known restrictions | Vanity tracking links capped at **5,000 per account**; exceeding returns **403 Forbidden**. Rate limits per row 19 | `UNKNOWN — ACCOUNT REQUIRED` |

## 3. The finding that decides P0.3 — shipping

Impact documents `ShippingRate`, described as the **"standard rate to ship the item"**.

Three things follow, and none of them may be softened:

1. **It is not destination-specific.** Nothing in the documentation describes ZIP or address
   sensitivity. This confirms §1 of the readiness check: the "Shipping included for ZIP `<ZIP>`"
   claim cannot be substantiated from this feed, which is why the ruling of 2026-08-01 forbade it.
2. **There is no explicit free-shipping flag — and Ruling 1 has now settled what that means.**
   `ShippingRate` alone **shall not** be interpreted as verified free-shipping eligibility. Only two
   readings are accepted: `ShippingRate == 0` **together with** provider documentation stating that
   zero represents free shipping, or a dedicated free-shipping flag. Anything else — missing, null,
   or an undocumented zero — is `UNKNOWN`, and an `UNKNOWN` offer is **NOT RANKABLE**. Undocumented
   provider behaviour is never a substitute for documentation.
3. **Population is unmeasured.** `ShippingRate` may be absent on most headphone records. Under the
   binding rule — **absent shipping data is never treated as zero** — every such offer is
   unrankable. If coverage is near zero, the honest outcome is
   **`BLOCKED — PROVIDER CANNOT SUPPORT HONEST ALL-IN COMPARISON`**.

**This cannot be resolved from documentation.** It requires the §4b sample against a real account.

## 4. Second finding — item freshness granularity

`DateLastUpdated` is documented on the **Catalog** model. **No per-item timestamp** appears on the
Item model in the pages retrieved.

**Ruling 2 (2026-08-01): catalog-level timestamps shall not be treated as item freshness.** Until
provider evidence proves otherwise, offer freshness state is `UNKNOWN`, and **unknown freshness
cannot become LIVE**. If the provider exposes only catalogue timestamps, that is recorded as an
**external provider limitation** — item timestamps are never invented, and a catalogue refresh time
is never presented as the moment a price was observed. Carried as risk **R-06**; confirmed or
refuted in step 5.

## 5. Sources

All retrieved 2026-08-01. Impact Markdown mirrors are the server-rendered form of the same pages.

- Impact — [Partner API Reference v16](https://integrations.impact.com/partner-api-reference/readme.md)
- Impact — [Authentication](https://integrations.impact.com/partner-api-reference/readme/authentication.md)
- Impact — [Rate Limits](https://integrations.impact.com/partner-api-reference/readme/rate-limits.md)
- Impact — [Catalogs endpoints](https://integrations.impact.com/partner-api-reference/reference/catalogs/catalogs.md)
- Impact — [Catalog and Item models](https://integrations.impact.com/partner-api-reference/reference/catalogs/models.md)
- Impact — [Catalog Items (brand reference)](https://integrations.impact.com/brand-api-reference/reference/catalogs/catalog-items.md)
- Impact — [Tracking Links](https://integrations.impact.com/partner-api-reference/reference/tracking-links/tracking-links.md)
- CJ — [Personal Access Tokens](https://developers.cj.com/account/personal-access-tokens)
- CJ — [Product Feeds](https://developers.cj.com/docs/data-imports/product-feeds) *(app shell — not retrievable)*
- CJ — [Product Feed API Reference](https://developers.cj.com/graphql/reference/Product%20Feed) *(app shell — not retrievable)*

## 6. Outcome

**Impact:** documented capability is sufficient to *evaluate*, insufficient to *implement against*.
Rows 1, 2, 14, 17, 18, 20, 21, 23 remain open, and rows 17–18 are contractual gates.

**CJ:** cannot be compared from public sources. Not disqualified — unverified.

**Neither provider can be selected on this evidence.** Proceed to step 1 of the authorized sequence.
