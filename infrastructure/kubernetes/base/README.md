# Kustomize `base/`

**Purpose:** the env-agnostic cluster scaffolding shared by all overlays — the **namespace
layout** that encodes NEXUS blast-radius separation.
**Owner:** Platform Engineering + SRE.
**Dependencies:** Kustomize (kubectl 1.27+ built-in); a PodSecurity-admission-capable cluster
(1.25+).

## What's here

- [`namespaces.yaml`](namespaces.yaml) — four namespaces enforcing
  [ADR-0017](../../../docs/adr/ADR-0017-blast-radius-isolation.md) isolation:

  | Namespace | Pool | Why separate |
  |-----------|------|--------------|
  | `nexus-platform` | `platform` | shared platform workloads (incl. the `platform-hello` canary) |
  | `nexus-discovery` | `discovery` | search/AI, elastic, best-effort — **must not starve money** (R-059) |
  | `nexus-money` | `money` | checkout/handoff/ledger, strict SLO, `data-sensitivity: high` (R-059) |
  | `observability` | — | **separate failure domain**; autoscaler must not depend on scaled apps (R-060) |

  Every workload namespace enforces **PodSecurity `restricted`** — the cluster-level backstop to
  the chart's non-root/read-only/drop-ALL securityContext ([docs/10 §5](../../../docs/10-deployment-architecture.md)).

## Design notes

- Namespace **names are stable across environments** — dev/staging/prod are separate
  accounts/clusters ([docs/10 §1](../../../docs/10-deployment-architecture.md)), so no env
  prefix is needed. Overlays differentiate by labels + which ArgoCD Applications they carry.
- In prod, `observability` is a **dedicated/managed cluster**, not merely a namespace
  ([docs/09 §11](../../../docs/09-cloud-architecture.md), ADR-0017 R-060). It is modeled as a
  namespace here so lower envs stay single-cluster and cheap; the *no-circular-dependency*
  invariant (the thing that scales the app can't depend on the app) holds either way.
- `money` and `discovery` namespaces map to tainted node pools (`nexus.io/pool`); the library
  chart sets the matching `nodeSelector` + tolerations from `.Values.pool`.

## Use

```bash
kubectl kustomize infrastructure/kubernetes/overlays/dev   # renders base + dev overlay
```
Do not `kubectl apply` this directly in prod — ArgoCD reconciles it (GitOps, docs/10 §3).
