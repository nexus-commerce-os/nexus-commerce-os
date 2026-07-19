# apps/web — Shopper-facing PWA

**Status:** Scaffold — not implemented
**Owner:** `@nexus/frontend` (per [`.github/CODEOWNERS`](../../.github/CODEOWNERS) `/apps/`)
**Runtime / language:** Next.js (React) + Tailwind, TypeScript, PWA ([SDD §6 — Frontend](../../docs/02-software-design-document.md#6-technology-stack--decisions-with-alternatives))
**Certified-architecture component:** Clients → **Web / PWA (Next.js)** ([04 §3 container map](../../docs/04-system-architecture.md#3-context--container-map-c4-level-2))
**Governing ADRs:** [ADR-0006](../../docs/adr/ADR-0006-referral-only-model.md) (referral-only — the UI's terminal action is a deep-link handoff, never checkout), [ADR-0010](../../docs/adr/ADR-0010-platform-principles.md) (replaceability, rollback)
**Implemented by phase:** [P0.2 — Core Platform](../../docs/13-implementation-roadmap.md) (login → dashboard), then P0.3 search UI / P0.5 agent chat

## Purpose

The primary shopper surface: search & discovery, all-in price display, agent chat, and the confirmation-gated deep-link handoff. It is a **thin presentation tier** over the API Gateway + BFF — no ranking, pricing, money, or AI logic lives in the client. Monetary values are rendered from the canonical money type ([`packages/config`](../../packages/config), NFR-CONS-01); staleness/`as_of` freshness is displayed honestly ([SDD §8](../../docs/02-software-design-document.md#8-data-freshness-strategy-a-defining-design-decision)).

## Dependencies

- `packages/ui` (design system), `packages/sdk` (typed API client), `packages/shared`, `packages/config`
- Runtime target: API Gateway + BFF (later phase — not wired in this scaffold)

## Scope guard

Scaffold only — a single placeholder page. **No routes, search, agent, auth, commerce, or referral logic.**
