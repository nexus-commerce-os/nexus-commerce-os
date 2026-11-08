# Soundcore — CJ Affiliate Compliance Record

**Created:** 8 August 2026 · **Last verified:** 8 November 2026
**Scope:** this file records the state of one advertiser relationship. It grants nothing and
approves nothing. It exists so that "are we allowed to publish a Soundcore link yet?" has a written
answer instead of a recollection.

> This record does **not** change P0.3 status. P0.3 remains **BLOCKED**. The reason changed on
> 6 Sep 2026 and the change is worth stating precisely: the blocker is no longer *provider access*
> — that is now obtained and proven — it is **provider data fitness**. The feed was retrieved and
> measured, and it carries **no shipping data at all**, so no Soundcore offer can hold an all-in
> delivered price. See §Data fitness below.
>
> **Re-confirmed, not assumed.** The shipping gap has now been measured on **six separate
> exports** between 4 Sep and 7 Nov 2026 — 0/228, 0/227, 0/225, 0/224, 0/225, 0/226. It is
> structural, not a stale file. A **second, independent** blocker has since appeared and is
> not a data question at all: **permission to display the feed's product images is UNKNOWN**
> (§Image and media rights).

**Five things this record keeps separate, because collapsing any two of them produces a false
claim:**

| Dimension | Soundcore state | Evidence |
| --- | --- | --- |
| **Approval** — will the advertiser work with us | **APPROVED / ACTIVE** | CJ relationship, 3 Sep 2026 |
| **Data access** — can we actually retrieve the feed | **VERIFIED** | one-off subscription 320962 parsed 6 Sep 2026; recurring subscription 323598 delivering daily since, latest 7 Nov 2026 |
| **Data quality** — is the retrieved data fit for our method | **INSUFFICIENT** | shipping 0/226 on the latest export, and 0/N on all six measured; see §Data fitness |
| **Ranking eligibility** — may these offers enter all-in ranking | **INELIGIBLE** | `MISSING_REQUIRED_SHIPPING_DATA` |
| **Media rights** — may we display the images the feed references | **UNKNOWN** | written request sent to `affiliate@anker.com` 6 Nov 2026; no reply as of 8 Nov 2026; see §Image and media rights |

---

## Relationship

| Field | Value |
| --- | --- |
| Network | CJ Affiliate |
| Advertiser | Soundcore |
| Advertiser ID | `7382109` |
| Status | **APPROVED / ACTIVE** (3 September 2026) — first approved merchant |
| Product feed | **VERIFIED** — CJ Product Feed, Shopping/Google format, United States \| English \| USD. One-off export subscription `320962` (Sep 2026); **recurring** subscription `323598`, "Soundcore catalog - recurring", delivering daily by email since Oct 2026 |
| Public affiliate relationship claim allowed | **NOT EXERCISED** — no public merchant surface exists, and none is authorised by this record |
| Affiliate links allowed | **NO** — blocked on data fitness, not on approval |
| Tracking URL available | **IN FEED, UNVERIFIED** — see §Link structure |

The application was visible under CJ *Pending Applications* from 8 Aug 2026 and was **approved on
3 September 2026**. Approval was verified in the CJ relationship view, not inferred from an email.

---

## Current Program Information

| Field | Value |
| --- | --- |
| Advertiser legal entity | **Fantasia Trading LLC** (Anker's US entity) |
| Advertiser contact | Soundcore Affiliate Team — `affiliate@anker.com` |
| Advertiser site | https://www.soundcore.com/ |
| Joined CJ network | 22 Feb 2025 |
| Category | Consumer Electronics |
| Serviceable Area | United States |
| Currency | USD |
| Displayed Commission | 7% Sale |

**Network-wide advertiser statistics** observed in CJ on 10 Aug 2026. These are the
*advertiser's* figures across all CJ publishers — they are **not** HonestTotal's
performance, HonestTotal has none, and they must never be quoted as ours:

| Stat | Value |
| --- | --- |
| 3-month EPC | 25.94 USD |
| 7-day EPC | 13.97 USD |
| Top conversion country | United States, 92.93% |

The 92.93% US concentration corroborates the US-only serviceable area and matches
HonestTotal's stated launch market.

> The displayed commission was observed in CJ while the application was pending. It was
> **re-verified against the active Program Terms on 6 Sep 2026 after approval and is unchanged**:
> 7% flat, 30-day referral, 60-day lock.

---

## Program Terms — verified 10 Aug 2026

Read from the CJ **Program Terms** tab while the application was pending. CJ exposes terms before
approval, so this is the real document, not a summary. Terms can change; re-read before activation.

### Commercial terms

| Term | Value | Why it matters here |
| --- | --- | --- |
| Offer | (Default) Soundcore US — 7% Standard Commission | |
| Action | Sales — a customer places an order | |
| Commission | **7.00%** flat | Confirms the dashboard figure; not tiered |
| Referral period | **30 days** | The attribution window |
| Occurrences | Unlimited | |
| Locking method | **Custom — 60 days after event date** | The hold before a commission locks |

The 30-day referral period and 60-day lock are the first **real** merchant windows this project has
seen. They map directly onto the four-state model on `/verified-savings`: a saving could not move
to *Confirmed* before the 60-day lock elapsed. The relationship is now approved, so these windows
are **real and quotable in principle** — but `/verified-savings` still says no merchant is connected
and no real window can be quoted, and **that page must not change yet**. No Soundcore offer is
displayed anywhere, no click has ever been sent, and no commission event exists, so publishing a
30/60-day window would describe a process the site does not yet run.

### Restrictions — assessed against what HonestTotal actually does

| Policy | Term | HonestTotal today | Risk |
| --- | --- | --- | --- |
| SEM — protected keywords | No bidding on "Soundcore" + variations, misspellings, or brand+coupon/discount terms | Runs **no paid search at all** | None — not capable of breach |
| SEM — negative matching | **Required** | n/a | **Becomes mandatory the moment any SEM starts** |
| SEM — display URL | Branded terms prohibited (Soundcore, Anker, soundcore.com) | n/a | None |
| SEM — ad copy | Branded terms prohibited; must not be deceptive | n/a | None |
| SEM — direct linking | **No** | n/a | None |
| Website — domain keywords | Branded terms prohibited in domain | `honesttotal.com` contains none | None |
| Website — URL keywords | Branded terms prohibited in URLs | No URL contains "soundcore"/"anker" | None |
| Website — prohibited content | No political, violent, hate or adult content | None present | None |
| Social media | Allowed, but **no Soundcore/Anker-branded accounts** — violation means immediate removal *and reversal of commissions* | Operates no social accounts | None |
| Coupons | Only codes supplied through the affiliate program | Publishes no coupons | None |
| Incentivized traffic | Allowed | Not used | None — and should stay unused |
| Email / Software / Sub-affiliates | Allowed | None used | None — and should stay unused |
| Brand representation | No misspellings, bad grammar, or false/misleading discount claims; expire dated offers; professional tone; **"authorized wholesaler" and "official site" may never be used** | No such claims exist | None |

**Every restriction is currently satisfied — largely because HonestTotal does almost none of the
things they restrict.** That is a consequence of the content-and-organic-search-only model, not of
any effort to comply.

### Gap found in the terms themselves

The field **"Web Site — Use of Logos and Trademarks in Web sites"** does not contain a logo policy.
It repeats the prohibited-content sentence verbatim ("Prohibited sites are those with political,
violent, hate language or adult content"), which appears to be an error in the advertiser's own
terms.

**Consequence: there is no stated grant of permission to use Soundcore or Anker logos.** Treat that
as *not granted*. Do not place their logo on the site, and do not infer permission from the field
being blank — ask `affiliate@anker.com` if a logo is ever wanted. The site currently uses **no
merchant logos of any kind**, which is already the correct posture.

> No additional restrictions are inferred beyond what is written above. Re-read the live Program
> Terms before any implementation, since the advertiser may change them at any time.

## Data fitness — measured 6 September 2026, re-measured through 7 November 2026

Approval unlocked the feed; the feed was then measured field by field before any architecture
decision, per the standing rule that the audit comes first and affiliate links come last. The full
aggregate report is preserved as evidence at
[`research/SOUNDCORE-FEED-MEASUREMENT.md`](research/SOUNDCORE-FEED-MEASUREMENT.md) and the
measurement script at [`research/cj-soundcore-feed-measurement.mjs`](research/cj-soundcore-feed-measurement.mjs).
The numbers below are copied from that report, not restated from memory. Every later export
has its own dated report in the same folder; the 6 Sep baseline is kept here unchanged, and the
current figures follow it under §Re-measurement.

**Source:** subscription `320962`, Shopping/Google format, US/English/USD. CJ reported 230 exported
records; 228 parsed as valid unique product rows, **0 malformed, 0 blank, 0 duplicates, 0 excluded**.
`VALID_UNIQUE_PRODUCT_ROWS = 228` is the denominator for every figure here.

| Dimension | Result | Verdict |
| --- | --- | --- |
| GTIN | 100.0% (228/228) | |
| Brand | 100.0% (228/228) | |
| MPN | 0.0% (0/228) | not needed — GTIN carries identity |
| **Strong identity** (GTIN or Brand+MPN) | **100.0% (228/228)** | **PASS** |
| **Valid price** | **100.0% (228/228)** | **PASS** |
| **Availability** | **100.0% (228/228)** | **PASS** |
| Condition · link | 100.0% each | |
| image_link | 99.6% (227/228) | |
| sale_price populated | 100.0% (228/228) | 43.9% (100/228) are actually below `price` |
| **US Level-2 shipping** | **0.0% (0/228)** | **FAIL** |
| **Price + US L2 shipping** | **0.0% (0/228)** | **FAIL** |
| Mandatory fees | no fee column exists | **NOT AVAILABLE** |

**Identity and price are the cleanest this project has ever measured. Shipping is absent entirely.**

### Re-measurement — 7 November 2026 (current figures)

The relationship now has a **recurring** export, subscription `323598`, delivered daily by email.
Each delivery is measured by the same script before anything is built from it. The 6 Sep baseline
above is retained; this is the state today.

**Source:** subscription `323598`, Shopping/Google format, US/English/USD, CJ processing stamp
`2026-11-07 08:37`, delivered 7 Nov 2026 22:37 Dhaka. **226 validated products**, 0 malformed,
0 blank, 0 duplicates. Feed export window `2026-11-07T12:22:42.735Z` to `.961Z`, spread 0.226 s.

| Dimension | 6 Sep 2026 | **7 Nov 2026** | Verdict |
| --- | --- | --- | --- |
| Valid unique product rows (denominator) | 228 | **226** | |
| Strong identity (GTIN or Brand+MPN) | 100.0% (228/228) | **100.0% (226/226)** | **PASS** |
| Valid price | 100.0% (228/228) | **100.0% (226/226)** | **PASS** |
| Availability | 100.0% (228/228) | **100.0% (226/226)** | **PASS** |
| image_link populated | 99.6% (227/228) | **100.0% (226/226)** | |
| sale_price below price | 43.9% (100/228) | **50.9% (115/226)** | |
| **US Level-2 shipping** | **0.0% (0/228)** | **0.0% (0/226)** | **FAIL** |
| **Price + US L2 shipping** | **0.0% (0/228)** | **0.0% (0/226)** | **FAIL** |
| Mandatory fees | no fee column exists | no fee column exists | **NOT AVAILABLE** |

**The shipping gap is structural, not a stale file.** Six independent exports, measured
separately:

| Export | 4 Sep | 29 Oct | 2 Nov | 5 Nov | 6 Nov | **7 Nov** |
| --- | --- | --- | --- | --- | --- | --- |
| Rows | 228 | 227 | 225 | 224 | 225 | **226** |
| US L2 shipping | 0/228 | 0/227 | 0/225 | 0/224 | 0/225 | **0/226** |

**Prices do move between exports.** Across the six exports at least one earbud record was observed
at three different prices — up, then back down to its original figure — which is why a build is
refused from any export older than 48 hours rather than treating a stale copy as current. Between
the 6 and 7 Nov exports **no price changed and the row count rose by one** (one product added, none
removed).

*Individual SKUs and per-product prices are deliberately not recorded in this repository* — see
§Raw data handling. Both observations are reproducible from a current export with
`research/cj-soundcore-feed-measurement.mjs`, which reports price-change and row-delta counts
without writing any product record.

### The BRAND column does not classify product brand

`BRAND` is populated on 100% of rows, and that figure is **misleading**. The value is the constant
string `Soundcore` on **all 226 rows**, while the subscription delivers Anker's wider portfolio.
Classifying by the brand actually named in `TITLE`:

| Token found in TITLE | Rows | Share |
| --- | --- | --- |
| contains `anker` | 58 | 25.7% |
| contains `soundcore` | 166 | 73.5% |
| — of which **both** `anker` and `soundcore` (e.g. "Anker Soundcore …") | **24** | 10.6% |
| **contains `eufy`** | **5** | **2.2%** |
| no brand token in the title | 21 | 9.3% |

**The split depends on which token is checked first, so it is not a brand census.** 24 titles
carry both words, so the two defensible readings are:

| Precedence | soundcore | Anker | eufy | unlabelled |
| --- | --- | --- | --- | --- |
| `anker` checked first | 142 | 58 | 5 | 21 |
| `soundcore` checked first | 166 | 34 | 5 | 21 |

The **142 / 58** figures recorded elsewhere in this project are the *Anker-first* reading. Only
`eufy` (**5**) and *unlabelled* (**21**) are stable under either order. Re-measured 7 Nov 2026 on
the 226-row export; counts are of title substrings and are **not** verified manufacturer identity.

**Five rows name `eufy` in the title.** They are not Soundcore accessories — they are
home-security, robot-vacuum, smart-lock, outdoor-lighting and personal-care products of a different
Anker sub-brand, and their prices sit roughly an order of magnitude above the earbud records, so
they are the merchant's own hardware lines rather than add-ons. **Their identifiers and individual
prices are deliberately not recorded here** (§Raw data handling).

*Reproduce it:* take any current export and count rows whose `TITLE` lowercases to contain `eufy`
while `BRAND` reads `Soundcore`. On the 7 Nov export that is **5 of 226**, and `BRAND` is the
constant `Soundcore` on all 226 — which is the whole finding. No product record is needed to
confirm it, and none should be written down.

**Rule: product-brand classification MUST NOT be inferred from the feed's `BRAND` field.** Nor may
it be inferred from the title without a written, approved rule — R-10 in the risk register already
says identity fields may not mean what their names suggest, and this is that risk, materialised.
Displaying, filtering or ranking on `BRAND` would label a eufy robot vacuum a Soundcore product:
a false statement about a real company's product.

`STRONG_IDENTITY` is unaffected — it passes on `GTIN` (100%), never on `Brand + MPN` (0%, MPN is
empty on every row). Nothing in the codebase reads `BRAND` today; the card's "Sold by" value comes
from the merchant registry. This is a trap for work not yet written, not a live defect.

### No category taxonomy is supplied

`GOOGLE_PRODUCT_CATEGORY_NAME` **and** `GOOGLE_PRODUCT_CATEGORY` are both **empty on all 226
rows**: no standard taxonomy, no taxonomy ID.

`PRODUCT_TYPE` is **not** empty — it carries free text on **168 of 226 rows (74.3%)**, 19 distinct
values, with inconsistent casing and vendor-internal strings among them (`headphone` 47,
`speaker` 29, `true wireless earbuds` 27, `Accessories` 15, `clip earbuds` 12,
`open ear earbuds` 10, `portable projector` 5, `voice recorder` 4,
`Home Theater Projectors` 4, `TTshop earbuds` 3, `translation earbuds` 3, `TTshop headphone` 2,
and 7 values on one row each including `Series 7`, `RoboVac` and `Smart Lock`).

**That is a merchant label, not a taxonomy.** It is absent on 58 rows, not controlled, not
hierarchical, and `Series 7` is not a category of anything. It must not be used as one, and the
earlier flat claim that "the merchant supplies no category field at all" is corrected here: the
field exists and is 74.3% populated, and it is still unusable as a taxonomy.

The category breakdown below is **derived by our own measurement script from feed evidence** — it
is ours, not the merchant's, and must not be presented as the merchant's classification.

### Schema presence is not field population — 6 Sep baseline, still true on 7 Nov

The feed declares **18 shipping-related columns** and **4 tax-related columns**, including the CJ
structured forms `SHIPPING(COUNTRY:REGION:SERVICE:PRICE)`, `SHIPPING(PRICE)` and
`SHIPPING(COUNTRY)`. **All 22 are empty on all 228 rows.** The columns exist; Soundcore populates
none of them.

Re-counted by name on the 7 Nov export so the figure is auditable rather than asserted: **15**
column names contain `SHIPPING` (`SHIPPING_LABEL`, `SHIPPING_WEIGHT`, `SHIPPING_LENGTH`,
`SHIPPING_WIDTH`, `SHIPPING_HEIGHT`, and the ten `SHIPPING(...)` structured forms), **4** contain
`TAX`, and **3** more carry delivery timing (`MINHANDLINGTIME`, `MAXHANDLINGTIME`,
`TRANSIT_TIME_LABEL`) — 22 in total, which is the number above. `SHIPS_FROM_COUNTRY` is a 23rd
and is also empty. **Every one of the 23 is 0/226.** A narrower count of "19 shipping-related
fields" quoted elsewhere is the 15 + 4 subtotal; the conclusion is identical either way. A schema audit alone would have reported shipping as available and been wrong — which
is exactly why population is measured rather than inferred.

This was verified **twice, by independent routes**, because the first result was produced by a
parser bug:

1. the parser originally looked for a plain `shipping` column, which this feed does not have, and
   reported `NOT PRESENT IN FEED`. The column mapping was corrected to the `SHIPPING(...)`
   structured variants and the measurement re-run;
2. the raw feed was then counted directly, column by column, without the parser.

Both routes returned **0/228**. The corrected mapping did not change the answer.

**Re-confirmed on the 7 Nov export:** every shipping-bearing column was counted again, directly from the raw file — 19 of them, `SHIPPING_LABEL` through `SHIPPING(COUNTRY:LOCATION_GROUP_NAME:SERVICE:PRICE)` — and **all are empty on all 226 rows**.

### Category breakdown — no exception anywhere (6 Sep figures)

| category | N | identity | price | availability | US L2 shipping |
| --- | --- | --- | --- | --- | --- |
| earbuds | 80 | 100% | 100% | 100% | **0%** |
| other | 60 | 100% | 100% | 100% | **0%** |
| speakers | 44 | 100% | 100% | 100% | **0%** |
| headphones | 24 | 100% | 100% | 100% | **0%** |
| accessories | 20 | 100% | 100% | 100% | **0%** |

Shipping is not sparse in some categories and populated in others. It is absent in all of them, so
no category subset can be carved out as rankable. The 7 Nov breakdown — same shape, 19 accessories
instead of 20 — is in that export's dated report. **These categories are ours**, derived by our own
script: the merchant supplies no category field at all (§No category taxonomy is supplied).

### Link structure

The report records `LINK_TYPE = MIXED`. That label needs one correction so it is not misread as
evidence of two kinds of link: the classifier substring-tested each **whole URL** against both a
CJ-tracking-host pattern and a `soundcore.com|anker.com` pattern, and all 200 sampled links matched
**both**. The consistent reading is a single link type — **CJ tracking/deep links carrying the
Soundcore destination in the URL** — not a mixture. No link was followed, and none was resolved.

Consequence: **no tracking URL would ever need to be invented.** But *"the feed contains
CJ-issued links"* is not the same claim as *"these links are issued to HonestTotal's publisher ID
and are safe to publish"*, and the second was **not** verified — the raw feed was deleted after
measurement, so no link is available to inspect. That gate stays **UNKNOWN**, not PASS.

**A shared destination host proves nothing, and an earlier note of mine implied otherwise.**
On 7 Nov the `url=` parameter of all 226 tracking links was read and found to carry the same
host, `www.soundcore.com`. That is a **structural reading of a string**: no link was followed,
no redirect chain was observed, and no page was loaded. Even if every link had been followed,
a common host would not establish **who sells, ships, invoices and accepts returns** for a
eufy robot vacuum, and it would authorise **nothing** about displaying the images those records
reference. "Sold by Soundcore" on the preview card rests on the merchant-registry entry and the
CJ advertiser relationship — not on the URL.

### What this does and does not permit

Under the published method on `/how-we-rank`: *"If a required component is missing, ambiguous, or
outside the freshness window, then the offer has no all-in price, and is excluded from the
comparison."* Shipping is a required component and it is missing on every record, so **all 228
Soundcore offers are excluded from delivered-cost ranking.**

- This is **not** an advertiser rejection — the relationship is approved and active.
- This is **not** a feed-access failure — the feed was retrieved and parsed cleanly.
- This is a **data-fitness** failure, reason code `MISSING_REQUIRED_SHIPPING_DATA`.
- **Missing shipping is not free shipping.** It must never be defaulted to zero, estimated,
  scraped from soundcore.com, or hidden behind an item-price ranking.

The methodology is not weakened to accommodate a merchant. No exception is created.

### Raw data handling

The measurement script extracts each feed into an OS temp location and **deletes it when the run
ends**; only aggregates are written. The internal catalog preview additionally reads one export
from a path **outside the repository**, supplied at build time through
`HONESTTOTAL_SOUNDCORE_FEED`; the loader refuses any path that resolves inside the repository and
has no fallback. **No raw merchant record has ever been committed.** The catalog preview increment adds a
`verify-preview` build check that fails if one appears; it ran on every preview build and passed on
7 Nov 2026 (14/14). That script ships with the preview increment, so on a documentation-only branch
it is a **forward reference** — the guarantee above does not depend on it, and is independently
checkable by searching this repository for feed archives or product rows, which returns nothing.

**Individual product identifiers and per-product prices are also kept out of this repository**,
by decision of 8 Nov 2026. Findings that rest on specific rows — the `eufy` rows, the
price-movement observation — are recorded as aggregate counts plus the measurement that reproduces
them, never as the rows themselves.

---

## Image and media rights — UNKNOWN

The CJ program terms for advertiser `7382109` were read on 10 Aug 2026 and re-read on 6 Sep 2026.
They cover SEM, domains, URLs, prohibited content, social media, coupons, incentivised traffic,
email, sub-affiliates and brand representation. **They say nothing about product images.** The
"Web Site — Use of Logos and Trademarks in Web sites" field repeats the prohibited-content
paragraph instead of stating a policy, so there is no written logo rule either.

**Silence is not permission.** Rendering `IMAGE_LINK` means displaying the merchant's media and —
if loaded from the URLs the feed supplies — serving it from their CDN on our pages. That is a
normal affiliate pattern and very likely intended, but "likely intended" is not a grant, and a gap
in a contract is not treated as one here.

A written request was sent to `affiliate@anker.com` on **6 November 2026, 20:11 Dhaka**, with the
founder's explicit authorisation, asking five questions: display, hot-linking versus self-hosting,
attribution, acceptable feed age, and the logo/trademark policy. **No reply and no bounce as of
8 November 2026.**

| Question | State |
| --- | --- |
| May the feed's images be displayed at all | **UNKNOWN** |
| May they be hot-linked, or must they be self-hosted | **UNKNOWN** |
| Is attribution required | **UNKNOWN** |
| What feed age does the advertiser consider acceptable | **UNKNOWN** — we self-impose 48 hours |
| Logo / word-mark policy | **UNKNOWN** — no marks are used, and none may be |

Until a reply is recorded here with its date, **nothing using those images may be published.** The
internal preview that renders them is `noindex, nofollow`, absent from the sitemap, carries no
outbound merchant link, and its route path contains no brand term.

---

## Activation Gate

Soundcore integration MUST remain disabled unless **all** of the following are true:

- [x] Relationship status = APPROVED — verified in CJ, 3 Sep 2026
- [x] Current Program Terms reviewed — read 10 Aug 2026, re-read 6 Sep 2026: 7% flat, 30-day
      referral, 60-day lock, all unchanged
- [ ] Valid CJ tracking URL obtained from CJ — links are present in the feed but were **not**
      verified as issued to our publisher ID
- [ ] Merchant destination URL verified
- [ ] Disclosure behaviour verified
- [ ] `rel="sponsored"` behaviour verified
- [ ] Click tracking tested
- [ ] No trademark-bidding conflict
- [ ] No fabricated merchant/product data
- [ ] **Image and media rights confirmed in writing** — status **UNKNOWN**: requested
      6 Nov 2026, unanswered as of 8 Nov 2026. Silence is not permission
      *(tenth gate, approved by the founder 8 Nov 2026 — permanent)*

**Current state: 2 of 10** (was 2 of 9, was 1 of 9). Approval cleared the box that gated the
others; the data audit that followed introduced a *separate* blocker that approval cannot clear;
and the media-rights question is a *third* one, independent of both. Nothing has been un-ticked —
the denominator grew because a gate that was always implicit is now written down.

**The two ticked boxes, re-examined 8 Nov 2026.** Both hold on the evidence this record cites, and
neither was re-confirmed against CJ's live account today:

| Box | Evidence cited | Verified | Outstanding |
| --- | --- | --- | --- |
| Relationship = APPROVED | CJ relationship view, read directly rather than inferred from an email; feed and export subscription visible in the same view | **3 Sep 2026** | Live status not re-read since. Re-read before any activation, and on any CJ notice |
| Program Terms reviewed | Terms recorded in §Program Terms with commercial terms, restrictions and the gap in the advertiser's own logo field | **10 Aug 2026**, re-read **6 Sep 2026** | Not re-read since 6 Sep. Terms may change without notice; re-read before activation |

Both remain **ticked on dated evidence, not on a live check.** That is the correct state for a
record, but it means `2 of 10` is a statement about what was verified and when — not a claim that
either box was true this morning.

### Three scores, three different questions

These are separate systems. Quoting one as another has already produced one wrong figure in this
record, so they are set out explicitly:

| System | Question it answers | Current | Authority |
| --- | --- | --- | --- |
| **Activation checklist** (this section) | may we publish an affiliate link? | **2 of 10** | **AUTHORITATIVE** for link publication |
| **Data-readiness ladder A–I** (`PRODUCT-DATA-READINESS.md` §L) | may offers enter all-in ranking? | **4 PASSED / 1 FAILED / 4 BLOCKED** | **AUTHORITATIVE** for ranking eligibility |
| **Combined analytical assessment** (8 Nov 2026 audit) | one cross-cutting read of ten named gates | **6 PASS / 1 FAIL / 3 UNKNOWN** | **NON-AUTHORITATIVE** — see below |

> **Where the ladder lives.** `PRODUCT-DATA-READINESS.md` is the authoritative source for the
> A–I ladder and is **not part of this documentation commit** — it carries its own link closure of
> provider research (Best Buy and eBay terms analyses and their measurements) which is out of scope
> here. Until it is committed, the ladder's **4 PASSED / 1 FAILED / 4 BLOCKED** is reproduced above
> as a quotation, with its date, rather than resolved by link. It must be committed before the
> ladder score is cited anywhere outside this record.

> **The combined 6 / 1 / 3 figure governs nothing.** It comes from a ten-item list assembled for
> the 8 Nov 2026 audit by merging items from both systems above; three of its items carry no
> ladder letter and no checklist box. It is kept because it is a useful single view of where the
> project stands, and it is labelled non-authoritative because no gate anywhere opens or closes on
> it. **Do not cite it as an activation score, and do not cite it in anything public.**
>
> **Correction, 8 Nov 2026 — a score was wrong, and the gates were found.** This section
> previously said the data-readiness gates were "scored **6/9**". The nine gates are the
> **Gate ladder A–I** in `provider-access/PRODUCT-DATA-READINESS.md` §L, and as scored there on
> 6 Sep 2026 they stand at **4 PASSED (A–D), 1 FAILED (E — shipping), 4 BLOCKED (F–I)**. There is
> no reading of that ladder that yields 6. `6/9` was never sourced; it is struck rather than
> carried forward. F–I are BLOCKED, not failed, and three of them are blocked *by* E and F rather
> than on their own merits.

Enforcement is not by memory. `apps/web/src/lib/merchants.ts` returns the plain destination URL
unless `relationship === 'approved'` **and** a real `affiliateUrl` exists, and
`apps/web/scripts/verify-merchants.mjs` fails the build if either invariant is broken or if a
CJ tracking domain appears in source.

---

## Stop Conditions

If the relationship becomes **declined**, **expired** or **terminated**:

- do not publish affiliate tracking links
- do not claim partnership
- do not show Soundcore as an approved merchant
- do not show Soundcore-derived prices unless an authorized data source exists

**While shipping population stays below Level 2 — the state today, at 0/226 on the 7 Nov export —** these hold
regardless of the relationship being approved:

- do not enter Soundcore offers into delivered-cost / all-in ranking
- do not display a Soundcore "total" of any kind
- do not treat the empty shipping columns as free or zero shipping
- do not obtain shipping by scraping soundcore.com or any other unauthorised route
- do not relax the all-in requirement, add a shipping-optional ranking mode, or introduce a
  per-merchant exception

**While image and media rights stay UNKNOWN** — the state today:

- do not publish any page, anywhere public, that renders a Soundcore feed image
- do not hot-link, copy, cache or re-host those images for a public surface
- do not use the Soundcore or Anker word marks or logos
- do not read silence, or the passage of time, as consent

**Independent of every other gate:**

- do not classify, label, filter or rank product brand from the feed's `BRAND` field
- do not present our derived categories as the merchant's classification

---

## Change log

| Date | Change | Evidence |
| --- | --- | --- |
| 2026-08-08 | Record created. Status PENDING; links disabled by construction. | CJ dashboard showed the application under Pending Applications; live site contains zero outbound external links and zero `rel="sponsored"` attributes. |
| 2026-08-10 | Program Terms read and recorded verbatim: 7% flat, 30-day referral period, 60-day lock. Every restriction assessed against actual site behaviour — all satisfied. Gap found: the logo/trademark field contains the wrong text, so logo permission is **not granted**. | CJ Program Terms tab, visible while pending. Site uses no merchant logos, runs no paid search, publishes no coupons, operates no social accounts. |
| 2026-08-10 | Advertiser detail verified: legal entity Fantasia Trading LLC, contact affiliate@anker.com, joined 22 Feb 2025, US/USD, 7% Sale. Status re-confirmed **PENDING**. Two unrelated recruitment offers declined. | CJ *Advertisers* filtered to "Pending Applications" returned exactly 1 result (7382109 Soundcore). Declined 7889430 Abracadabra NYC (Collectibles) and 7804601 GearUP (Electronic Games) — neither matches the site's consumer-electronics category, and HonestTotal publishes no content in either. |
| 2026-09-03 | **Relationship APPROVED / ACTIVE** — first approved merchant in the project's history. Program terms re-read and unchanged: 7% flat, 30-day referral, 60-day lock. `merchants.ts` deliberately left at `pending`; links still disabled. | CJ relationship view. Feed visible as "Soundcore - CJ Product Feed - Shopping - UNITED STATES\|English\|USD", export subscription `320962` reporting "Exported 230 Records". |
| 2026-09-04 | **CJ support case 01911358 answered — the reply addresses the wrong direction, but resolves the transport question anyway.** The question asked for the *download* path for **export** subscription 320962; CJ answered about **importing** a file ("drag and drop the file into the root directory"), which is the advertiser catalog-upload workflow, not publisher feed retrieval. Useful regardless: the transport is **FTP, not HTTP** (CJ instructs using a third-party FTP client) against host `datatransfer.cj.com`, username = CID/account number, password randomly generated at subscription creation and resettable under *Links > Feeds* or *Account > Subscriptions*. **This explains the original blocker** — the earlier 404s came from requesting an HTTP root on a data-transfer host, i.e. the wrong protocol, not a missing path. **No effect on any measurement**: the feed had already been retrieved by browser export and measured, and transport cannot change field population. Case closed as non-blocking; no FTP client installed and no programmatic retrieval built, since no ingestion is authorised and Soundcore is all-in INELIGIBLE regardless. | Email from `support@cj.com`, 2026-09-04, case 01911358. Stored `.env.cj` values are structurally consistent with these instructions (host length 19 = `datatransfer.cj.com`; username length 7 = a CID). No credential value was read, printed or changed. |
| 2026-09-06 | **Feed retrieved and measured field by field.** 228 valid unique rows, 0 malformed/blank/duplicate. Strong identity **100%**, price **100%**, availability **100%** — all PASS. **US Level-2 shipping 0.0% (0/228)** — hard FAIL. 18 shipping columns and 4 tax columns exist in the schema and are **empty on every row**; a parser-mapping bug was found and corrected, and the raw feed was counted directly as an independent check — both routes returned 0/228. No mandatory-fee column exists. Result: `allInRankingEligibility = INELIGIBLE`, reason `MISSING_REQUIRED_SHIPPING_DATA`. Raw feed deleted after measurement; aggregates only retained. Nothing activated, no code changed. | `provider-access/research/SOUNDCORE-FEED-MEASUREMENT.md` (full aggregate report) and `research/cj-soundcore-feed-measurement.mjs` (the measurement itself). |
| 2026-10-29 → 2026-11-06 | **Recurring export in place and measured on every delivery.** Subscription `323598` ("Soundcore catalog - recurring") delivers the Shopping-format feed daily by email. Four exports measured independently — 29 Oct (227 rows), 2 Nov (225), 5 Nov (224), 6 Nov (225). Identity, price and availability **100% on all four**; **US Level-2 shipping 0/N on all four**. Prices do move between exports, which is why the preview refuses any feed older than 48 hours rather than reusing a stale copy. Nothing activated. | `provider-access/research/SOUNDCORE-FEED-MEASUREMENT-20261029.md`, `-20261102.md`, `-20261105.md`, `-20261106.md`. |
| 2026-11-06 | **Product-image permission requested in writing** from `affiliate@anker.com`, with the founder's explicit authorisation, asking about display, hot-linking vs self-hosting, attribution, acceptable feed age and the logo/trademark policy. Sent because the program terms say nothing about images and the logo field contains the wrong text. **Media rights are therefore UNKNOWN, not permitted** — a separate blocker from the shipping gap. | `provider-access/SOUNDCORE-IMAGE-PERMISSION-REQUEST.md` (recipient, wording and send time). No reply and no bounce as of 8 Nov 2026. |
| 2026-11-07 | **Current measurement. 226 validated products; US Level-2 shipping 0/226.** Sixth consecutive export with no shipping data on any row — 0/228, 0/227, 0/225, 0/224, 0/225, 0/226 — so the gap is structural, not a stale file. Identity 100%, price 100%, availability 100%, image_link 100%. **Two new findings:** (1) `BRAND` is the constant string `Soundcore` on all 226 rows while the feed carries 58 Anker-titled and 5 eufy-titled products — product brand MUST NOT be inferred from that field; (2) `GOOGLE_PRODUCT_CATEGORY_NAME` and `GOOGLE_PRODUCT_CATEGORY` are empty on all 226 rows, so the merchant supplies no standard taxonomy and our categories are derived. `allInRankingEligibility = INELIGIBLE`, reason `MISSING_REQUIRED_SHIPPING_DATA`, unchanged. Internal preview rebuilt from this export and verified; nothing published, no code changed, no affiliate link enabled. | `provider-access/research/SOUNDCORE-FEED-MEASUREMENT-20261107.md` §A–J. Preview build: `verify-footer` 25 pages, `verify-merchants` 7/7 with links disabled, `verify-preview` 14/14. |
| 2026-11-08 | **Founder decisions recorded; record finalised locally.** (1) **Image and media rights is now the permanent tenth Activation Gate**, status **UNKNOWN** — the checklist stands at **2 of 10**. (2) The two ticked boxes were re-examined: both hold on dated evidence (3 Sep and 10 Aug / 6 Sep 2026) and **neither was re-confirmed against CJ's live account**; both must be re-read before activation. (3) **Three scores are kept distinct** — activation **2 of 10** and ladder **4 PASSED / 1 FAILED / 4 BLOCKED** are authoritative, the combined **6 PASS / 1 FAIL / 3 UNKNOWN** is labelled non-authoritative and governs nothing. (4) **Individual SKUs and per-product prices removed** from everything destined for version control; aggregate counts, the classification ambiguity, the method and reproduction instructions are preserved. (5) September measurements are preserved as September, not overwritten with November values. | This record and `research/SOUNDCORE-FEED-MEASUREMENT.md`. Decisions given by the founder in writing, 8 Nov 2026. Nothing committed, pushed, merged or deployed. |
| 2026-11-08 | **Gate definitions reconstructed; three documented figures corrected.** (1) The "nine data-readiness gates" were located — the **Gate ladder A–I** in `PRODUCT-DATA-READINESS.md` §L — and the ladder scores **4 PASSED / 1 FAILED / 4 BLOCKED**, so the long-carried **`6/9` is struck as unsourced and wrong**. (2) The title-brand split is **precedence-dependent**: 24 of 226 titles contain both `anker` and `soundcore`, so 142/58 is the Anker-first reading and 166/34 the soundcore-first one; only eufy (5) and unlabelled (21) are order-stable, and none of it is verified manufacturer identity. (3) `PRODUCT_TYPE` is **populated on 168/226 rows (74.3%)**, so the earlier claim that the merchant "supplies no category field at all" was too strong — what is absent is a *standard taxonomy* (`GOOGLE_PRODUCT_CATEGORY` and `GOOGLE_PRODUCT_CATEGORY_NAME`, both 0/226); the free-text field that does exist is not usable as one. The 22 empty delivery-cost columns are now listed by name (23 including `SHIPS_FROM_COUNTRY`), all 0/226. No conclusion changed: shipping still FAILS, media rights are still UNKNOWN, links are still disabled. | Independent re-measurement of the 7 Nov export (sha256 `859bffe9…d96922`, 87 headers, 226 rows), read as data outside the repository; `provider-access/PRODUCT-DATA-READINESS.md` §L for the ladder; `verify-merchants` re-run 8 Nov 2026 — 7/7, affiliate links DISABLED. |
| 2026-11-08 | **Record reconciled. Correction recorded.** The 6 Sep extension of this record existed only as an uncommitted working-tree change over the committed 159-line version; this document merges them and integrates the 7 Nov measurement. **Correction:** an earlier note of mine read the `url=` parameter of all 226 tracking links, found one host, and treated that as evidence of merchant identity. No link was followed, and a shared host would not establish who sells, ships or invoices an item, nor authorise image display. §Link structure now says so. | This file. Diff against the 293-line working version is reported alongside it; nothing committed, pushed or deployed. |
