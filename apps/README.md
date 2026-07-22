# apps/ — User-facing applications

**Status:** Scaffold — not implemented
**Owner:** `@nexus-commerce-os/frontend` (per [`.github/CODEOWNERS`](../.github/CODEOWNERS) `/apps/`)
**Runtime / language:** Next.js (React) + Tailwind, TypeScript, PWA ([SDD §6 — Frontend](../docs/02-software-design-document.md#6-technology-stack--decisions-with-alternatives))
**Certified-architecture component:** Clients → Web / PWA ([04 §3 container map](../docs/04-system-architecture.md#3-context--container-map-c4-level-2))
**Implemented by phase:** [P0.2 — Core Platform](../docs/13-implementation-roadmap.md) onward (login → RBAC-scoped dashboard)

## Purpose

Presentation tier of NEXUS. Each app is a thin surface over the API Gateway + BFF; no business rules live here. Apps consume typed contracts from [`packages/sdk`](../packages/sdk) and design primitives from [`packages/ui`](../packages/ui).

| App | Purpose | Phase |
|-----|---------|-------|
| [`web`](web/) | Shopper-facing Next.js PWA (search, agent chat surface, deep-link handoff UI) | P0.2+ |
| [`admin`](admin/) | Internal operator/admin console (RBAC-scoped dashboards, feature-flag + audit views) | P0.2+ |

## Dependencies

- `packages/ui`, `packages/sdk`, `packages/shared`, `packages/config` (workspace)
- Runtime target: API Gateway + BFF (built in later phases — not called by this scaffold)

## Scope guard

Scaffold only. Placeholder pages declare intent; **no routes, features, auth, commerce, or AI logic** are implemented here.
