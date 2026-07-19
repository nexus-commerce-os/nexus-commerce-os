# ADR-0009 — AI cost strategy: ≤ $0.01 per resolved request

**Status:** Accepted · **Date:** 2026-07-13 · **Deciders:** Founder/CEO (ratified), CTO, AI Architect, FinOps

## Context

AI inference is the largest controllable variable cost ([Business Model §5](../03-business-model.md)). OQ#4 ratifies a hard economic target and the mechanisms to hold it, extending [ADR-0005](ADR-0005-ai-model-gateway.md) (model-agnostic gateway) with cost governance. This makes [NFR-AI-02](../02-software-design-document.md#5-non-functional-requirements-nfrs) a concrete, enforceable number.

## Decision

**Target: blended AI inference cost ≤ $0.01 USD per resolved shopping request** (rolling blended average, enforced as a FinOps SLO, not per-call hard fail).

The **AI Gateway MUST dynamically select the cheapest model capable of meeting the request's quality target** ("cheapest-capable routing"), via:

- **Model Router** — routes per request by required capability/quality.
- **Model Cascade** — cheap/small tier first; escalate to frontier only when quality gates require it (target ~70% of traffic on the cheap tier).
- **Multi-tier caching** — **prompt cache**, **embedding cache**, **response cache**, and **semantic cache** (near-duplicate query reuse) — each with explicit TTLs and invalidation on `offer.upserted`.
- **Local OSS + cloud model support** — self-host OSS for high-volume/cheap/residency-sensitive work; cloud frontier for the hardest reasoning. Model-agnostic ([ADR-0005](ADR-0005-ai-model-gateway.md), [ADR-0010](ADR-0010-platform-principles.md)).
- **Automatic cost optimization** + **automatic quality evaluation** — routing decisions continuously tuned against a quality/cost objective; every route change passes the eval gate.

**Cost governance (MUST):**
- **FinOps dashboard** — real-time blended cost/request, cache hit-rates, tier mix, cost per feature.
- **Cost anomaly detection** — alert on deviation from baseline.
- **Budget tracking at three granularities** — **per-user**, **per-session**, **per-feature** — with soft-throttle/degrade policies when a budget is exceeded (never a hard user-facing failure; degrade to cheaper tier or cached answer).

## Options considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Single frontier model for everything | Simplest, best quality | 10–100× cost; blows the target | ❌ |
| Fixed cheap model only | Cheapest | Quality fails on hard requests | ❌ |
| **Cheapest-capable routing + cascade + multi-cache + FinOps** | Meets cost **and** quality; observable | Router/eval complexity; cache correctness | ✅ **chosen** |

## Consequences
- **+** NFR-AI-02 becomes measurable and enforceable; unit economics protected at scale.
- **+** Model-agnostic, no lock-in; cost is a per-request optimization, not a fixed bet.
- **−** Caches risk staleness (bad price claims) — semantic/response caches MUST respect price-freshness (SDD §8) and never serve a stale *price* claim; grounded facts re-verified.
- **−** Router + continuous eval is real engineering (owned by AI layer + MLOps).

## Rollback
Routing policy is versioned config; a bad policy rolls back instantly. Any cache tier can be disabled by flag (degrades to cost, not correctness). Cost ceiling breach trips FinOps alert + auto-degrade, never a hard outage.

## Related
[AI Architecture](../05-ai-architecture.md), [ADR-0005](ADR-0005-ai-model-gateway.md), [Cloud §FinOps](../09-cloud-architecture.md), [Business Model §5](../03-business-model.md).
