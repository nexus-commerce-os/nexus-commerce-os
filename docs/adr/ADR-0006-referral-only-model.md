# ADR-0006 — Pure Referral + Deep-Link + Affiliate model (no payments, no custody)

**Status:** Accepted · **Date:** 2026-07-13 · **Deciders:** Founder/CEO (ratified), CTO, CFO, Security/Legal
**Supersedes/constrains:** the "order-custody open question" in [PROJECT_MEMORY](../../PROJECT_MEMORY.md); narrows the agentic-checkout scope in [SDD §4.2](../02-software-design-document.md) and [AI §agent](../05-ai-architecture.md).

## Context

The single largest open architectural question was whether NEXUS takes **custody of orders** (marketplace / dropship / unified checkout) or remains a **pure referral** intelligence layer. Custody would pull in payment processing, Merchant-of-Record status, PCI-DSS card scope, order/fulfillment/returns/chargeback systems, and the associated liability, regulatory, and operational surface — an enormous scope and risk multiplier for a pre-PMF product whose differentiator is *intelligence and neutrality*, not logistics.

## Decision

**NEXUS operates as a Pure Referral + Deep-Link + Affiliate Commerce Platform.**

NEXUS **MUST NOT**: process payments · hold customer funds · become Merchant of Record · own inventory · operate warehouses · fulfill orders · manage shipping · process returns · handle chargebacks.

NEXUS **DOES**: discover products · compare price, shipping, seller trust, and **total landed cost** · summarize reviews (authorized) · detect suspicious listings · recommend the best buying option using AI · **redirect users through official affiliate links or authorized deep-links** where the purchase completes **on the merchant's own checkout**.

### Architectural consequences (normative)
- **No checkout service, no payment gateway, no order-custody service, no inventory/fulfillment engine** in the platform.
- The former "Checkout Orchestration" context is replaced by **Referral & Deep-Link Orchestration (Handoff)** — it resolves the best option, stamps affiliate attribution, and hands the user off. It never touches card data.
- **PCI-DSS card-acceptance scope = none** at launch (no cardholder data enters NEXUS). Outbound **cashback/creator payouts** run through a **licensed payment partner** and are a payout/AML concern, not card acceptance.
- The **Ledger** is retained — but only for cashback/reward **accrual** and creator **payouts**, not order settlement.
- "Order" data is replaced by a lightweight **Referral / Attributed-Conversion** record sourced from affiliate-network **postbacks**.
- **Agentic "delegated checkout / auto-buy"** is narrowed to **agentic decision + one-tap authorized handoff** (+ price-watch → alert → deep-link). True delegated purchase where the agent completes payment is **out of scope until Phase P5+**, subject to a future custody ADR.

## Options considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Pure referral + affiliate + deep-link** | Minimal PCI/liability/ops; fastest to launch; neutrality-native; capital-light | Revenue gated by affiliate rates; no direct checkout data; conversion happens off-platform | ✅ **Chosen** |
| Marketplace / Merchant-of-Record | Full funnel control; take-rate on GMV; richer data | PCI-DSS, MoR liability, chargebacks, fulfillment, returns, huge ops & regulatory surface | ❌ Deferred to P5+ (optional, needs validation) |
| Managed dropship orchestration | Higher margin per order | Custody + fraud + fulfillment liability; supplier risk | ❌ Deferred to P5+ |

## Consequences

- **+** Dramatically smaller attack surface, compliance scope, and ops burden; capital-light; reinforces neutrality; faster P0→P3.
- **+** Removes entire subsystems (payment, order, fulfillment) → less code, less risk, lower cost.
- **−** Revenue depends on affiliate/subscription/ads rather than GMV take-rate (accepted — see [Business Model](../03-business-model.md)).
- **−** Conversion completes off-platform → attribution reliability and postback accuracy become **critical** (see affiliate/attribution risks).
- **−** The "agent buys for you" narrative is softened to "agent decides + hands you off" until P5+ — set expectations in UX/marketing.

## Revenue model (ratified)
**Primary:** affiliate commissions · sponsored placements (clearly labeled) · premium AI subscription (NEXUS+) · merchant analytics · advertising.
**Secondary:** cashback partnerships · coupon partnerships · API licensing.

## Related
[Vision](../01-vision.md), [Business Model](../03-business-model.md), [System Architecture](../04-system-architecture.md), [Security Architecture](../08-security-architecture.md), [Deployment Architecture](../10-deployment-architecture.md), [ADR-0001](ADR-0001-data-sourcing.md).
