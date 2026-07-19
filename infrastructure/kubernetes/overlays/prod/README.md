# `overlays/prod`

**Purpose:** production composition — live, multi-region, gated promotion
([docs/10 §1, §3, §4](../../../../docs/10-deployment-architecture.md)).
**Owner:** Platform Engineering + SRE. **Dependencies:** ArgoCD + Argo Rollouts in `argocd`.

- **Sync:** **manual** — no `automated:` block. Promotion is the approval gate (change ticket +
  2 approvals + rollback-proof id), then a **region-by-region** progressive rollout.
- **Self-heal:** intentionally **off** at the Application level so drift surfaces as `OutOfSync`
  for review rather than being silently reconciled (docs/10 §5 prod drift = change-management
  event). A scoped **break-glass** (docs/10 §3) suspends reconciliation during an incident so an
  operator's emergency fix isn't reverted mid-incident.
- **Image:** **digest-pinned**.
- **Contents:** `AppProject nexus-prod`, `Application nexus-namespaces-prod`, `Application
  platform-hello-prod`.

```bash
kubectl kustomize . | kubectl apply --dry-run=server -f -
```

> Do not `kubectl apply` to prod by hand — that is exactly the click-ops GitOps forbids
> (docs/10 §0.1 principle #1). Changes land via reviewed PR → ArgoCD manual sync after the gate.
