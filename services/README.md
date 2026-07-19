# services/ — Backend services & extracted components

**Status:** Scaffold — not implemented
**Owner:** per-service (see each service's `README.md` + [`.github/CODEOWNERS`](../.github/CODEOWNERS))
**Runtime / language:** three bounded runtimes ([SDD §6](../docs/02-software-design-document.md#6-technology-stack--decisions-with-alternatives)) — TypeScript/NestJS (core product APIs), Go (latency-critical), Python/FastAPI (AI). Deliberately capped at 3 runtimes ([04 §9](../docs/04-system-architecture.md#9-risks-assumptions-trade-offs-architecture-level)).
**Certified-architecture component:** Modular-monolith core modules + extracted services ([04 §2–4](../docs/04-system-architecture.md#2-architecture-style--decision))
**Implemented by phase:** varies — see table

The architecture is a **modular monolith with a few strategic services extracted from day one** ([ADR-0004](../docs/adr/ADR-0004-architecture-style.md)). These directories are the future service/module boundaries; each owns its own data (separate DB schema + role, [ADR-0020](../docs/adr/ADR-0020-performance-consistency-hardening.md)) — no shared tables.

| Service | Runtime | Certified component | Phase |
|---------|---------|---------------------|-------|
| [`auth`](auth/) | NestJS / TS | Identity & Profile | [P0.2](../docs/13-implementation-roadmap.md) |
| [`catalog`](catalog/) | NestJS / TS | Catalog & Offer | P0.3 |
| [`affiliate`](affiliate/) | NestJS / TS | Affiliate & Attribution + Referral/Deep-Link Handoff | P0.3 (+ P0.4 money) |
| [`search`](search/) | Go | Search Service (hybrid, neutral ranking) | P0.3 |
| [`ai`](ai/) | Python / FastAPI | AI Serving + Agent | P0.5 |
| [`analytics`](analytics/) | Go / ClickHouse | Analytics / real-time dashboards | P0.6 |
| `platform-hello` | *(not in this scaffold's scope)* | P0.1 walking-skeleton | P0.1 |

## Governance

- Every external provider sits behind an **adapter**; no third-party SDK leaks into a core module ([ADR-0010](../docs/adr/ADR-0010-platform-principles.md)).
- Every service ships **health + readiness + dependency-health** endpoints and **OTel** telemetry from its first commit ([ADR-0010](../docs/adr/ADR-0010-platform-principles.md), NFR-OBS-01).
- Boundaries are DB-enforced; the AI service reads async read-models, never calling core synchronously on the hot path ([ADR-0020](../docs/adr/ADR-0020-performance-consistency-hardening.md)).

## Scope guard

Scaffold only. Each service exposes **no endpoints and no logic** — manifests declare the module and `src/`/`cmd/` documents intent for its phase.
