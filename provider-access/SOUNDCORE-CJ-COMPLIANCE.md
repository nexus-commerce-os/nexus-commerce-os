# Soundcore — CJ Affiliate Compliance Record

**Created:** 8 August 2026 · **Last verified:** 10 August 2026
**Scope:** this file records the state of one advertiser relationship. It grants nothing and
approves nothing. It exists so that "are we allowed to publish a Soundcore link yet?" has a written
answer instead of a recollection.

> This record does **not** change P0.3 status. P0.3 remains **BLOCKED ON AUTHORIZED PROVIDER
> ACCESS**, provider checklist **0/13**. A pending CJ application is not provider access.

---

## Relationship

| Field | Value |
| --- | --- |
| Network | CJ Affiliate |
| Advertiser | Soundcore |
| Advertiser ID | `7382109` |
| Status | **PENDING** |
| Public affiliate relationship claim allowed | **NO** |
| Affiliate links allowed | **NO** |
| Tracking URL available | **NO** |

Application was visible under CJ *Pending Applications* at the time of writing. No approval exists.

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

> The displayed commission was observed in CJ while the application was pending and must be
> re-verified against the active Program Terms if the relationship is approved.

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
to *Confirmed* before the 60-day lock elapsed. **These numbers may not be published as live policy
while the relationship is PENDING** — `/verified-savings` currently says no merchant is connected
and no real window can be quoted, which remains true.

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

## Activation Gate

Soundcore integration MUST remain disabled unless **all** of the following are true:

- [ ] Relationship status = APPROVED
- [x] Current Program Terms reviewed — read 10 Aug 2026, recorded above (re-read before activation)
- [ ] Valid CJ tracking URL obtained from CJ
- [ ] Merchant destination URL verified
- [ ] Disclosure behaviour verified
- [ ] `rel="sponsored"` behaviour verified
- [ ] Click tracking tested
- [ ] No trademark-bidding conflict
- [ ] No fabricated merchant/product data

**Current state: 1 of 9.** The first box gates every other box.

Enforcement is not by memory. `apps/web/src/lib/merchants.ts` returns the plain destination URL
unless `relationship === 'approved'` **and** a real `affiliateUrl` exists, and
`apps/web/scripts/verify-merchants.mjs` fails the build if either invariant is broken or if a
CJ tracking domain appears in source.

---

## Stop Conditions

If the relationship remains **pending**, or becomes **declined**, **expired** or **terminated**:

- do not publish affiliate tracking links
- do not claim partnership
- do not show Soundcore as an approved merchant
- do not show Soundcore-derived prices unless an authorized data source exists

---

## Change log

| Date | Change | Evidence |
| --- | --- | --- |
| 2026-08-08 | Record created. Status PENDING; links disabled by construction. | CJ dashboard showed the application under Pending Applications; live site contains zero outbound external links and zero `rel="sponsored"` attributes. |
| 2026-08-10 | Program Terms read and recorded verbatim: 7% flat, 30-day referral period, 60-day lock. Every restriction assessed against actual site behaviour — all satisfied. Gap found: the logo/trademark field contains the wrong text, so logo permission is **not granted**. | CJ Program Terms tab, visible while pending. Site uses no merchant logos, runs no paid search, publishes no coupons, operates no social accounts. |
| 2026-08-10 | Advertiser detail verified: legal entity Fantasia Trading LLC, contact affiliate@anker.com, joined 22 Feb 2025, US/USD, 7% Sale. Status re-confirmed **PENDING**. Two unrelated recruitment offers declined. | CJ *Advertisers* filtered to "Pending Applications" returned exactly 1 result (7382109 Soundcore). Declined 7889430 Abracadabra NYC (Collectibles) and 7804601 GearUP (Electronic Games) — neither matches the site's consumer-electronics category, and HonestTotal publishes no content in either. |
