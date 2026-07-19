# 11 — Product Guidelines

**Status:** 🟢 Draft-complete (R4-remediated) · **Owner:** CPO + Product · **Depends on:** [01 Vision](01-vision.md), [ADR-0021](adr/ADR-0021-legal-product-truth.md), [ADR-0006](adr/ADR-0006-referral-only-model.md)

---

These are the **binding product-behavior rules** that turn the ratified decisions into consistent user-facing behavior across **Web, Mobile, API, and AI agent** surfaces. They are normative (RFC-2119) and testable; QA verifies them as acceptance criteria.

## 1. Affiliate-commission disclosure (D1)

- A **concise commission disclosure MUST appear wherever affiliate links are shown** (result cards, offer detail, handoff screens).
- Before an affiliate redirect, the **AI agent MUST state, in natural language, that the purchase may earn NEXUS a commission** — e.g. *"Heads up: if you buy through this link, NEXUS may earn a commission. It never affects what I recommend."*
- The disclosure copy and behavior **MUST be consistent across all surfaces** (Web, Mobile, API responses carry a `disclosure` field; the agent verbalizes it).
- **Recommendations MUST NEVER be influenced by commission amount** (enforced by [D5](#4-commission-blind-recommendations-d5) + the neutrality fitness test).

## 2. Savings-state model — four states (D4)

Every savings figure shown to a user carries exactly one state, **each with a plain-language "why":**

| State | Meaning | Rule |
|-------|---------|------|
| **Estimated Savings** | Projected before purchase | MUST be labeled "estimated"; **never** shown as guaranteed |
| **Pending Confirmation** | Purchase made; awaiting affiliate confirmation + hold period | Show expected confirmation window |
| **Confirmed Savings** | Affiliate-confirmed and past the hold period | The only state that counts toward VMS |
| **Reversed Savings** | Commission/cashback reversed (return/cancellation) | Explain the reversal per published terms |

- **VMS (Verified Money Saved) MUST be computed from *Confirmed* savings only** — this makes the north-star honest and falsifiable ([Vision §4](01-vision.md#4-north-star-metric--guardrails)).
- Backend state is enforced by the wallet available/held model ([ADR-0014](adr/ADR-0014-wallet-hold-gate.md)); this section governs **presentation**.

## 3. Travel — independent referrals only (D2)

- Flights, hotels, car rentals, insurance, and other travel products are presented as **independent referrals**; the user **books directly with the provider**.
- NEXUS **MUST NOT** create or sell a **bundled travel package** in any jurisdiction where that could make NEXUS the **package organizer** (EU/UK Package Travel / ATOL).
- Travel bundling is **deferred** pending legal + business review; the referral-only model ([ADR-0006](adr/ADR-0006-referral-only-model.md)) is unchanged.

## 4. Commission-blind recommendations (D5)

- Ranking is by **user value, not commission value**; commission amount **MUST NEVER** raise a product's rank.
- **Sponsored content MUST always be clearly labeled** and visually distinguishable from organic results, on **every** surface (including agent responses, which MUST say a placement is sponsored).
- Users **MUST** be able to tell sponsored from organic at a glance.
- Recommendation logic is **auditable** (see [Trust & Transparency](12-trust-and-transparency.md)).

## 5. Cashback behavior (D3)

- Cashback is enabled **per-country only after legal review** (country feature flag, [ADR-0007](adr/ADR-0007-phased-global-rollout.md)).
- Cashback stays **Pending** until affiliate confirmation **and** the hold period expire; a reversed commission reverses the cashback per published terms.
- The user is always shown the current cashback **state** and the reason (§2).

## 6. Agent conduct rules (cross-cutting)

The AI agent **MUST**: disclose commissions before redirect; label sponsored placements; state savings honestly by state; never imply it completed a purchase (it hands off — [ADR-0006](adr/ADR-0006-referral-only-model.md)); never claim an unverified price ([ADR-0015](adr/ADR-0015-ai-trust-cost-integrity.md)); never let commission influence a recommendation.

## 7. Consistency & testability

Every rule here is an **acceptance test** owned by QA and enforced in CI where automatable (e.g., "affiliate result without a disclosure field fails"; "sponsored result without a label fails"; "VMS includes a non-confirmed item fails"). Cross-surface consistency is a release gate.

---
*Related: [12 — Trust & Transparency](12-trust-and-transparency.md) · [ADR-0021](adr/ADR-0021-legal-product-truth.md)*
