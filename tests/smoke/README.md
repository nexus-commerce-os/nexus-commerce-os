# tests/smoke — P0.1 post-deploy smoke suite

**Status:** Scaffold — not implemented
**Owner:** `@nexus-commerce-os/sre` `@nexus-commerce-os/devsecops` (per [`.github/CODEOWNERS`](../../.github/CODEOWNERS) `/tests/`)
**Runtime / language:** TBD (lightweight HTTP probe — runs in CI after GitOps deploy)
**Certified-architecture component:** verifies the **P0.1 walking-skeleton** (`services/platform-hello`) meets the platform fitness functions ([04 §10](../../docs/04-system-architecture.md#10-fitness-functions-how-we-keep-it-healthy))
**Governing ADRs:** [ADR-0010](../../docs/adr/ADR-0010-platform-principles.md) (health checks everywhere)
**Implemented by phase:** [P0.1 — Infrastructure](../../docs/13-implementation-roadmap.md) (the exit gate: commit → CI green → GitOps deploys "hello" to dev + staging)

## What the P0.1 smoke test will assert

Against the deployed `platform-hello` service in **dev and staging**, the smoke suite will assert the [P0.1 exit gate](../../docs/13-implementation-roadmap.md):

1. **Liveness** — `/healthz` (or equivalent) returns 200; the service is reachable via the deployed ingress.
2. **Readiness** — `/readyz` reports ready, including dependency health ([ADR-0010](../../docs/adr/ADR-0010-platform-principles.md) "health checks everywhere").
3. **Metrics present** — the service exposes OpenTelemetry/Prometheus metrics (NFR-OBS-01 built-in from P0.1).
4. **Automatic deploy proven** — the version answering probes matches the commit GitOps just rolled out (deploy is automatic, not manual).
5. **Both environments** — the same assertions pass in dev **and** staging (promotion path works).

> This is the coarse "is the platform alive after a deploy" gate — **not** a functional or business test. There is no business, commerce, AI, or auth behavior to assert at P0.1.

## Scope guard

Scaffold only — this README documents intent. **No test code, harness, or fixtures** are implemented here.
