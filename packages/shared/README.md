# packages/shared — Shared domain types & utilities

**Status:** Scaffold — not implemented
**Owner:** `@nexus/platform` `@nexus/frontend` (per [`.github/CODEOWNERS`](../../.github/CODEOWNERS) `/packages/`)
**Runtime / language:** TypeScript (framework-agnostic; consumed by `apps/*` and TS `services/*`)
**Certified-architecture component:** cross-cutting shared kernel of **types only** (no cross-context business logic) ([SDD §7](../../docs/02-software-design-document.md#7-cross-cutting-concerns))
**Governing ADRs:** [ADR-0010](../../docs/adr/ADR-0010-platform-principles.md) (replaceability), [ADR-0020](../../docs/adr/ADR-0020-performance-consistency-hardening.md) (consistency)
**Implemented by phase:** [P0.1](../../docs/13-implementation-roadmap.md)+ (grows as contexts are built)

## Purpose

Framework-agnostic shared types, error taxonomy, and small pure utilities used across apps and TS services. Deliberately **thin** — it must not become a shared-kernel dumping ground that erodes bounded-context boundaries ([04 §2](../../docs/04-system-architecture.md#2-architecture-style--decision)). Cross-context communication is via typed interfaces + domain events, not shared logic here.

## Dependencies

- None (leaf package).

## Scope guard

Scaffold only — `package.json` + `README.md` + `src/index.ts` with an **empty export**. No types or utilities implemented yet.
