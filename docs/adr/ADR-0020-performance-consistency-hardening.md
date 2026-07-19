# ADR-0020 — Performance, data-scale & contract-consistency hardening

**Status:** Accepted (remediation, Review R1, WS-J + perf) · **Date:** 2026-07-14 · **Deciders:** CTO, Performance Engineer, Principal Backend, Database Architect, API Architect
**Closes:** R-008, R-026, R-027, R-028, R-030, R-031, R-032, R-038, R-039, R-040, R-041, R-042, R-043, R-044, R-045, R-051, R-079, R-080, R-083, R-084(retention).

## Context
The core loop was a serial multi-hop fan-out (400 ms p95 unachievable with enrichment); a cache-miss live-price could thunder-herd; viral products created hot partitions; and money/i18n numbers could **drift** across 3 runtimes × 3 contract formats (OpenAPI, GraphQL SDL, protobuf independently authored) and across the Web/Agent BFFs.

## Decision
**Performance**
1. **Single-flight request coalescing** (R-008): concurrent live-price requests for the same offer collapse to **one** upstream call (singleflight); the herd waits on one result. Removes the per-cache-hit thundering herd.
2. **Parallel core-loop fan-out** (R-079): search → price/coupon/cashback enrichment runs **concurrently with deadlines + partial-result fallback**, not serially; the p95 budget is allocated per hop with a hard total.
3. **Hot-partition mitigation** (R-080): viral products use **key-salting + read-replica fan-out** for the hot key; partitioning is by a composite key, not raw `HASH(product_id)`.
4. **OpenSearch write-amplification** (R-083): highest-fan-in products use a **parent-offer / child-price** model or update throttling to avoid re-indexing the whole nested doc per price tick.

**Consistency / contracts (→ documentation & maintainability)**
5. **One canonical money type** (R-038, R-039): money is **integer minor-units + ISO currency**, defined once and code-generated into all 3 runtimes; **FX normalization** is an explicit ranking step (cross-currency compares are normalized).
6. **Contract-first single source of truth** (R-040, R-041, R-042): the API contract is authored **once** and OpenAPI + GraphQL SDL + protobuf are **generated** from it; Web BFF and Agent BFF consume the **same** offer-view resolver (no divergent numbers). The agent tool-invocation protocol is **one** defined mechanism (tool-RPC), ending the tool-RPC-vs-REST `:invoke` contradiction.
7. **Client price-freshness contract** (R-043, R-044, R-051): every price carries `as_of` + a freshness class; passive browsing shows staleness; **"buy intent"** is explicitly defined (the event that triggers a Tier-3 live check); SSE has **resume/idempotency** across a confirmation-gated tool call.

**Boundaries / neutrality enforcement**
8. **Boundary enforcement is real** (R-026, R-027, R-028): modules use **separate DB schemas + separate DB roles** (not just a shared pool), the AI service does **not** call Core synchronously on the hot path (async/read-model), and boundary tests assert role-scoped access. This makes the "modular monolith" boundary enforceable, not aspirational.
9. **Neutrality test strengthened** (R-045): the neutrality golden test detects **indirect / commission-correlated** bias (not just direct sponsorship reorder), by asserting ranking invariance under commission perturbation. *(This strengthens enforcement of the ratified neutrality principle — it does not change the principle.)*
10. **Connector pinned to referral lifecycle** (R-030, R-031, R-032): a referral pins its connector for its lifecycle; `buildDeepLink` commitment failures fall back cleanly (no orphaned referrals); the connector interface models **capability/attribution asymmetry** explicitly (not a lowest-common-denominator).
11. **Referral retention respects reversal windows** (R-084): retention ≥ longest return/reversal window (aligns with [ADR-0012](ADR-0012-postback-integrity.md)).

## Backward compatibility / Migration / Rollback
- **Compat:** contract-first regenerates the *same* external contracts (no consumer break); money-type is internal representation.
- **Migration:** stand up the single-source contract pipeline; migrate money columns to minor-units with an expand→contract migration; introduce singleflight + parallel fan-out behind flags.
- **Rollback:** perf changes are flag-guarded; the canonical money type and contract-first pipeline are **not** rollback-eligible (reverting reopens drift Criticals).

## Affected docs
[02 §4/§5](../02-software-design-document.md), [04 §2/§5](../04-system-architecture.md), [05](../05-ai-architecture.md), [06 §7/§10](../06-database-architecture.md), [07 §1/§2/§4/§8](../07-api-architecture.md).
