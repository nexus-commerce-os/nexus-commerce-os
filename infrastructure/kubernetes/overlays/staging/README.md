# `overlays/staging`

**Purpose:** staging composition — prod-identical topology and the SLO/load/chaos/DR proving
ground before any prod promotion ([docs/10 §1, §8](../../../../docs/10-deployment-architecture.md)).
**Owner:** Platform Engineering + SRE. **Dependencies:** ArgoCD in `argocd` namespace.

- **Sync:** auto-sync + self-heal of tagged **release candidates**.
- **Image:** **digest-pinned** (`image.digest`) — no floating tags past dev (docs/10 §3).
- **Gates:** the §8 load/chaos/DR + §7 SLO gates run here; passing them is the precondition for
  the prod manual approval gate.
- **Contents:** `AppProject nexus-staging`, `Application nexus-namespaces-staging`, `Application
  platform-hello-staging`.

```bash
kubectl kustomize .
```
