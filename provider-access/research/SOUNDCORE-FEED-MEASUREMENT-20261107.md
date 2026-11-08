# Soundcore CJ product feed — real field population

> **Feed measured:** CJ subscription 323598, delivered 7 Nov 2026 22:37 Dhaka (226 records); feed export window 2026-11-07T12:22:42.735Z to .961Z (spread 0.226s); CJ processing stamp 2026-11-07 08:37. Archive md5 6d980f547cf691c6c84fea6b995daa2a.


Run 2026-11-08T06:58:58.355Z · **NON-PRODUCTION** · aggregates only, no product records retained.

## A. Actual feed schema

**ACTUAL_HEADERS_FOUND (87):**

```
PROGRAM_NAME
PROGRAM_URL
CATALOG_NAME
LAST_UPDATED
ID
TITLE
DESCRIPTION
LINK
IMPRESSION_URL
IMAGE_LINK
MOBILE_LINK
ADDITIONAL_IMAGE_LINK
AVAILABILITY
AVAILABILITY_DATE
EXPIRATION_DATE
PRICE
SALE_PRICE
SALE_PRICE_EFFECTIVE_DATE
UNIT_PRICING_MEASURE
UNIT_PRICING_BASE_MEASURE
INSTALLMENT
LOYALTY_POINTS
GOOGLE_PRODUCT_CATEGORY
GOOGLE_PRODUCT_CATEGORY_NAME
PRODUCT_TYPE
BRAND
GTIN
MPN
IDENTIFIER_EXISTS
CONDITION
ADULT
MULTIPACK
IS_BUNDLE
ENERGY_EFFICIENCY_CLASS
AGE_GROUP
COLOR
GENDER
MATERIAL
PATTERN
SIZE
SIZE_TYPE
SIZE_SYSTEM
ITEM_GROUP_ID
CUSTOM_LABEL_0
CUSTOM_LABEL_1
CUSTOM_LABEL_2
CUSTOM_LABEL_3
CUSTOM_LABEL_4
PROMOTION_ID
SHIPPING_LABEL
SHIPPING_WEIGHT
SHIPPING_LENGTH
SHIPPING_WIDTH
SHIPPING_HEIGHT
MINHANDLINGTIME
MAXHANDLINGTIME
PRODUCT_LENGTH
PRODUCT_WIDTH
PRODUCT_HEIGHT
PRODUCT_WEIGHT
PRODUCT_HIGHLIGHT
ADS_REDIRECT
SHOPPING_ADS_EXCLUDED_COUNTRY
SHIPS_FROM_COUNTRY
TRANSIT_TIME_LABEL
COST_OF_GOODS_SOLD
SHIPPING(COUNTRY:REGION:SERVICE:PRICE)
SHIPPING(MIN_HANDLING_TIME)
SHIPPING(MAX_HANDLING_TIME)
SHIPPING(PRICE)
SHIPPING(COUNTRY)
SHIPPING(MIN_TRANSIT_TIME)
SHIPPING(MAX_TRANSIT_TIME)
SHIPPING(COUNTRY:POSTAL_CODE:SERVICE:PRICE)
SHIPPING(COUNTRY:LOCATION_ID:SERVICE:PRICE)
SHIPPING(COUNTRY:LOCATION_GROUP_NAME:SERVICE:PRICE)
TAX(RATE:COUNTRY:TAX_SHIP:REGION)
TAX(RATE:COUNTRY:TAX_SHIP:POSTAL_CODE)
TAX(RATE:COUNTRY:TAX_SHIP:LOCATION_ID)
TAX(RATE:COUNTRY:TAX_SHIP:LOCATION_GROUP_NAME)
SUBSCRIPTION_COST(PERIOD)
SUBSCRIPTION_COST(PERIOD_LENGTH)
SUBSCRIPTION_COST(AMOUNT)
PRODUCT_DETAIL(SECTION_NAME)
PRODUCT_DETAIL(ATTRIBUTE_NAME)
PRODUCT_DETAIL(ATTRIBUTE_VALUE)
CERTIFICATION(CERTIFICATION_AUTHORITY:CERTIFICATION_NAME:CERTIFICATION_CODE:CERTIFICATION_VALUE)
```

**Logical mapping (only columns that exist):**

| logical field | feed column |
|---|---|
| id | `id` |
| gtin | `gtin` |
| mpn | `mpn` |
| brand | `brand` |
| title | `title` |
| item_group_id | `item_group_id` |
| price | `price` |
| sale_price | `sale_price` |
| availability | `availability` |
| condition | `condition` |
| link | `link` |
| mobile_link | `mobile_link` |
| shipping | `SHIPPING(COUNTRY:REGION:SERVICE:PRICE)` |
| shipping_price | `SHIPPING(PRICE)` |
| shipping_country | `SHIPPING(COUNTRY)` |
| shipping_label | `shipping_label` |
| shipping_weight | `shipping_weight` |
| image_link | `image_link` |
| expiration_date | `expiration_date` |
| product_type | `product_type` |

## B. Dataset quality

| metric | value |
|---|---|
| total data rows | 226 |
| well-formed rows | 226 |
| malformed (column count ≠ header) | 0 |
| blank rows | 0 |
| excluded — missing title | 0 |
| excluded — missing link | 0 |
| duplicates dropped | 0 |
| **VALID_UNIQUE_PRODUCT_ROWS (denominator)** | **226** |

## C. Identity

| measure | population |
|---|---|
| GTIN | 100.0% (226/226) |
| MPN | 0.0% (0/226) |
| Brand | 100.0% (226/226) |
| GTIN + Brand | 100.0% (226/226) |
| Brand + MPN | 0.0% (0/226) |
| **STRONG_IDENTITY** (GTIN or Brand+MPN) | **100.0% (226/226)** |

## D. Price / availability / media

| field | population |
|---|---|
| price (parsed as money) | 100.0% (226/226) |
| sale_price populated | 100.0% (226/226) |
| sale_price < price | 50.9% (115/226) |
| availability | 100.0% (226/226) |
| condition | 100.0% (226/226) |
| link | 100.0% (226/226) |
| image_link | 100.0% (226/226) |
| item_group_id | 0.0% (0/226) |

## E. Shipping — the hard gate

| measure | value |
|---|---|
| SHIPPING_FIELD_POPULATED | 0.0% (0/226) |
| **L2_USABLE_SHIPPING** | **0.0% (0/226)** |
| PARTIAL_SHIPPING | 0.0% (0/226) |
| MISSING_SHIPPING | 100.0% (226/226) |
| records naming US | 0.0% (0/226) |
| **US_L2_USABLE** | **0.0% (0/226)** |

No `shipping` values present at all — nothing to characterise.

## F. Delivered-cost readiness

- **PRICE_PLUS_US_L2_SHIPPING: 0.0% (0/226)**
- **MANDATORY_FEES: NOT AVAILABLE** — the Shopping feed
  has no unavoidable-fee column, so `price + shipping` is **not** a verified checkout total.

## G. Category breakdown (from feed evidence only)

| category | N | strong identity | price | availability | US L2 shipping |
|---|---|---|---|---|---|
| headphones | 27 | 100.0% (27/27) | 100.0% (27/27) | 100.0% (27/27) | 0.0% (0/27) |
| earbuds | 84 | 100.0% (84/84) | 100.0% (84/84) | 100.0% (84/84) | 0.0% (0/84) |
| speakers | 44 | 100.0% (44/44) | 100.0% (44/44) | 100.0% (44/44) | 0.0% (0/44) |
| accessories | 19 | 100.0% (19/19) | 100.0% (19/19) | 100.0% (19/19) | 0.0% (0/19) |
| other | 52 | 100.0% (52/52) | 100.0% (52/52) | 100.0% (52/52) | 0.0% (0/52) |

## H. Link structure

- **LINK_TYPE = MIXED** (sampled 200 links, structural inspection only — none followed)
- CJ tracking hosts seen: 200 · direct soundcore/anker hosts seen: 200
- mobile_link column: present

## I. Gates (HonestTotal internal thresholds, not CJ or Soundcore requirements)

- STRONG_IDENTITY >= 90%: **PASS** — 100.0% (226/226)
- VALID PRICE >= 90%: **PASS** — 100.0% (226/226)
- AVAILABILITY >= 90%: **PASS** — 100.0% (226/226)
- US_L2_SHIPPING >= 90%: **FAIL** — 0.0% (0/226)
- PRICE + US L2 SHIPPING >= 90%: **FAIL** — 0.0% (0/226)

## J. Brand and category columns — manual finding, 8 Nov 2026

Added by hand after the automated run, because the automated gates read `Brand` as
"populated" and that is misleading.

`BRAND` is the constant string `Soundcore` on **all 226 rows**, but the subscription
delivers Anker's wider portfolio, not Soundcore's. Classifying by what the title
actually names:

| Token found in TITLE | Rows | Share |
|---|---|---|
| contains `anker` | 58 | 25.7% |
| contains `soundcore` | 166 | 73.5% |
| — of which **both** tokens (e.g. "Anker Soundcore …") | **24** | 10.6% |
| **contains `eufy`** | **5** | **2.2%** |
| no brand token in the title | 21 | 9.3% |

**Correction, 8 Nov 2026 — this table was precedence-dependent and read as a brand census.**
24 titles contain both `anker` and `soundcore`, so the earlier `142 / 58` figures are the
*Anker-first* classification; checking `soundcore` first gives `166 / 34` from the same 226
rows. Only **eufy (5)** and **unlabelled (21)** are stable under either order. These are
title-substring counts and are **not** verified manufacturer identity.

**Five rows name `eufy` in the title** — home security, robot vacuum, smart lock,
outdoor lighting and personal care, i.e. not accessories but products of a different
Anker sub-brand, at prices roughly an order of magnitude above the earbud records.
**Identifiers and individual prices are deliberately not recorded in this repository.**

*Reproduce it:* count rows whose `TITLE` contains `eufy` (case-insensitive) while
`BRAND` reads `Soundcore`. On the 7 Nov export: **5 of 226**, with `BRAND` constant
across all 226. That is the entire finding; no product record is required to confirm it.

**Consequence.** `BRAND` must not be displayed, filtered or ranked on. Doing so would
label a eufy robot vacuum as a Soundcore product, which is a false statement about a
real company's product and the same class of error that gets listings rejected.
`STRONG_IDENTITY` is unaffected: it passes on `GTIN` (100%), never on `Brand + MPN`
(0%, because MPN is empty everywhere).

**Nothing uses the column today — this is a latent trap, not a live defect.** Checked on
the 7 Nov build: the card's "Sold by" value comes from the merchant registry
(`merchantName`), not from the feed, so the bad value is not propagated anywhere. The
column is a hazard only for work that has not been written yet.

**Correction to an earlier note of mine.** I previously wrote that all 226 tracking links
"resolve to" `www.soundcore.com` and treated that as evidence that "Sold by Soundcore" is
true for every row. Both halves were overstated. **No link was followed** — the host was
read out of the `url=` query parameter of the CJ tracking URL, which is a structural
reading of a string, not a resolution. And a shared destination host would not establish
merchant identity even if it had been followed: who sells, ships, invoices and accepts
returns for a eufy robot vacuum is **UNKNOWN** from this feed. "Sold by Soundcore" stands
on the merchant-registry entry and the CJ advertiser relationship, not on the URL. The
host observation also authorises nothing about images.

`GOOGLE_PRODUCT_CATEGORY_NAME` **and** `GOOGLE_PRODUCT_CATEGORY` are **empty on all 226
rows** — no standard taxonomy and no taxonomy ID. Section G's categories are derived here
from feed evidence, and are ours, not Soundcore's.

**Correction, 8 Nov 2026.** `PRODUCT_TYPE` is **not** empty: free text on **168/226 rows
(74.3%)**, 19 distinct values, inconsistently cased, including vendor-internal strings
(`TTshop earbuds`) and non-categories (`Series 7`). So the merchant does supply *a* category
field; what it does not supply is a *taxonomy*. The field is absent on 58 rows, uncontrolled
and non-hierarchical, and must not be used as a taxonomy — but the flat statement "supplies
no category taxonomy" was imprecise and is corrected here.

**Column counting, stated explicitly so it is auditable.** 15 column names contain
`SHIPPING`, 4 contain `TAX`, and 3 more carry delivery timing (`MINHANDLINGTIME`,
`MAXHANDLINGTIME`, `TRANSIT_TIME_LABEL`): **22**, plus `SHIPS_FROM_COUNTRY` as a 23rd.
**All 23 are 0/226.** A "19 shipping-related fields" count quoted elsewhere is the 15 + 4
subtotal. `MPN` is also 0/226, so identity rests entirely on `GTIN` (226/226).

> Technical data fitness only. This authorises no production activation, no affiliate link,
> and no change to the merchant registry.