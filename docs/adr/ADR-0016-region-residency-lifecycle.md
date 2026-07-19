# ADR-0016 — Multi-region residency, DR & data-lifecycle integrity

**Status:** Accepted (remediation, Review R1, WS-D) · **Date:** 2026-07-14 · **Deciders:** CTO, Cloud Architect, Privacy & Compliance, SRE
**Closes:** R-010, R-013, R-014, R-015, R-036, R-073, R-074, R-075, R-076.

## Context
"Multi-region/residency" claims outran the provisioned topology: write-home money/PII was a **single-region SPOF** with no in-zone DR pair; **multi-region infra (P6) landed *after* the EU/BD markets (P3/P4)** that legally require it; the AI gateway had **no residency fence** (PII could route to an out-of-region LLM); and erasure never reached affiliate networks nor survived backup restore.

## Decision
1. **Region-before-market gate (MUST)** (R-014, R-073): a market's country flag **cannot** be enabled until its **compliant region (incl. an in-zone DR pair) is provisioned and residency-tested**. Network-layer routing is default-deny to unlaunched regions. This re-sequences infra ahead of P3/P4 market opens (updates [10](../10-deployment-architecture.md) plan + [09](../09-cloud-architecture.md)).
2. **In-zone DR pair per regulated region** (R-013): each residency zone has a **second in-zone AZ-independent region/failover** so money/PII survive a full-region loss without cross-residency failover; the Kafka "RPO≈0" claim is scoped to *in-zone* replication (the cross-region-false claim is corrected).
3. **Residency-fenced AI gateway (MUST)** (R-010): the AI Gateway tags every request with the user's residency; PII-bearing inference is pinned to an **in-region** model (in-region hosted OSS or a residency-compliant endpoint); out-of-region model calls for PII are **hard-blocked**.
4. **Erasure cascade completeness** (R-015, R-075): erasure is an orchestrated saga across **all ~15 bounded contexts** with a completeness ledger; where a user's data reached an affiliate network, a **network data-deletion/suppression request** is issued and tracked; post-erasure postbacks for that user are dropped.
5. **Backup crypto-shred survives restore** (R-076): per-user DEK crypto-shredding means a restored backup **cannot resurrect** erased PII (the DEK is gone); restore tests assert this.
6. **Portable DR proof** (R-036): DR RTO/RPO is validated on the **portable Postgres** path (not only Aurora features) via game-days, so the portability claim ([ADR-0003](ADR-0003-cloud-provider.md)/[ADR-0010](ADR-0010-platform-principles.md)) is real.
7. **Signup residency default** (R-074): residency is resolved at signup from verified signals with a **strict default**; a mis-set residency is change-controlled and audited.

## Backward compatibility / Migration / Rollback
- **Compat:** residency fence + region-gate are additive guards; no API break.
- **Migration:** provision in-zone DR pairs + residency fence **before** enabling P3/P4 flags; erasure-cascade orchestrator rolled out with a completeness backfill.
- **Rollback:** region-gate and residency-fence are safety guards — **not** rollback-eligible (disabling reopens a legal Critical). DR topology changes are Terraform-reversible.

## Affected docs
[06 §11](../06-database-architecture.md), [08 §9.3/§10](../08-security-architecture.md), [09 §2/§6](../09-cloud-architecture.md), [10 §12](../10-deployment-architecture.md), [05](../05-ai-architecture.md) (residency fence).
