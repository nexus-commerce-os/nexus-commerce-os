# Artifact 3 — Integration Readiness Checklist

**Nothing is checked until evidence exists.** A box is ticked only when the *Evidence* column names
a real, retrievable artifact — a document, a portal page, a recorded sample. Not a recollection, not
a marketing page, not an assumption.

---

## 1. Checklist

| # | Item | Status | Evidence required | Evidence held |
| --- | --- | --- | --- | --- |
| 1 | Affiliate account approved | ☐ | Approval notice from the network, account identifier visible in the portal | — |
| 2 | API access granted | ☐ | API section reachable in the account; credential creation screen available | — |
| 3 | Feed enabled | ☐ | At least one catalog listed for an approved merchant | — |
| 4 | Documentation downloaded | ☐ | Authenticated reference pages saved locally, with retrieval date | — |
| 5 | Test credentials issued | ☐ | Credentials created **and stored in the secret store** — never in this repo | — |
| 6 | Rate limit known | ☐ | Documented limits confirmed against the account's own tier | Public docs give Impact hourly limits (artifact 1 row 19); **account-specific tier unconfirmed** |
| 7 | Cache policy known | ☐ | Contractual caching terms, in writing → sets `license_tag.cache_ttl_max_s` | — |
| 8 | Display policy known | ☐ | Price/image/trademark display terms, in writing | — |
| 9 | Attribution policy known | ☐ | Attribution window and model, in writing | — |
| 10 | Merchant list available | ☐ | List of approved merchants carrying over-ear headphones | — |
| 11 | **Shipping capability verified** | ☐ | Real records showing explicit free-shipping eligibility — **the §4a gate** | — |
| 12 | GTIN coverage sampled | ☐ | Completed §4b sample table from real records | — |
| 13 | Deep link verified | ☐ | A generated tracking link that resolves to the intended merchant page and carries our `click_id` | — |

**Current count: 0 of 13.**

## 2. Rules for ticking a box

- **Item 6** is not satisfied by artifact 1. Published limits are a general statement; the account's
  applicable tier can differ, and the documentation itself says limits are "subject to change".
- **Items 7, 8, 9** must be *written contractual terms*. A support agent's verbal assurance is not
  evidence and must not be recorded as one.
- **Item 11** is the gate. If it cannot be ticked, items 12 and 13 are irrelevant — the provider
  fails qualification regardless of how good the rest looks.
- **Item 12** requires the real sample, not a schema statement. `Gtin` existing in the model proves
  nothing about coverage.
- **Item 13** must be verified end to end: link generated → followed → correct merchant page reached
  → identifier visible in the provider's own reporting. A 200 response is not verification.
- **Item 5**: creating credentials is the operator's action. They are entered directly into the
  secret store. They never appear in chat, a ticket, a commit, a screenshot, or this file.

## 3. Founder collection list — steps 3 and 4

After approval, collect **only** these, and hand them over for analysis:

- Official API documentation
- Feed documentation
- Merchant catalog specification
- Authentication guide
- Field definitions
- Cache and display rules
- Affiliate-link documentation

**Never share API keys, secrets, tokens, or passwords.** Those are entered by the operator directly
into the secret store. Nothing in the list above requires a credential value to be useful — a field
definition and an auth *guide* are documentation; an auth *token* is not.

## 4. Next engineering gate — P0.3 Provider Verification Report

After provider approval, the only authorized engineering output is a **P0.3 Provider Verification
Report** containing these eleven items. Each maps to evidence gathered here.

| # | Required item | Fed by |
| --- | --- | --- |
| 1 | Account approval evidence | Checklist item 1 |
| 2 | Real API capability | Artifacts 1 and 2, re-answered from the authenticated reference |
| 3 | GTIN coverage sample | Checklist item 12 → §4b sample table |
| 4 | Shipping capability verification | Checklist item 11 |
| 5 | **Explicit free-shipping evidence** | Checklist item 11, judged against **Ruling 1** |
| 6 | Item freshness capability | Judged against **Ruling 2** — catalogue-only time is not item freshness |
| 7 | Rate limits | Checklist item 6, confirmed for this account's tier |
| 8 | Cache policy | Checklist item 7 → `license_tag.cache_ttl_max_s` |
| 9 | Display restrictions | Checklist item 8 |
| 10 | Deep-link verification | Checklist item 13 |
| 11 | Provider-specific blockers | Risk register, updated with real findings |

**If every mandatory capability passes → status `PROVIDER READY`.** Only then may authorization to
implement the first connector be requested. A passing report does not itself authorize code.

**If any mandatory capability fails**, the report says so and the status stays blocked. A report that
reaches `PROVIDER READY` with an item unevidenced would be the exact status inflation this whole
sequence exists to prevent.

## 5. Exit condition

All thirteen ticked with evidence → artifact 9 may be revised from `BLOCKED` to `READY`, and
connector implementation may be proposed to the CTO for approval.

Any item unticked → the readiness report stays `BLOCKED` or `NOT READY`. **Partial readiness does
not authorize partial implementation.**
