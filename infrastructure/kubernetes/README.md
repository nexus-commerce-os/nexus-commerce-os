# infrastructure/kubernetes

**Purpose:** how NEXUS workloads run on EKS — a shared **library Helm chart** every service inherits, plus Kustomize base + per-environment overlays and ArgoCD GitOps manifests. Enforces the platform-principles baseline ([ADR-0010](../../docs/adr/ADR-0010-platform-principles.md)): health/readiness/liveness probes, resource limits, non-root hardening, OTel, and default-deny networking on every pod.
**Owner:** `@nexus/platform` + `@nexus/sre` ([CODEOWNERS](../../.github/CODEOWNERS)).
**Dependencies:** the [`compute` Terraform module](terraform/modules/compute) (EKS + IRSA); Helm ≥ 3.14, Kustomize, ArgoCD; the [monitoring stack](../monitoring) for OTel export.

## Layout

| Path | What |
|------|------|
| `charts/nexus-common` | **Library chart** — hardened Deployment (liveness `/healthz`, readiness `/readyz`, startup probes), required CPU/mem limits (fail-closed), non-root + read-only-FS + drop-ALL + seccomp, OTel, HPA, PDB, IRSA ServiceAccount, default-deny NetworkPolicy, ServiceMonitor |
| `base/` | Kustomize base — namespace separation: **discovery vs money vs observability** ([ADR-0017](../../docs/adr/ADR-0017-blast-radius-isolation.md)) |
| `overlays/{dev,staging,prod}` | Per-env Kustomize + ArgoCD `AppProject`/`Application` (dev auto-sync · staging digest-pinned auto-sync · prod manual-gated) |

## Rules
- Every workload **inherits `nexus-common`** — no service ships without probes, limits, non-root, OTel, and a NetworkPolicy.
- **Money-path workloads run in an isolated namespace/node-pool**, never co-scheduled with elastic discovery.
- GitOps only — no `kubectl apply` to prod; ArgoCD reconciles from the config repo.
- Prod observability runs on a **dedicated/managed cluster** (separate failure domain, [09 §11](../../docs/09-cloud-architecture.md)).

The reference workload is [`services/platform-hello`](../../services/platform-hello) — the P0.1 pipeline canary that proves the chart end-to-end.
