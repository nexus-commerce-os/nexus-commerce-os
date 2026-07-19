# ADR-0017 — Blast-radius isolation (de-SPOF the "no-SPOF" concentrations)

**Status:** Accepted (remediation, Review R1, WS-E) · **Date:** 2026-07-14 · **Deciders:** CTO, SRE, Cloud Architect
**Closes:** R-009, R-020, R-029, R-059, R-060, R-078, R-082.

## Context
Several components were called "no SPOF" but were single systemic blast radii: one AI routing-policy config, one egress proxy chokepoint, one Affiliate Gateway router/health-check, one shared EKS cluster mixing discovery + money, one shared Redis, and an observability stack with an autoscaling circular dependency.

## Decision
1. **AI routing-policy config: versioned + canaried + regional** (R-009): the config is a **versioned artifact** rolled out via canary per region; a bad policy blast-radius is one canary cohort, not the platform. Prior version auto-pins on eval regression ([ADR-0015](ADR-0015-ai-trust-cost-integrity.md)).
2. **Egress: horizontally-scaled cells, not one chokepoint** (R-020): the allowlisted egress is a **fleet of egress cells** (throughput scales horizontally); losing one cell reroutes. The allowlist stays a metering/security point but is not a single throughput or availability bottleneck.
3. **Affiliate Gateway is cellular** (R-029): the Gateway runs as **stateless replicas with independent per-connector health**; no shared health-check or router instance gates all traffic. (Complements [ADR-0008](ADR-0008-affiliate-gateway.md) failover with intra-Gateway HA.)
4. **Cluster/node isolation: discovery vs money** (R-059): discovery (search/AI, elastic, best-effort) and money/handoff/ledger (strict SLO) run on **separate node pools / clusters** so a discovery surge cannot starve the money path or couple their SLOs.
5. **Redis isolation** (R-082): money/auth Redis is a **separate cluster** from the high-churn catalog-invalidation cache; catalog cache stampedes cannot evict session/auth/rate-limit state.
6. **Observability HA, off the critical path** (R-060): metrics/logs/traces run on a **separate failure domain** (managed or dedicated cluster) with no autoscaling circular dependency (the thing that scales the app can't depend on the app to be up).
7. **GPU warm floor** (R-078): a **minimum warm GPU pool** guarantees the agent first-token 1.2 s SLO; scale-to-zero applies only to batch/eval, never the interactive path.

## Backward compatibility / Migration / Rollback
- **Compat:** all changes are topology/deployment; no API or data contract change.
- **Migration:** split clusters/Redis via blue-green; introduce egress cells behind the existing allowlist interface; add warm-pool HPA floor.
- **Rollback:** each split is reversible by Helm/Terraform; reverting recombines pools (reopening the coupling risk, logged).

## Affected docs
[04 §8](../04-system-architecture.md), [06 §7](../06-database-architecture.md) (Redis), [09 §2/§3/§4/§11](../09-cloud-architecture.md), [10 §7](../10-deployment-architecture.md).
