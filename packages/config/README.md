# packages/config — Shared config + canonical money type

**Status:** Scaffold — not implemented
**Owner:** `@nexus/platform` `@nexus/frontend` (per [`.github/CODEOWNERS`](../../.github/CODEOWNERS) `/packages/`)
**Runtime / language:** TypeScript (consumed by `apps/*` and TS `services/*`)
**Certified-architecture component:** cross-cutting consistency contracts ([SDD §7](../../docs/02-software-design-document.md#7-cross-cutting-concerns))
**Governing ADRs:** [ADR-0020](../../docs/adr/ADR-0020-performance-consistency-hardening.md) (money/consistency hardening) · NFR-CONS-01 (monetary representation), NFR-CONS-02 (single contract source)
**Implemented by phase:** [P0.1](../../docs/13-implementation-roadmap.md) scaffold → **canonical money type in [P0.4 — Money Integrity](../../docs/13-implementation-roadmap.md)**

## Purpose

Will hold the shared build/lint/`tsconfig` and — critically — the **canonical money type**: **integer minor-units + ISO currency code**, defined **once** and code-generated into all three runtimes (TS/Go/Python) so there is **zero monetary drift** across runtimes × contract formats ([ADR-0020](../../docs/adr/ADR-0020-performance-consistency-hardening.md), NFR-CONS-01). FX normalization is an explicit ranking step, never an implicit cast.

> **Not implemented now.** The money type is a **P0.4** deliverable (money-integrity gate). This scaffold only declares intent; there is **no** money implementation, no arithmetic, no currency tables.

## Dependencies

- None (leaf package).

## Scope guard

Scaffold only — `package.json` + `README.md` + `src/index.ts` with an **empty export**. No money type, no config values yet.
