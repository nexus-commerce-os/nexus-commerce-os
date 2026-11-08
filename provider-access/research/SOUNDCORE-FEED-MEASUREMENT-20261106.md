# Soundcore CJ product feed — real field population

> **Feed measured:** CJ subscription 323598, delivered 6 Nov 2026 23:09 Dhaka (225 records); feed export window 2026-11-06T12:25:26.620Z to .855Z (spread 0.235s).


Run 2026-11-06T22:15:16.091Z · **NON-PRODUCTION** · aggregates only, no product records retained.

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
| total data rows | 225 |
| well-formed rows | 225 |
| malformed (column count ≠ header) | 0 |
| blank rows | 0 |
| excluded — missing title | 0 |
| excluded — missing link | 0 |
| duplicates dropped | 0 |
| **VALID_UNIQUE_PRODUCT_ROWS (denominator)** | **225** |

## C. Identity

| measure | population |
|---|---|
| GTIN | 100.0% (225/225) |
| MPN | 0.0% (0/225) |
| Brand | 100.0% (225/225) |
| GTIN + Brand | 100.0% (225/225) |
| Brand + MPN | 0.0% (0/225) |
| **STRONG_IDENTITY** (GTIN or Brand+MPN) | **100.0% (225/225)** |

## D. Price / availability / media

| field | population |
|---|---|
| price (parsed as money) | 100.0% (225/225) |
| sale_price populated | 100.0% (225/225) |
| sale_price < price | 51.1% (115/225) |
| availability | 100.0% (225/225) |
| condition | 100.0% (225/225) |
| link | 100.0% (225/225) |
| image_link | 100.0% (225/225) |
| item_group_id | 0.0% (0/225) |

## E. Shipping — the hard gate

| measure | value |
|---|---|
| SHIPPING_FIELD_POPULATED | 0.0% (0/225) |
| **L2_USABLE_SHIPPING** | **0.0% (0/225)** |
| PARTIAL_SHIPPING | 0.0% (0/225) |
| MISSING_SHIPPING | 100.0% (225/225) |
| records naming US | 0.0% (0/225) |
| **US_L2_USABLE** | **0.0% (0/225)** |

No `shipping` values present at all — nothing to characterise.

## F. Delivered-cost readiness

- **PRICE_PLUS_US_L2_SHIPPING: 0.0% (0/225)**
- **MANDATORY_FEES: NOT AVAILABLE** — the Shopping feed
  has no unavoidable-fee column, so `price + shipping` is **not** a verified checkout total.

## G. Category breakdown (from feed evidence only)

| category | N | strong identity | price | availability | US L2 shipping |
|---|---|---|---|---|---|
| headphones | 27 | 100.0% (27/27) | 100.0% (27/27) | 100.0% (27/27) | 0.0% (0/27) |
| earbuds | 84 | 100.0% (84/84) | 100.0% (84/84) | 100.0% (84/84) | 0.0% (0/84) |
| speakers | 44 | 100.0% (44/44) | 100.0% (44/44) | 100.0% (44/44) | 0.0% (0/44) |
| accessories | 18 | 100.0% (18/18) | 100.0% (18/18) | 100.0% (18/18) | 0.0% (0/18) |
| other | 52 | 100.0% (52/52) | 100.0% (52/52) | 100.0% (52/52) | 0.0% (0/52) |

## H. Link structure

- **LINK_TYPE = MIXED** (sampled 200 links, structural inspection only — none followed)
- CJ tracking hosts seen: 200 · direct soundcore/anker hosts seen: 200
- mobile_link column: present

## I. Gates (HonestTotal internal thresholds, not CJ or Soundcore requirements)

- STRONG_IDENTITY >= 90%: **PASS** — 100.0% (225/225)
- VALID PRICE >= 90%: **PASS** — 100.0% (225/225)
- AVAILABILITY >= 90%: **PASS** — 100.0% (225/225)
- US_L2_SHIPPING >= 90%: **FAIL** — 0.0% (0/225)
- PRICE + US L2 SHIPPING >= 90%: **FAIL** — 0.0% (0/225)

> Technical data fitness only. This authorises no production activation, no affiliate link,
> and no change to the merchant registry.