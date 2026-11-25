# Catalog publication audit — 25 November 2026

Can the existing ten-product catalog be published today, as a clearly labelled
**specification-only** discovery experience, without any merchant agreement?

**Finding: yes.** The data already meets the bar, the page already says what it
is, and the machine checks that keep it honest already run on every build. What
has been holding it back is a release switch, not a data problem.

The premise behind the question is the important part: **specification
comparison is not price comparison.** Reading a manufacturer's own published
spec page tells you what a product *is*. It needs no affiliate relationship, no
feed licence and no merchant. Price comparison needs all three. Treating them
as one thing is what kept a publishable catalog withheld.

---

## What was audited

| # | Requirement | Finding |
|---|---|---|
| 1 | **Permission to reproduce source data** | Each record is a transcription of factual specifications from the manufacturer's own public page, with the exact `sourceUrl` cited and linked back. No images are stored or rendered — `verify-catalog.mjs` fails the build if any record carries an image URL, so the one asset class with real rights risk cannot appear by accident. No marketing copy is reproduced; `summary` is neutral description. |
| 2 | **Manufacturer source accuracy** | All 10 `sourceUrl` values are `https` on the manufacturer's **own** domain, across **9 distinct hosts** (sennheiser, bose, lg, samsung ×2, crucial, apple, corsair, daskeyboard, keychron). The gate refuses any source that is not on the maker's domain. |
| 3 | **Specification completeness** | Values are transcribed verbatim in the manufacturer's own units and wording. Where a page states nothing, the field is **absent rather than guessed**. Where a page covers several variants, the ambiguity is recorded in `notes` instead of silently picking one. |
| 4 | **Product identifiers** | 7 of 10 carry the model number exactly as printed (`OLED65C4PUA`, `MZ-V9P2T0B/AM`, `CT1000P3PSSD8`, `CH-9109410-NA`, `K2-A1Z`, `MU-PE2T0S/AM`, `508824`). 3 are `null` because the maker's page prints none. `null` is recorded as a finding, not filled in. No GTINs — correctly, since none were published on the source pages. |
| 5 | **Data freshness** | Every record carries `verifiedOn`, all 2026-11-08/09 — **16–17 days old**. For specifications that is fresh: a published spec sheet does not move the way a price does. The gate refuses a malformed or future date. |
| 6 | **Search** | **Genuinely functional, measured in a browser**: `OLED` → 1 result (LG C4), a nonsense query → 0 results with an empty state. Matches whole words, and finds a product by brand and by model number. Not a decorative control. |
| 7 | **Specification comparison** | Specs render per product with their source and verification date. A side-by-side comparison across products is **not** built yet — see below. |

## What the gate already enforces, on every build

`apps/web/scripts/verify-catalog.mjs` — 10 verified products, 5 categories, all
checks passing:

- no record carries a price, stock, rating or merchant field
- no specification value states a currency amount or a star rating
- no record carries an image URL, and no card renders an `<img>`
- the catalog pages name no merchant at all
- no product JSON-LD asserts price or availability
- the detail page cites its source and verification date
- the list page and the sitemap agree on indexability, so they cannot drift

These are the reason this can be published without anxiety: the honest state is
checked by a machine on every build, not maintained by remembering.

## Source permission, looked at properly (25 November, second pass)

The first pass of this audit said permission was fine because specifications
are facts. That was too quick, and the founder was right to push on it:
**public availability is not permission**, and these records transcribe each
manufacturer's own wording, which is expression rather than fact.

So the exposure was measured rather than argued about. What is actually
reproduced, across all ten records:

| | |
|---|---|
| spec label/value pairs | **56** |
| median value length | **18 characters** (`300 Ω`, `260 g`, `dynamic, open`) |
| longest value | **79 characters** |
| values over 80 characters | **0** |
| prose copied from a maker's page | **none** |
| images | **none** — the gate fails the build if one appears |
| `summary` field | **ours**, written neutrally (median 83 chars), not transcribed |

That matters because the two things carry different risk. A short factual
value — an impedance, a weight, a port list — is a fact, and facts are not
copyrightable. Copied marketing prose would be expression, and there is none
here: the longest single value in the entire catalog is 79 characters and
reads like a parts list, because that is what it is.

**What is still not established, and I will not pretend otherwise.** Nobody
has read the ten manufacturers' terms of use. Several large retail and maker
sites prohibit automated extraction or redistribution in their terms,
independently of copyright, and a term of that kind can bind even where
copyright does not reach. I am not in a position to give a legal opinion on
whether those terms apply to a hand-transcribed factual table with
attribution and a link back.

So the honest position is: **the copyright exposure is small and measured;
the contractual position is unchecked.** The remaining work is (a) reading
the terms for the nine source domains, which is ordinary diligence, and
(b) a lawyer's sign-off if the founder wants certainty rather than a
reasonable position — which only the founder can obtain.

Two cheap risk reductions are available immediately and need no one's
permission: keep `noindex` on for this release, and keep every record's
`sourceUrl` prominent on the page, so the catalog reads as a citation index
pointing at the manufacturer rather than a substitute for their page.

## Recommendation

1. **Publish the pages** — make `/products` and the 10 detail pages reachable.
   They are currently withheld from the artifact by `gate-catalog.mjs`, which
   was the right call while "unready" and is now simply out of date.
2. **Keep `noindex` for this release.** Ten products is not a catalog a search
   engine should be invited to rank, and two records are end-of-life or
   superseded by the maker's own admission. Reachable and indexable are
   separate decisions; this publishes the first without the second. The gate
   asserts the page and the sitemap agree, so this stays consistent.
3. **Label it unmistakably** as specifications only — no prices, no stock, no
   merchants — on the page itself, not only in the metadata.
4. **Build spec comparison** (requirement 7) as the next increment: pick two or
   three products in a category, see their specs side by side with each value's
   source and date. This needs no merchant relationship either.

## What this does NOT unblock

Price comparison, availability, merchant links, "best total" ranking and
affiliate revenue all still require an authorized feed and a signed agreement.
Nothing in this audit changes that, and no page produced from this catalog may
imply otherwise.
