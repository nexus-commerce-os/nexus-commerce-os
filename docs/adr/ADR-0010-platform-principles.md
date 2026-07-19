# ADR-0010 — Platform engineering principles: replaceability & operability

**Status:** Accepted · **Date:** 2026-07-13 · **Deciders:** Founder/CEO (ratified), CTO, all Architecture leads

## Context

The Founder ratified a set of cross-cutting engineering directives that apply to **every** subsystem. Capturing them as one binding ADR makes them auditable fitness functions rather than scattered aspirations.

## Decision (all normative — MUST)

1. **Model-agnostic AI.** No hard dependency on any single LLM/embedding provider; all inference behind the AI Gateway ([ADR-0005](ADR-0005-ai-model-gateway.md), [ADR-0009](ADR-0009-ai-cost-strategy.md)).
2. **No vendor lock-in.** Prefer open standards/engines; provider-specific features used only behind an abstraction; portability preserved ([ADR-0003](ADR-0003-cloud-provider.md)).
3. **Every major subsystem is replaceable.** Search, data stores, AI models, affiliate networks, payout partner, tax provider, compliance modules, message bus — each swappable without cross-system rewrites.
4. **Every external provider is behind an adapter (anti-corruption layer).** No third-party schema/SDK leaks into the core domain ([ADR-0008](ADR-0008-affiliate-gateway.md), [04 §6](../04-system-architecture.md)).
5. **Every component exposes health checks.** Liveness + readiness + dependency health, consumed by orchestration and the Gateway's failover ([10](../10-deployment-architecture.md)).
6. **Every service exposes metrics.** OpenTelemetry metrics/traces/logs; golden signals per service (NFR-OBS-01).
7. **Every architectural decision includes a rollback procedure.** No change (code, config, model, schema, region flag) ships without a documented, tested rollback.

## Consequences
- **+** Resilience, negotiating leverage, and evolvability are structural, not hoped-for.
- **+** These become **CI fitness functions** ([10 §2](../10-deployment-architecture.md), [04 §10](../04-system-architecture.md)): adapter-boundary lint, "no provider SDK in core" check, health-endpoint presence check, rollback-doc gate.
- **−** Adapters and abstractions add indirection/boilerplate — accepted as the price of replaceability.
- **−** "Rollback for every decision" adds process — automated via templates so the burden is near-zero.

## Rollback
Meta: this ADR *is* the rollback-discipline mandate. If a principle proves impractical for a specific subsystem, that exception is itself an ADR with justification — the default is these principles hold.

## Related
[ADR-0003](ADR-0003-cloud-provider.md), [ADR-0005](ADR-0005-ai-model-gateway.md), [ADR-0008](ADR-0008-affiliate-gateway.md), [ADR-0009](ADR-0009-ai-cost-strategy.md), [System §10](../04-system-architecture.md), [Deployment](../10-deployment-architecture.md).
