# services/analytics — Real-time analytics

**Status:** Scaffold — not implemented
**Owner:** `@nexus-commerce-os/data` (per [`.github/CODEOWNERS`](../../.github/CODEOWNERS) `/services/analytics/`)
**Runtime / language:** **Go** + **ClickHouse** ([SDD §6 — Analytics](../../docs/02-software-design-document.md#6-technology-stack--decisions-with-alternatives): ClickHouse + object-store lakehouse; Go for the ingest/query service)
**Certified-architecture component:** Analytics / price-time-series + business & revenue-integrity dashboards ([04 §3 Data — ClickHouse](../../docs/04-system-architecture.md#3-context--container-map-c4-level-2), [04 §5.4 reconciliation SLI](../../docs/04-system-architecture.md#54-attribution--money-event-sourced))
**Governing ADRs:** [ADR-0011](../../docs/adr/ADR-0011-attribution-reconciliation.md) (revenue-integrity SLI / `attribution_gap_rate` / VMS with confidence bounds), [ADR-0017](../../docs/adr/ADR-0017-blast-radius-isolation.md) (observability/analytics on a **separate failure domain** — no autoscaling circular dependency), [ADR-0010](../../docs/adr/ADR-0010-platform-principles.md) (metrics everywhere)
**Implemented by phase:** [P0.6 — Observability](../../docs/13-implementation-roadmap.md) (money & VMS business dashboards; per-service SLO dashboards) — data feeds begin with price analytics (P0.3) and reconciliation (P0.4)

## Purpose

Real-time analytics over ClickHouse: price time-series, the 3-way reconciliation metrics (`attribution_gap_rate`), the falsifiable **VMS** north-star (reported with confidence bounds), and business/SLO dashboards. Runs on an **isolated failure domain** so the system that scales the app never depends on the app being up ([ADR-0017](../../docs/adr/ADR-0017-blast-radius-isolation.md)).

## Dependencies

- Data: ClickHouse (price ts + event analytics), object-store lakehouse
- Ingest: Kafka event streams (`offer.upserted`, referral/attribution events) — read-only consumer; no writes back to OLTP
- Consumers: `apps/admin` dashboards, FinOps/anomaly infra

## Scope guard

Scaffold only — **no ingestion, no queries, no dashboards, no SLI computation, no endpoints.** `cmd/` documents intent for P0.6.
