# ADR-0019 — Real portability & operational maturity

**Status:** Accepted (remediation, Review R1, WS-H) · **Date:** 2026-07-14 · **Deciders:** CTO, DevOps Lead, SRE, Cloud Architect
**Closes:** R-012, R-018, R-019, R-058, R-061, R-062, R-063, R-064, R-077.

## Context
"Multi-cloud-capable" was unproven (AWS-proprietary control plane unabstracted); there was **no EKS upgrade strategy**; GitOps self-heal could **silently revert break-glass fixes** mid-incident; the rollback-doc gate checked *presence* not *proof*; on-call follow-the-sun was gated to H3 but markets go live at P3–P4; connector tests only exercised clean outages; self-hosted ClickHouse (a FinOps SoR) had no operator/quorum story.

## Decision
1. **Portability is tested, not asserted** (R-012): a CI **portability check** fails on un-abstracted provider SDK use; a documented, periodically-rehearsed **exit runbook** proves a region can be re-platformed. This upgrades [ADR-0010](ADR-0010-platform-principles.md)'s adapter-boundary lint to include a real re-platform game-day.
2. **EKS upgrade strategy** (R-019): **blue-green node groups** + surge upgrades + pinned add-on versions + a tested rollback per control-plane/n-1 skew; upgrade cadence is a scheduled, rehearsed operation.
3. **GitOps break-glass mode** (R-018): a declared **break-glass** freezes self-heal/reconciliation for a scoped resource during an incident so an operator's emergency fix isn't reverted; exit re-enables reconciliation and reconciles intentionally.
4. **Rollback is proven, not present** (R-064): the CD gate runs the rollback in a preview env (or scheduled game-day) and asserts it restores service within its stated max time — a static doc is insufficient.
5. **Follow-the-sun on-call at first non-home market** (R-063): 24×7 coverage begins at **P3** (first non-US markets), not H3.
6. **Gray-failure connector tests** (R-062): connector conformance/failover tests inject **latency, partial responses, corrupt payloads, and slow-drain** — not only clean outages.
7. **ClickHouse operated properly** (R-077): use the ClickHouse Kubernetes **operator** (or ClickHouse Cloud) with replication/quorum + PVC affinity; the FinOps/analytics SoR has a real HA story (or is explicitly rebuildable from Kafka).
8. **Flaky-quarantine excludes the eval gate** (R-058): probabilistic AI eval gates are **not** auto-quarantined as "flaky"; they use statistical thresholds ([ADR-0015](ADR-0015-ai-trust-cost-integrity.md)), not the deterministic-test quarantine path.
9. **Region bring-up from zero** (R-061): opening a region is a rehearsed **backfill/warm-up runbook** (Kafka backlog drain, cache warm, projection catch-up), not a cold flag-flip.

## Backward compatibility / Migration / Rollback
- **Compat:** all changes are pipeline/ops; no product contract change.
- **Migration:** add the portability + real-rollback + gray-failure gates to CI; introduce break-glass + region bring-up runbooks; adopt the ClickHouse operator.
- **Rollback:** gates can be reverted to advisory (logged risk); break-glass is itself the rollback tool.

## Affected docs
[09 §1/§3/§7](../09-cloud-architecture.md), [10 §2/§3/§4/§5/§7/§8](../10-deployment-architecture.md), [ADR-0010](ADR-0010-platform-principles.md).
