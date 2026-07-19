# ADR-0021 — Legal & product-truth decisions (D1–D5)

**Status:** ✅ **ACCEPTED (Founder-ratified 2026-07-14)** — was Proposed/pending-approval; now final unless superseded by a future ADR.
**Date:** 2026-07-14 · **Deciders:** Founder (ratified), Legal Counsel, CPO
**Closes:** R-021, R-022, R-023, R-024, R-037 (policy), R-046, R-047.

> These decisions were reserved to the owner under the autonomous-continuation governance (legal / customer-facing / monetization / neutrality). They are now ratified and binding.

## D1 — Affiliate-commission disclosure (closes R-023, R-047) — APPROVED
NEXUS **MUST** clearly disclose that it may receive affiliate commissions from qualifying purchases.
- A concise disclosure is shown **wherever affiliate links appear**.
- Before redirecting through an affiliate link, the **AI agent MUST transparently state** that the purchase may generate a commission for NEXUS.
- Recommendations **MUST NEVER** be influenced by commission amount.
- Disclosure **MUST be consistent across Web, Mobile, API, and AI responses**.

## D2 — Travel products: independent referrals only (closes R-024) — APPROVED
For launch and until further notice, NEXUS **MUST NOT** create or sell **bundled** travel packages in any jurisdiction where doing so could make NEXUS the **package organizer** (EU/UK Package Travel Regs / ATOL).
- Flights, hotels, car rentals, insurance, and other travel products are presented as **independent referrals only**; users complete bookings **directly with the provider**.
- Travel bundling is **deferred** pending future legal + business review.
- **The referral-only architecture ([ADR-0006](ADR-0006-referral-only-model.md)) is unchanged** — this decision reinforces it.

## D3 — Cashback & jurisdiction gating (closes R-037 policy) — APPROVED
Cashback features are enabled **only after jurisdiction-specific legal review**.
- **Country-level feature flags** ([ADR-0007](ADR-0007-phased-global-rollout.md)); legal approval required before activation.
- Cashback remains **pending** until affiliate confirmation **and** the applicable **hold period** expires (backend enforced by [ADR-0014](ADR-0014-wallet-hold-gate.md)).
- If a commission is **reversed**, the corresponding cashback **MUST** be reversed per published terms.

## D4 — Savings-state UX: four-state model (closes R-021, R-022) — APPROVED
NEXUS uses a transparent **four-state** model, each state with a clear explanation of *why*:
1. **Estimated Savings** · 2. **Pending Confirmation** · 3. **Confirmed Savings** · 4. **Reversed Savings**
- Estimated/pending savings **MUST NEVER** be presented as guaranteed.
- **VMS (Verified Money Saved) MUST be based only on *Confirmed* savings** — this makes the north-star falsifiable (closes R-021) and honest (closes R-022).

## D5 — Commission-Blind Recommendation Policy (closes R-046) — APPROVED
- Ranking is determined by **user value, not commission value**; commission amount **MUST NEVER** increase a product's ranking (backend-enforced by the strengthened neutrality fitness test, [ADR-0020](ADR-0020-performance-consistency-hardening.md) §9 / [04 §10](../04-system-architecture.md)).
- Sponsored content **MUST** always be clearly labeled and distinguishable from organic recommendations.
- Recommendation algorithms **MUST** be **auditable**.
- This policy becomes part of the **public [Trust & Transparency documentation](../12-trust-and-transparency.md)**.

## Consequences
- **+** Closes the last four approval-gated Criticals; the design becomes fully closeable to the gates.
- **+** Strengthens trust/neutrality positioning (a marketing asset, not just compliance).
- **−** Travel is narrower at launch (no bundles in regulated geos) — accepted.
- **−** Cashback rollout is gated per-jurisdiction — accepted (safety > speed).

## Rollback / migration
Each decision is a policy + config surface (disclosure component, country flags, savings-state model, ranking audit). Reversing any requires a superseding ADR; the safe defaults (disclose, don't-bundle, gate-cashback, confirmed-only-VMS, commission-blind) are the standing policy.

## Related
[Vision](../01-vision.md), [Business Model](../03-business-model.md), [AI](../05-ai-architecture.md), [Security](../08-security-architecture.md), [Product Guidelines](../11-product-guidelines.md), [Trust & Transparency](../12-trust-and-transparency.md), [ADR-0006](ADR-0006-referral-only-model.md), [ADR-0014](ADR-0014-wallet-hold-gate.md), [ADR-0020](ADR-0020-performance-consistency-hardening.md).
