# Soundcore — CJ Affiliate Compliance Record

**Created:** 8 August 2026 · **Last verified:** 8 August 2026
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
| Category | Consumer Electronics |
| Serviceable Area | United States |
| Currency | USD |
| Displayed Commission | 7% Sale |

> The displayed commission was observed in CJ while the application was pending and must be
> re-verified against the active Program Terms if the relationship is approved.

---

## Search Policy

Recorded verbatim from the restriction stated on the program:

> Publishers are prohibited from bidding on Soundcore trademark terms and/or its display URL on
> search engines.

> Current CJ Program Terms must be reviewed again before any implementation. No additional
> restrictions are inferred here.

Note for whoever implements: HonestTotal runs **no paid search of any kind** today, and the CJ
promotional profile declares content/editorial and organic search only. The restriction is
therefore not currently capable of being breached — but it is recorded so that any future decision
to run paid search starts from the constraint rather than discovering it afterwards.

---

## Activation Gate

Soundcore integration MUST remain disabled unless **all** of the following are true:

- [ ] Relationship status = APPROVED
- [ ] Current Program Terms reviewed
- [ ] Valid CJ tracking URL obtained from CJ
- [ ] Merchant destination URL verified
- [ ] Disclosure behaviour verified
- [ ] `rel="sponsored"` behaviour verified
- [ ] Click tracking tested
- [ ] No trademark-bidding conflict
- [ ] No fabricated merchant/product data

**Current state: 0 of 9.** The first box gates every other box.

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
