# services/search — Search & Discovery

**Status:** Scaffold — not implemented
**Owner:** `@nexus/commerce` (per [`.github/CODEOWNERS`](../../.github/CODEOWNERS) `/services/search/`)
**Runtime / language:** **Go** — latency-critical, independently-scaled extracted service ([SDD §6](../../docs/02-software-design-document.md#6-technology-stack--decisions-with-alternatives), [04 §3–4](../../docs/04-system-architecture.md#4-component-responsibilities))
**Certified-architecture component:** **Search Service (Go + OpenSearch)** ([04 §4](../../docs/04-system-architecture.md#4-component-responsibilities)) — hybrid lexical+semantic query, **neutral ranking**, faceting
**Governing ADRs:** [ADR-0004](../../docs/adr/ADR-0004-architecture-style.md) (extracted-service-from-day-one), [ADR-0020](../../docs/adr/ADR-0020-performance-consistency-hardening.md) (neutrality test strengthened; parallel-fan-out perf), [ADR-0017](../../docs/adr/ADR-0017-blast-radius-isolation.md) (discovery on separate node pool from money path) · neutrality wall [04 §5.3](../../docs/04-system-architecture.md#53-neutrality-enforcement)
**Implemented by phase:** [P0.3 — Commerce Foundation](../../docs/13-implementation-roadmap.md) (Search: lexical → hybrid)

## Purpose

Stateless Go query service over OpenSearch + Redis serving the discovery read path (CQRS — never the OLTP write path). Enforces **neutral ranking**: relevance + buyer-value signals only; monetization/sponsorship signals are physically separated and **cannot reorder** neutral results ([04 §5.3](../../docs/04-system-architecture.md#53-neutrality-enforcement)). Targets NFR-PERF-01 (p95 ≤ 400 ms cached) and NFR-SCAL-01 (5,000 QPS, horizontally scalable).

## Dependencies

- Data (read models): OpenSearch + vector index, Redis (catalog cache cluster — isolated from money/auth Redis, [ADR-0017](../../docs/adr/ADR-0017-blast-radius-isolation.md))
- Upstream projections from Feed Ingestion via Kafka (CQRS); does **not** call core modules synchronously

## Scope guard

Scaffold only — **no query handling, no ranking, no OpenSearch client, no endpoints.** `cmd/` documents intent for P0.3.
