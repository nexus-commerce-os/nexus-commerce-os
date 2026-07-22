# packages/sdk — Typed client SDK

**Status:** Scaffold — not implemented
**Owner:** `@nexus-commerce-os/platform` `@nexus-commerce-os/frontend` (per [`.github/CODEOWNERS`](../../.github/CODEOWNERS) `/packages/`)
**Runtime / language:** TypeScript (consumed by `apps/*`)
**Certified-architecture component:** client side of the **contract-first single source of truth** ([SDD §6 — API contract](../../docs/02-software-design-document.md#6-technology-stack--decisions-with-alternatives))
**Governing ADRs:** [ADR-0020](../../docs/adr/ADR-0020-performance-consistency-hardening.md) (consistency) · NFR-CONS-02 (single contract source — OpenAPI + GraphQL SDL + protobuf all generated from one authored source)
**Implemented by phase:** [P0.2](../../docs/13-implementation-roadmap.md)+ (generated as the API contract lands per phase)

## Purpose

The typed client the apps use to call the API Gateway + BFF. It is **generated** from the single contract source of truth — never hand-authored — so money/i18n numbers can't drift between surfaces (Web BFF and Agent BFF consume the **same** offer-view resolver, NFR-CONS-02). Monetary values surface as the canonical money type from [`packages/config`](../config).

## Dependencies

- `packages/shared` (shared types)
- Codegen input: the contract source (built in later phases)

## Scope guard

Scaffold only — `package.json` + `README.md` + `src/index.ts` with an **empty export**. **No generated client, no HTTP calls, no endpoints.**
