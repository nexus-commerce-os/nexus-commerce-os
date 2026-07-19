# packages/ — Shared workspace libraries

**Status:** Scaffold — not implemented
**Owner:** `@nexus/platform` `@nexus/frontend` (per [`.github/CODEOWNERS`](../.github/CODEOWNERS) `/packages/`)
**Runtime / language:** TypeScript (consumed by `apps/*` and TS `services/*`)
**Certified-architecture component:** cross-cutting shared contracts & primitives ([SDD §7](../docs/02-software-design-document.md#7-cross-cutting-concerns))
**Implemented by phase:** [P0.1](../docs/13-implementation-roadmap.md) (config/shared) → P0.2+ (ui/sdk)

Internal, unpublished packages consumed across the workspace via pnpm workspace links.

| Package | Purpose | Phase |
|---------|---------|-------|
| [`config`](config/) | Shared `tsconfig`, lint/build config, and the **canonical money type** (integer minor-units + ISO currency, [ADR-0020](../docs/adr/ADR-0020-performance-consistency-hardening.md) / NFR-CONS-01) | P0.1 scaffold → money type P0.4 |
| [`shared`](shared/) | Framework-agnostic domain types, errors, and utilities shared by apps + services | P0.1+ |
| [`sdk`](sdk/) | Typed client generated from the **contract-first single source of truth** (OpenAPI/GraphQL/protobuf, NFR-CONS-02) | P0.2+ |
| [`ui`](ui/) | React design-system primitives (WCAG 2.2 AA, NFR-A11Y-01) for `apps/*` | P0.2+ |

## Dependencies

- `config` and `shared` have no internal dependencies (leaf packages).
- `sdk` depends on `shared` (types); `ui` depends on `config`.

## Scope guard

Scaffold only. Each package is `package.json` + `README.md` + `src/index.ts` with an **empty export** — no money-type implementation, no generated SDK, no components yet.
