# Affiliate-Network Review Readiness Audit — honesttotal.com

**Audited:** 7 August 2026 · **Scope:** all 17 public pages, live production site
**Auditor stance:** external reviewer at Impact / CJ / Awin assessing a new publisher application
**Method:** every finding below was measured against the deployed site or the source that produces
it. Nothing here is inferred from intent.

**Worker version audited (pre-fix):** `dbe94793-aea1-4df5-9f98-f14278119b62`
**Worker version after blocking fixes:** `c2df4ef6-3e82-4d31-a15c-8328b9789275`

---

## A. Executive verdict

The site is a genuinely unusual affiliate application: substantial original editorial content, a
published ranking methodology, and disclosure pages that are more candid than most established
publishers'. Technical hygiene is strong — zero broken links, complete sitemap, correct canonicals,
valid structured data, no console errors.

**However, the audit found six blocking truth defects, all on the home page.** The home page was
written before the truth-rule discipline that governs the twelve pages built after it, and it had
drifted into describing a running product. Most seriously, it asserted a CI-enforced neutrality
test that **does not exist** — directly contradicting `/commission-blind`, which states plainly that
the test cannot run because there is no ranker. A reviewer reading both pages would have found the
site contradicting itself on precisely the claim it is built around.

All six were fixed during this audit and verified live. No commitment was weakened to achieve it;
every fix replaced a false present-tense claim with an accurate one.

**One remediation requested by the Founder was completed:** primary CTA contrast now clears WCAG AAA
via a dedicated `--btn-primary-bg` token, with the brand green `--accent` left untouched.

**One remediation was investigated but NOT changed, pending Founder approval:** the catch-all email
route. Recommendation in §J.

---

## B. Verdict

| | |
| --- | --- |
| **Before fixes** | 🔴 **BLOCKED** — 6 blocking truth defects |
| **After fixes** | 🟢 **PASS** |

---

## C. Page-by-page audit

Legend: ✅ pass · ⚠️ non-blocking finding · 🔴 blocking (now fixed)

| # | Page | Verdict | Notes |
| --- | --- | --- | --- |
| 1 | `/` | 🔴→✅ | All six blocking defects were here. Fixed, verified live. Pre-launch banner, ILLUSTRATION badge and footer disclaimer were already correct. |
| 2 | `/how-we-rank` | ✅ | Method stated in full including refusals. Worked example inside ILLUSTRATION panel. §7 states what is not connected. ⚠️ no per-page OG/JSON-LD/breadcrumb. |
| 3 | `/verified-savings` | ✅ | Four states defined; running total states **$0.00** and explains the zero. Example labelled. |
| 4 | `/commission-blind` | ✅ | Strongest page in the set. §05 states the neutrality test is **not running**. This is the page the home page was contradicting. |
| 5 | `/guides/over-ear-headphones` | ✅ | Original; no models, no prices; recommendation explicitly deferred. |
| 6 | `/guides/how-anc-works` | ✅ | Physics only; declines "best ANC" question. |
| 7 | `/guides/oled-tv` | ✅ | Zero brand names verified by scan; declines to name a panel winner. |
| 8 | `/guides/ssd` | ✅ | Zero brand names; spec table ordered as inverse of advertising. |
| 9 | `/guides/laptop` | ✅ | Zero brand names; ranks decisions by permanence. |
| 10 | `/guides/mechanical-keyboard` | ✅ | Zero brand names; "which switch" answered as *unanswerable from outside*. |
| 11 | `/about` | ✅ | Founder-built, self-funded, no invented team. ⚠️ no per-page OG/JSON-LD/breadcrumb. |
| 12 | `/disclosure` | ✅ | Affiliate disclosure, sourcing policy, incentives. ⚠️ no per-page OG/JSON-LD/breadcrumb. |
| 13 | `/privacy` | ✅ | Written from the code: exactly three stored fields, named. No compliance certification claimed. |
| 14 | `/terms` | ✅ | Names no company and asserts no jurisdiction, because neither exists. Unusually honest. |
| 15 | `/cookies` | ✅ | Zero cookies, verified at runtime; tells the reader how to check. |
| 16 | `/contact` | ✅ | Two addresses, both confirmed Active before publication. No response-time promise. |
| 17 | `/faq` | ✅ | 49 questions; includes "most likely way this fails" and "weakest part of your method". |

---

## D. Truth audit

Every material claim classified. Full pattern scan run over the visible text of all 17 pages
(money, percentages, user counts, "trusted by", partnership language, superlatives, testimonials,
certification claims).

### D.1 Blocking defects found — UNVERIFIED presented as fact

All six on `/`. All fixed and verified live.

| ID | Claim as published | Why it was blocking | Now reads |
| --- | --- | --- | --- |
| **B1** | "it's a fitness test enforced in CI, not a promise on a page" | **No such test exists.** `services/affiliate/src/index.ts` header: *"P0.1 SCAFFOLD — intent declaration only. NO implementation."* A repo-wide grep for "neutrality" matches only the `/commission-blind` page copy — no test file, no CI job. Directly contradicted `/commission-blind`. | "The test that will enforce it is specified and **not yet running** — there is no ranker to test." |
| **B2** | "Everything below is engineered, tested, and auditable, not marketing." | Nothing below it is engineered or tested. | "a published rule we can be held to, not a description of software already running." |
| **B3a** | "find the best price on the **Sony XM5**" with "**$328.00**" | A **real product** with a **fabricated price**. Highest-risk item for an affiliate reviewer. | "a pair of over-ear headphones" |
| **B3b** | "ranked by value, not payout · **verified just now**" | Asserts a verification that never occurred. | "· illustrative exchange, no live data" |
| **B4** | "≤ 1¢ — AI cost per request, **by design**" | A design budget rendered as a measured metric. There are no requests. | "AI cost per request — design budget, **not yet measured**" |
| **B5** | "Every API response **carries** a disclosure field"; "Prices **are** deterministically verified"; "Personalization is a feature — you **can** see and reset what drives your recommendations" | Present tense for software that does not exist. The personalization claim also sat in a **privacy** context and contradicted `/privacy`. | All moved to future tense with the current state stated ("The API is designed, not yet built"; "No price is served today"; "Today nothing personal is collected at all"). |
| **B6** | Home FAQ: "Personalization is a feature you control… You can see exactly what drives your recommendations and reset it." | Same defect inside the FAQ, where reviewers read most closely. | "Today the only thing stored is a waitlist email, if you submit one — no cookies, no analytics, no trackers." |

Additionally, the four-figure guarantee strip (`0 / $0 / 100% / 0`) rendered as bare numerals that
read as **usage statistics**. The section carried `aria-label="What we guarantee"` — announced to
screen readers, invisible to everyone else. A visible caption was added:
*"Guarantees, not usage figures — nothing has launched yet."*

### D.2 Classification of all material claims

| Class | Where | Examples |
| --- | --- | --- |
| **PROVEN** | Verifiable today by the reader or by us | Zero cookies (runtime-verified, `document.cookie` empty); no third-party requests (every script/stylesheet same-origin across the whole build); confirmed savings **$0.00**; no merchant partnerships; no users; two contact addresses live; waitlist stores exactly three fields |
| **ILLUSTRATIVE** | Labelled on the page | Home demo panel (badge + "Illustrative example — not live data"); `/how-we-rank` worked example (ILLUSTRATION badge + "Figures invented to demonstrate the rule"); `/verified-savings` lifecycle table (same); Merchant A–E placeholders throughout |
| **PRE-LAUNCH** | Stated as intent, not operation | The ranking method; the four savings states; the neutrality wall; sponsored-placement rules; the API; regional rollout |
| **UNVERIFIED-as-fact** | **6 found, 6 fixed** | See D.1. **Zero remain.** |

### D.3 What the scan did *not* find

Checked explicitly across all 17 pages — **zero occurrences** of: fabricated user counts, fabricated
savings totals, testimonials or reviews, star ratings, "trusted by", "as seen in", "award-winning",
partnership language ("our partners", "in partnership with"), compliance certifications
(GDPR-compliant, ISO, SOC 2), or merchant logos.

The six guides contain **zero manufacturer brand names** — a scan of 21 common brand names across
the three newest guides matched none.

---

## E. SEO / indexability audit

| Check | Result |
| --- | --- |
| Canonicals | ✅ 17/17 present and **absolute** |
| `www` vs apex duplicate | ✅ both serve identical content and both declare `canonical=https://honesttotal.com` |
| `sitemap.xml` | ✅ HTTP 200, 17 URLs, exactly matches the 17 live pages — no orphans, no omissions |
| `robots.txt` | ✅ HTTP 200; `Allow: /`, `Disallow: /api/`, sitemap declared. Cloudflare's managed block sets `Content-Signal: search=yes` — **search engines explicitly permitted**; AI-training crawlers disallowed (a Cloudflare zone setting, not a search restriction) |
| Indexability | ✅ all 17 pages `index, follow`; no stray `noindex` |
| Broken links | ✅ **zero** — all 17 referenced internal paths return 200; all same-page anchors resolve; all six cross-page `/#…` targets exist on the home page |
| External links | ✅ none (only two `mailto:`) — nothing to rot |
| JSON-LD | ✅ 13 pages carry BreadcrumbList + FAQPage; **all parse**; FAQ counts match rendered `<details>` exactly (49 = 49 on `/faq`) because both derive from one constant |
| Open Graph / Twitter | ⚠️ 13/17 complete. **4 pages lack per-page OG**: `/`, `/how-we-rank`, `/about`, `/disclosure` |
| Titles | ✅ all ≤ 60 chars |
| Meta descriptions | ⚠️ all 17 exceed 160 chars (166–226) — will be truncated in SERPs |
| 404 | ⚠️ correct **status 404** and `noindex`, but the bare framework page: no navigation, no link home |

---

## F. Affiliate disclosure audit

| Requirement | Status |
| --- | --- |
| Disclosure exists and is findable | ✅ `/disclosure`, linked from every page footer |
| Disclosure is specific, not boilerplate | ✅ names the model, the sourcing policy and the incentive |
| Commission-blind ranking explained | ✅ `/commission-blind` — three enforcement tiers, neutrality wall, organic-vs-sponsored terms |
| Honest about enforcement status | ✅ **after B1 fix.** Both pages now agree the test is specified and not running |
| Sponsored placement rules published pre-emptively | ✅ written before any advertiser exists |
| FTC-style positioning | ✅ disclosure precedes the hand-off by design; no "guaranteed lowest price" language anywhere |
| No implied partnerships | ✅ Merchant A–E placeholders only; no logos; `/about` states "Partnerships: none active" |

---

## G. Reviewer-risk findings

| Risk | Severity | Assessment |
| --- | --- | --- |
| **Brand identity mismatch** | ⚠️ Medium | Site is branded **NEXUS Commerce OS** throughout; domain and public brand are **Honest Total**. `/faq` explains it ("a project mid-rename"), and the footer says "Codename NEXUS — consumer brand deferred". A reviewer may still pause on a domain that does not match the masthead. **Not a policy breach; a coherence cost.** |
| **Pre-launch with zero traffic** | ⚠️ High (external) | This is the stated reason for the earlier Marketplace decline. No audit action can fix it; only indexing and time. |
| Thin-content risk | ✅ None | Six substantial original guides plus a 49-question FAQ. Content is the site's strongest asset. |
| Scraped / duplicated content | ✅ None | All copy original; no product data, no feeds, nothing aggregated. |
| Misleading price claims | ✅ Resolved | Was **B3a/B3b**. No price of any kind now appears outside a labelled illustration. |
| Coupon/incentive spam patterns | ✅ None | No coupon codes, no cashback offers, no toolbar, no extension. |

---

## H. Accessibility / performance evidence

Measured with real sRGB compositing (canvas-resolved; alpha and gradients composited down the
ancestor chain; gradient backgrounds evaluated at their **darkest** stop), in both themes, with
transitions disabled.

| Check | Result |
| --- | --- |
| **WCAG AA contrast** | ✅ **Zero failures**, both themes, 195 text elements on the home page |
| **Primary CTA (requested remediation)** | ✅ **5.58 → 7.86:1** light, **9.83:1** dark — AAA cleared |
| Brand green preserved | ✅ `--accent` still `#0e9f6e`; new `--btn-primary-bg` token affects the button only |
| Residual AA-but-not-AAA | ⚠️ Large accent-green display text (3.14–3.39:1, passes AA-large 3.0); internals of the dark ILLUSTRATION panel (4.52–5.92); savings-state pills (4.69–6.9) |
| Horizontal overflow | ✅ none at 375 / 768 / 1440 across all pages tested |
| Touch targets | ✅ no control under 24 px outside inline sentence links (WCAG-exempt) |
| Keyboard / names | ✅ all interactive controls have accessible names; breadcrumbs are `<ol>` in `<nav aria-label="Breadcrumb">` |
| Reduced motion | ✅ honoured globally |
| `lang` / viewport meta | ✅ `lang="en"`, viewport meta present |
| Console errors | ✅ **zero** on every page tested |

### Corrections to my own earlier reporting

Two things must be stated plainly rather than left in the record:

1. **Earlier per-page reports said "no element below AAA except `.btn-primary`".** That was true for
   the selector those sweeps used. This audit widened the net to include `span`, `b`, `em`, `strong`
   and demo-panel internals, and found further AA-but-not-AAA items (listed above). The earlier
   statements were scope-limited, not wrong — but they read as broader than they were.

2. **Two intermediate readings in this audit were measurement artifacts, not defects**, and were
   discarded after verification: `.btn-ghost` at 1.08:1 and `summary` at 1.17:1. Both are the only
   elements carrying `transition: color`, and the preview pane was not compositing
   (`visibilityState: "hidden"`), so the transition never advanced. With transitions disabled they
   measure normally.

### Lighthouse — NOT RUN

No Lighthouse/PSI run is included. The Chrome instance available to this session could not produce
one (its screenshot/capture API has been returning malformed-parameter errors), and I will not
report a score I did not generate. The underlying signals Lighthouse would grade are evidenced
above and by the build output: static export, no third-party requests, no render-blocking external
resources, ~87.5 kB shared JS. **Recommend the Founder run PageSpeed Insights against
`https://honesttotal.com/` for an independent score.**

---

## I. Exact blocking defects

All six found, all fixed, all verified live on `c2df4ef6`.

| ID | Defect | Fix | Verified live |
| --- | --- | --- | --- |
| B1 | CI-enforced neutrality test claimed; does not exist; contradicted `/commission-blind` | Rewritten to "specified and not yet running" | ✅ string absent |
| B2 | "engineered, tested, and auditable" | Rewritten to "a published rule we can be held to" | ✅ string absent |
| B3a | Real product ("Sony XM5") with fabricated price | Replaced with generic category | ✅ string absent |
| B3b | "verified just now" | Replaced with "illustrative exchange, no live data" | ✅ string absent |
| B4 | "≤1¢ AI cost per request" as a metric | Relabelled "design budget, not yet measured" | ✅ present |
| B5/B6 | Present-tense claims for non-existent API, price verification and personalization (incl. the privacy FAQ answer) | Moved to future tense with current state stated | ✅ "No price is served today" present |

Supporting change: visible caption on the guarantee strip so four bare numerals cannot be misread as
usage statistics.

---

## J. Non-blocking improvements

Ordered by reviewer impact. **None was actioned** — the instruction was to fix blocking defects only.

1. **Custom 404 page.** Status code and `noindex` are correct, but the page is the bare Next.js
   default with no navigation and no route home. A reviewer landing on a stale URL sees a dead end.
   Highest-value remaining polish item.
2. **Per-page OG + JSON-LD + breadcrumb on `/`, `/how-we-rank`, `/about`, `/disclosure`.** These four
   predate the pattern the other thirteen use. The home page is a client component and cannot export
   `metadata`, so it needs a different mechanism.
3. **Meta descriptions.** All 17 run 166–226 characters and will truncate in search results.
4. **Brand coherence.** Decide whether the masthead becomes "Honest Total" or the NEXUS codename is
   retired. Currently explained on `/faq`, but explanation costs a reviewer attention.
5. **Residual AA-only contrast** on large accent-green display text. Reaching AAA here means
   darkening the brand green — deliberately **not** done, per instruction.

### Catch-all email — investigated, NOT changed

**Current state (read-only inspection):** Cloudflare Email Routing has an active **Catch-all** rule
forwarding every address at the domain to the Founder's personal mailbox, plus two explicit rules
created earlier: `hello@honesttotal.com` and `privacy@honesttotal.com`, both **Active**. `admin@`
depends on the catch-all — it has no rule of its own.

**Recommendation: disable the catch-all, but only after adding an explicit `admin@` rule.**

- *For disabling:* a catch-all accepts mail to every possible address, so spam to invented addresses
  forwards to a personal inbox indefinitely, and the volume only grows once the domain is indexed.
- *Against disabling right now:* `admin@honesttotal.com` is the identity on the **Impact account**
  and was used for property verification. Removing the catch-all without first creating an explicit
  `admin@` rule would silently break account-recovery and reviewer correspondence — a worse failure
  than spam.
- **Safe order:** create explicit `admin@` → confirm Active → then disable catch-all. `hello@` and
  `privacy@` already have their own rules and are unaffected either way.

**No mail routing was changed. This requires Founder approval.**

---

## K. Final recommendation

# ✅ READY TO REAPPLY

The blocking defects that would have justified a rejection — a fabricated price against a real
product, and a site whose home page contradicted its own methodology page about the one guarantee it
is built on — are fixed and verified in production.

What remains is not a compliance problem. It is the same problem the last decline named: **the site
is new and has no traffic.** That is answered by indexing time and by direct brand applications, not
by editing pages.

**Two qualifications the Founder should carry into the decision:**

1. **This audit does not make the site more established than it is, and deliberately did not try.**
   Every fix moved a claim *towards* admitting pre-launch status, never away from it. A reviewer will
   see a site that says, repeatedly and in its own words, that nothing is running yet. That is the
   correct representation and it is also, honestly, a harder sell than a vaguer site would be.

2. **No provider readiness is claimed.** P0.3 remains **BLOCKED**, the integration checklist remains
   **0/13**, and no connector work was started. This audit changes the public site only.

**The reapplication decision is the Founder's. No application has been or will be submitted
automatically.**

---

## Quality gates — raw results, post-fix

```
prettier   packages/ui/styles.css (unchanged)  apps/web/src/app/page.tsx 271ms
typecheck  Tasks: 9 successful, 9 total
lint       Tasks: 9 successful, 9 total   (1 pre-existing warning in @nexus/auth: '_omitted' unused)
test       @nexus/auth: 483 passed | 45 skipped (528)
           @nexus/ui:    35 passed (35)
           Tasks: 4 successful, 4 total
build      ✓ Generating static pages (24/24)
deploy     Current Version ID: c2df4ef6-3e82-4d31-a15c-8328b9789275
```

Live verification after deploy — 8/8 checks passed:

```
OK   CI-enforced test REMOVED          OK   guarantees caption PRESENT
OK   engineered/tested REMOVED         OK   not-yet-running PRESENT
OK   Sony XM5 REMOVED                  OK   design budget PRESENT
OK   verified just now REMOVED         OK   no price served PRESENT
```
