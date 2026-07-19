# apps/admin — Internal operator console

**Status:** Scaffold — not implemented
**Owner:** `@nexus/frontend` (per [`.github/CODEOWNERS`](../../.github/CODEOWNERS) `/apps/`)
**Runtime / language:** Next.js (React) + Tailwind, TypeScript ([SDD §6 — Frontend](../../docs/02-software-design-document.md#6-technology-stack--decisions-with-alternatives))
**Certified-architecture component:** Clients surface over the API Gateway + BFF; renders **RBAC/ABAC-scoped** admin views ([04 §3–4](../../docs/04-system-architecture.md#3-context--container-map-c4-level-2))
**Governing ADRs:** [ADR-0010](../../docs/adr/ADR-0010-platform-principles.md) (platform principles, rollback), [ADR-0017](../../docs/adr/ADR-0017-blast-radius-isolation.md) (operator views onto isolated failure domains)
**Implemented by phase:** [P0.2 — Core Platform](../../docs/13-implementation-roadmap.md) (RBAC-scoped dashboard, feature-flag toggle, audit-log views)

## Purpose

Internal console for operators: RBAC/ABAC-scoped dashboards, feature-flag management, tamper-evident audit-log inspection, and later the FinOps / revenue-integrity (VMS, `attribution_gap_rate`) and observability dashboards. Like `web`, it is a **thin presentation tier** — all authorization and data live behind the BFF; the client renders, it does not decide.

## Dependencies

- `packages/ui`, `packages/sdk`, `packages/shared`, `packages/config`
- Runtime target: API Gateway + BFF, auth service (later phases — not wired in this scaffold)

## Scope guard

Scaffold only — a single placeholder page. **No auth, RBAC, dashboards, feature-flag, or audit logic.**
