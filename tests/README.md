# tests/ — Cross-cutting test suites

**Status:** Scaffold — not implemented
**Owner:** `@nexus/sre` `@nexus/devsecops` (per [`.github/CODEOWNERS`](../.github/CODEOWNERS) `/tests/`)
**Runtime / language:** TBD per suite (smoke = HTTP probes; policy = OPA/conftest)
**Implemented by phase:** [P0.1](../docs/13-implementation-roadmap.md) (smoke) — the infrastructure exit gate

Repo-level tests that span services and assert **fitness functions** ([04 §10](../docs/04-system-architecture.md#10-fitness-functions-how-we-keep-it-healthy)) rather than a single service's unit behavior.

| Suite | Purpose | Phase |
|-------|---------|-------|
| [`smoke`](smoke/) | Post-deploy health probe against the P0.1 walking-skeleton (`platform-hello`) in dev + staging | P0.1 |
| `policy` | OPA/conftest policy tests *(owned outside this scaffold's scope)* | P0.1+ |

## Scope guard

Scaffold only. This directory documents **what** the smoke suite will assert; no test code, harness, or fixtures are implemented here.
