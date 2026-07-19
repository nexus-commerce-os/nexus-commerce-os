# Kustomize `overlays/`

**Purpose:** per-environment composition of the [`base/`](../base) namespace scaffolding plus
the **ArgoCD Applications** that deliver workloads via GitOps.
**Owner:** Platform Engineering + SRE.
**Dependencies:** Kustomize; ArgoCD (+ Argo Rollouts) installed in each cluster's `argocd`
namespace ([docs/10 §3](../../../docs/10-deployment-architecture.md)).

## Environments (docs/10 §1)

| Overlay | Sync policy | Image pinning | Notes |
|---------|-------------|---------------|-------|
| [`dev`](dev) | auto-sync + self-heal | floating `dev-latest` | trunk-latest shared integration |
| [`staging`](staging) | auto-sync + self-heal | **digest-pinned** RC | prod-identical; SLO/load/chaos/DR gates before prod |
| [`prod`](prod) | **manual** (no `automated:`) | **digest-pinned** | manual approval gate → region-by-region progressive rollout; self-heal off so drift is reviewed, not silently reconciled |

## GitOps model

CI never holds cluster credentials. Each cluster runs ArgoCD, which **pulls** desired state
from this repo ([docs/10 §3](../../../docs/10-deployment-architecture.md)). Each overlay ships:

- an **`AppProject`** scoping what the env may deploy and where;
- a **namespaces Application** (renders `base/` — the discovery/money/observability separation);
- a **`platform-hello` Application** (renders the Helm chart with env values).

Adding a service = add one more `Application` block (or an `ApplicationSet` entry) — no pipeline
change ([docs/10 §3 scalability](../../../docs/10-deployment-architecture.md)).

## Render / diff locally

```bash
kubectl kustomize overlays/dev
kubectl kustomize overlays/prod | kubectl apply --dry-run=server -f -
```

> `repoURL`/ECR account ids are placeholders (`https://github.com/nexus/monorepo.git`,
> `000000000000.dkr.ecr...`) — wire them to the real config-repo + registry at bootstrap.
