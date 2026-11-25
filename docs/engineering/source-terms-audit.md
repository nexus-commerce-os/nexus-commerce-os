# Manufacturer source-terms audit — 26 November 2026

The catalog publication audit of 25 November closed with one thing unchecked:
nobody had read the nine manufacturers' terms of use. That is now done, and the
answer changes the plan.

**Finding: 2 of 10 records are eligible. 8 are quarantined.** Six sites have
terms that, as written, restrict what this site would be doing with their
content, and two could not be read at all. This is not a copyright finding —
the copyright exposure was measured on 25 November and is small. It is a
**contractual** finding, and a term can bind where copyright does not reach.

> I am not a lawyer and this is not legal advice. It is a reading of what each
> document says, collected so the founder can make an informed decision or take
> it to counsel. Where a document is silent I have written NOT FOUND rather
> than inferring permission from silence.

---

## Why "public" was never the question

The use being assessed: hand-transcribed factual specification values (median
18 characters — `300 Ω`, `260 g`, `dynamic, open`), the source page cited and
linked, no images, no marketing prose, no prices, on a `noindex` page.

Two separate questions govern that, and conflating them is what made this look
settled when it was not:

1. **Copyright** — does reproducing these values infringe? Measured on
   25 November: 56 spec pairs, longest value 79 characters, no prose, no
   images, summaries written by us. Short factual values are facts, and facts
   are not copyrightable. **Exposure small.**
2. **Contract** — do the site's terms of use prohibit it regardless? A terms
   page can forbid reproduction, commercial use or automated extraction
   entirely independently of copyright, and accepting the terms by using the
   site is what binds you.

Question 2 is the one that was unchecked, and it is the one that fails.

## What each site's terms say

| Domain | Reproduction barred? | Automated access barred? | Commercial use barred? | Facts/comparison carve-out? | Verdict |
|---|---|---|---|---|---|
| `us.sennheiser-hearing.com` | NOT FOUND | NOT FOUND | NOT FOUND | — (silent) | **ELIGIBLE** |
| `daskeyboard.com` | NOT FOUND (no terms page exists) | NOT FOUND | NOT FOUND | — (silent) | **ELIGIBLE** |
| `bose.com` | Yes — qualified "for commercial purposes" | **Yes, explicit** (robots, spiders, scrapers, harvesting) | Yes | NOT FOUND | QUARANTINE |
| `lg.com` | **Yes, broad — no commercial qualifier** | **Yes, explicit** (spiders, robots, scrapers, crawlers, data mining) | Yes | NOT FOUND | QUARANTINE |
| `samsung.com` ×2 | Yes — qualified "for commercial purposes" | Not named; "collect or harvest" | Yes | Personal use only | QUARANTINE |
| `apple.com` | **Yes, broad** | **Yes, explicit** (page-scrape, robot, spider, deep-link) | Yes | Downloadable docs only, personal/non-commercial | QUARANTINE |
| `corsair.com` | **Yes, explicit** | **Yes, explicit** (crawlers, robots, scrape, extraction methods) | **Yes — "may not build a business using the Content"** | NOT FOUND | QUARANTINE |
| `crucial.com` | **COULD NOT READ** — blocks automated fetch | — | — | — | QUARANTINE (unresolved) |
| `keychron.com` | **COULD NOT READ** — terms body never loaded | — | — | — | QUARANTINE (unresolved) |

Terms pages read: Bose `/legal/terms-of-use` (modified 30 Jul 2026), LG
`/us/legal`, Samsung `/us/common/legal/`, Apple
`/legal/internet-services/terms/site.html`, Corsair `/ww/en/s/terms-of-use`
(modified Feb 2026), Sennheiser `/policies/terms-of-service` (Oct 2024).

### The three findings that matter most

**Corsair is the clearest prohibition.** Its terms bar scraping and extraction
methods, define "Content" to include data, and state in terms that you may not
build a business using the Content, profit or not. HonestTotal is a commercial
referral site. There is no reading of that clause under which this use is
permitted.

**Apple and LG bar reproduction without a commercial qualifier.** Bose and
Samsung bar copying "for commercial purposes" — which would be a live question
for a non-commercial site, but not for this one.

**Two could not be read, and that is a quarantine, not a pass.** `crucial.com`
returns a rejection page to automated fetches; Micron's own terms (Crucial is a
Micron brand) bar reproduction, commercial use and automated systems, but
whether they govern `crucial.com` is unverified. Keychron's terms body never
loaded in four attempts across three URLs. **Unread is not permissive.**

### The two that are eligible, and the honest limit of that

**Sennheiser** has no website terms of use at all — only sales terms, which
govern purchased products and say nothing about site content. **Das Keyboard**
has no terms page reachable from its footer; the footer carries a copyright
notice, which is a notice and not a restriction.

Silence is not a licence. It means no contractual restriction was found, so the
position rests on the copyright analysis alone — and that analysis is
favourable for short factual values with attribution. That is a reasonable
position, not a certainty. Counsel could confirm it; only the founder can
obtain that.

Also unchecked for these two: `daskeyboard.com`'s shop subdomain may carry
store terms, and Sennheiser's `robots.txt` was not read. Neither was reachable
from the footer path audited.

## What this means for the discovery experience

The eligible records are **Sennheiser HD 600** (headphones) and **Das Keyboard 4
Professional** (keyboards). They are in different categories, and that detail
decides the feature set:

| Requested | Buildable on eligible data? |
|---|---|
| Product detail pages | **Yes** — 2 pages |
| Functional search | **Yes** — works over 2 records, genuinely |
| Brand filter | **Yes** — 2 brands |
| Category filter | Technically yes, 1 record per category — a filter that never narrows anything |
| **Side-by-side comparison of 2–4 products** | **No.** Comparison requires two products in one category. There are none. |
| Shareable comparison URLs | **No** — nothing to compare |

A comparison control with nothing to compare is exactly the decorative,
non-functional control that is forbidden, so it is not being built on this
data. The honest options are:

1. **Publish the 2 eligible records** as spec pages with working search, and no
   comparison control until there is something to compare. Small but true.
2. **Obtain permission** for one or more quarantined brands — an email to each
   asking to reproduce factual specifications with attribution. Cheap to send,
   slow to return, and a "no" is binding where silence was not.
3. **Source specifications from authorized feeds instead** — where the
   affiliate agreement grants reproduction rights explicitly, which is the
   whole point of the feed pipeline. One authorized merchant feed carries more
   comparable products than this hand-transcribed catalog ever will.

**Recommendation: 3, with 1 alongside it.** Option 3 is where the platform was
always going; this audit is the evidence that hand-transcription was never the
path to a catalog with real comparison coverage. The CJ Soundcore export is 225
products of authorized data, and comparison across it needs no manufacturer's
permission because the feed is licensed content.

## What is now enforced by machine

The audit verdict is recorded per record and checked on every build, so this
cannot quietly regress into publishing a quarantined brand:

- every product carries a `sourceTerms` verdict with the terms URL and the date
  read;
- the build **refuses** to publish a record whose verdict is not `eligible`;
- a record with no verdict at all is treated as quarantined, so adding a
  product without auditing its source fails the build rather than shipping.

This matters more than the current count. The count will change; the rule that
nothing publishes without a verdict should not.
