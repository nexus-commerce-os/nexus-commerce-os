# packages/ui — React design-system primitives

**Status:** Scaffold — not implemented
**Owner:** `@nexus-commerce-os/frontend` `@nexus-commerce-os/platform` (per [`.github/CODEOWNERS`](../../.github/CODEOWNERS) `/packages/`)
**Runtime / language:** TypeScript + React + Tailwind (consumed by `apps/web`, `apps/admin`)
**Certified-architecture component:** shared presentation primitives for the Client tier ([04 §3](../../docs/04-system-architecture.md#3-context--container-map-c4-level-2))
**Governing ADRs:** [ADR-0010](../../docs/adr/ADR-0010-platform-principles.md) (replaceability) · NFR-A11Y-01 (WCAG 2.2 AA)
**Implemented by phase:** [P0.2](../../docs/13-implementation-roadmap.md)+ (as the app surfaces are built)

## Purpose

The shared React component library and design tokens for all NEXUS apps, built **accessible-by-default** (WCAG 2.2 AA, NFR-A11Y-01) with i18n/RTL support so non-English markets need no re-work ([04 §7.2](../../docs/04-system-architecture.md#72-internationalization--regional-platform-adr-0007)). Presentation only — no data fetching, no business logic.

## Dependencies

- `packages/config` (design tokens / build config)
- Peer: `react`, `react-dom` (provided by consuming apps)

## Scope guard

Scaffold only — `package.json` + `README.md` + `src/index.ts` with an **empty export**. **No components, no styles, no logic.**
