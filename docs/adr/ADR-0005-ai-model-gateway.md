# ADR-0005 — Model-agnostic AI Gateway (Router)

- **Status:** Proposed
- **Date:** 2026-07-13
- **Owner:** AI Orchestrator (with LLM/RAG/Search/Rec engineers)
- **Depends on:** [SDD §6](../02-software-design-document.md#6-technology-stack--decisions-with-alternatives), [System Architecture §3–4](../04-system-architecture.md), [AI Architecture §2](../05-ai-architecture.md)
- **Related:** [ADR-0001 data-sourcing](ADR-0001-data-sourcing.md), [ADR-0004 architecture-style](ADR-0004-architecture-style.md)

---

## Context

NEXUS is agent-first: every core capability — the Conversational Shopping Agent, AI Search, Recommendations, Review Synthesis, Translation, Vision — depends on LLM/embedding inference. Three forces constrain how we consume that inference:

1. **Cost.** AI inference + infra is the largest controllable variable cost ([Business Model §5](../03-business-model.md)), and unit economics assume a low blended AI cost per query (`NFR-AI-02`; the `−$0.06/purchase` line in [Business Model §4](../03-business-model.md)). Paying frontier prices for trivial tasks breaks the model.
2. **Reliability & independence.** A single-provider dependency makes a vendor outage a full product outage and gives us zero pricing leverage or negotiating position, plus lock-in.
3. **Quality, compliance & residency.** Different tasks need different models; PII-sensitive and data-residency-constrained work ([NFR-PRIV-01](../02-software-design-document.md#5-non-functional-requirements-nfrs)) may need self-hosted or specific-provider routing, while the hardest reasoning needs a frontier model.

The SDD already committed the baseline ("AI gateway: model-agnostic router (Claude/GPT/OSS)"), and [System Architecture §9](../04-system-architecture.md) flagged the router as "a critical component — hardened." This ADR ratifies that decision and its consequences.

## Decision

Adopt a **model-agnostic AI Gateway**: a first-class internal service (Python/FastAPI, part of AI Serving, [04 §3](../04-system-architecture.md)) through which **all** LLM, embedding, rerank, and vision calls pass. No application code holds a provider SDK directly.

The Gateway MUST provide:

1. **One internal API** (`/complete`, `/embed`, `/rerank`, `/vision`) decoupled from any provider.
2. **Policy-based routing** on cost × quality × latency SLA × data-residency/PII sensitivity — routing is **configuration/data**, not code.
3. **Cheap-model-first cascade** (Tier-1 OSS/small → Tier-2 mid → Tier-3 frontier), escalating only on low confidence or failed claim-verification, enforcing `NFR-AI-02`.
4. **Failover** across providers on error/timeout ([SDD §9](../02-software-design-document.md#9-failure--degradation-design)).
5. **Caching** (exact + semantic + prefix, Redis) and **batching** (embeddings/offline), with the invariant that **price/product-fact claims are re-grounded on every cache hit** ([AI Architecture §2.5, §4.3](../05-ai-architecture.md)).
6. **Budget metering** — per-query cost cap enforced at the Gateway (`NFR-AI-02`).
7. **Provider abstraction** (`ModelProvider` interface) with contract tests, backing Claude, GPT, and self-hosted OSS (vLLM).

## Options considered

| Option | Description | Pros | Cons | Verdict |
|--------|-------------|------|------|---------|
| **A. Single-vendor SDK everywhere** | Call one frontier provider directly from app code | Simplest, fastest to start, best single-model quality | Highest cost, vendor outage = product outage, lock-in, no residency control | ❌ Rejected |
| **B. Client-side abstraction only** (LangChain-style) | Library-level provider switching in each caller | Some portability, no new service | Routing/cascade/cache logic duplicated per caller; no central budget/failover; hard to audit | ❌ Rejected |
| **C. Dedicated server-side model-agnostic Gateway** | One hardened service owning routing, cascade, cache, failover, budget | Cost control, provider independence, per-request quality/residency routing, central safety/observability, config-driven MLOps | New critical component (SPOF risk, added hop latency) requiring hardening | ✅ **Chosen** |

## Consequences

### Positive
- **Cost control** via the cheap-model-first cascade — the primary lever for `NFR-AI-02` and the `>80%` gross-margin guardrail ([Business Model §11](../03-business-model.md)).
- **No lock-in / resilience** — swap or fail over between Claude/GPT/OSS by config; a provider outage degrades gracefully instead of taking the product down ([SDD §9](../02-software-design-document.md#9-failure--degradation-design)).
- **Per-request optimization** of quality, cost, latency, and PII-residency — build-vs-buy becomes a config decision, not a one-time bet ([AI Architecture §11](../05-ai-architecture.md)).
- **Cheap MLOps** — canary, promotion, rollback, and failover are router-config changes, not code deploys ([AI Architecture §10](../05-ai-architecture.md)).
- **Central chokepoint** for safety, budget metering, tracing, and grounding policy.

### Negative / costs
- The Gateway is a **critical path component and potential SPOF** → MUST be stateless, HA, horizontally autoscaled, and add minimal overhead (target <15 ms p50).
- **Prompt portability risk** — a prompt tuned for one model MAY degrade on another; mitigated by per-model prompt variants in the prompt registry and the eval gate before promotion ([AI Architecture §8.4, §10](../05-ai-architecture.md)).
- **Operational surface** of self-hosting OSS (GPU capacity/ops); mitigated by hosted-provider failover.

### Neutral / follow-ups
- Blended per-query cost cap for `NFR-AI-02` still needs a concrete number (open question "AI model budget" in [PROJECT_MEMORY](../../PROJECT_MEMORY.md)).
- Provider set and self-host vs hosted traffic split are revisited at H2 scale ([AI Architecture §11](../05-ai-architecture.md)).

## Compliance & guardrails

- The Gateway MUST route PII-sensitive/residency-constrained requests only to compliant/self-hosted models ([NFR-PRIV-01](../02-software-design-document.md#5-non-functional-requirements-nfrs)).
- The Gateway MUST NOT weaken grounding: cached price/fact claims are re-verified downstream (Prime Directive, `NFR-AI-01`/`NFR-COMP-01`).
- Only models registered and eval-passed in the model registry MAY be routed to ([AI Architecture §10](../05-ai-architecture.md)).

---

*Ratify in [`PROJECT_MEMORY.md`](../../PROJECT_MEMORY.md) Canonical Decisions (ADR-0005) once accepted.*
