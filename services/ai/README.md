# services/ai — AI Serving + Agent

**Status:** Scaffold — not implemented
**Owner:** `@nexus/ai` (per [`.github/CODEOWNERS`](../../.github/CODEOWNERS) `/services/ai/`)
**Runtime / language:** **Python (FastAPI)** — the AI layer, the third and final bounded runtime ([SDD §6 — AI/ML services](../../docs/02-software-design-document.md#6-technology-stack--decisions-with-alternatives))
**Certified-architecture component:** **AI Serving + Agent (Python/FastAPI)** ([04 §4](../../docs/04-system-architecture.md#4-component-responsibilities)) — agent loop, RAG, tool-calling, safety
**Governing ADRs:** [ADR-0005](../../docs/adr/ADR-0005-ai-model-gateway.md) (model-agnostic router), [ADR-0009](../../docs/adr/ADR-0009-ai-cost-strategy.md) (≤ $0.01/request cascade), [ADR-0015](../../docs/adr/ADR-0015-ai-trust-cost-integrity.md) (trust/cost/integrity), [ADR-0020](../../docs/adr/ADR-0020-performance-consistency-hardening.md) (**no sync core on hot path** — reads async read-models), [ADR-0017](../../docs/adr/ADR-0017-blast-radius-isolation.md) (routing-policy canary per capability/region; warm-GPU floor)
**Implemented by phase:** [P0.5 — AI Foundation](../../docs/13-implementation-roadmap.md) (AI Gateway, model router, prompt library, embedding, RAG, recommendation engine)

## Purpose

Serves the shopping agent: grounded RAG, tool-calling via the single tool-RPC mechanism, model-router cost/quality routing, and safety (confirmation gates, spend limits, red-team evals). **Product-fact claims are grounded-only** (hallucination < 0.5%, NFR-AI-01) and **price numbers are deterministically verified, never LLM-asserted**. Reads async read-models — it **never calls Core modules synchronously on the hot path** ([ADR-0020](../../docs/adr/ADR-0020-performance-consistency-hardening.md)), so a core spike can't stall agent serving.

## Dependencies

- Search Service + Price Intelligence (for grounding/verification), LLM providers via the model router
- Async read-models/projections from Coupon/Cashback/Handoff (no sync core calls)
- First-token SLO NFR-PERF-03 (≤ 1.2 s) backed by a warm-GPU floor ([ADR-0017](../../docs/adr/ADR-0017-blast-radius-isolation.md))

## Scope guard

Scaffold only — **no agent loop, no router, no RAG, no prompts, no endpoints, no model calls.** `src/` documents intent for P0.5.
