# services/affiliate — Affiliate & Attribution + Referral/Deep-Link Handoff

**Status:** Scaffold — not implemented
**Owner:** `@nexus-commerce-os/commerce` (per [`.github/CODEOWNERS`](../../.github/CODEOWNERS) `/services/affiliate/`)
**Runtime / language:** TypeScript (NestJS) — core product API ([SDD §6 — Backend core](../../docs/02-software-design-document.md#6-technology-stack--decisions-with-alternatives)). *(The latency-critical **Affiliate Gateway** connector runtime is Go and lives as its own extracted service — [04 §6.1](../../docs/04-system-architecture.md#61-affiliate-gateway--plugin-connectors--automatic-failover); it is out of this scaffold's scope.)*
**Certified-architecture component:** **Affiliate & Attribution** module + **Referral & Deep-Link Handoff** module ([04 §4](../../docs/04-system-architecture.md#4-component-responsibilities))
**Governing ADRs:** [ADR-0006](../../docs/adr/ADR-0006-referral-only-model.md) (pure referral — no payment/custody), [ADR-0008](../../docs/adr/ADR-0008-affiliate-gateway.md) (gateway connectors/failover), [ADR-0011](../../docs/adr/ADR-0011-attribution-reconciliation.md) (3-way reconciliation), [ADR-0012](../../docs/adr/ADR-0012-postback-integrity.md) (provisional, dedup, order-independent postbacks), [ADR-0013](../../docs/adr/ADR-0013-ledger-per-context.md) (affiliate-accrual sub-ledger), [ADR-0018](../../docs/adr/ADR-0018-connector-security-hardening.md), [ADR-0022](../../docs/adr/ADR-0022-round2-remediation.md) (reversal-ordering NC-3)
**Implemented by phase:** [P0.3 — Commerce Foundation](../../docs/13-implementation-roadmap.md) (Referral Engine, signed handoff) → **[P0.4 — Money Integrity 🔒](../../docs/13-implementation-roadmap.md)** (conversion tracking, affiliate-accrual sub-ledger, reversal, reconciliation)

## Purpose

Owns the terminal referral action: resolve the neutrally-ranked best option → **stamp attribution** → **redirect** the shopper to the merchant's own checkout via a signed, allow-listed deep-link. **No payment, no order custody, no card data** ([ADR-0006](../../docs/adr/ADR-0006-referral-only-model.md)). Ingests async conversion **postbacks** as **provisional, non-payable** accrual (payable only once independently reconciled), deduplicates on purchase-fingerprint, and posts to its append-only affiliate-accrual sub-ledger. A raw postback can never un-reverse a reconciliation-confirmed reversal ([ADR-0022](../../docs/adr/ADR-0022-round2-remediation.md) NC-3).

## Dependencies

- `packages/shared`, `packages/config` (canonical money type — accruals are integer minor-units)
- Affiliate Gateway (Go service) for connector deep-link build / postback ingest — via interface, never a provider SDK in-module ([ADR-0010](../../docs/adr/ADR-0010-platform-principles.md))
- Reconciliation GL (async) + Attribution Reconciliation service (revenue-integrity SLI)

## Scope guard

Scaffold only — **no attribution stamping, no handoff, no postback ingest, no ledger, no reconciliation, no referral logic whatsoever.** `src/` documents intent for P0.3/P0.4.
