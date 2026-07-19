# `overlays/dev`

**Purpose:** dev environment composition — the shared, trunk-latest integration cluster
([docs/10 §1](../../../../docs/10-deployment-architecture.md)).
**Owner:** Platform Engineering + SRE. **Dependencies:** ArgoCD in `argocd` namespace.

- **Sync:** auto-sync + self-heal + prune (fast feedback; drift auto-corrected).
- **Image:** floats on `dev-latest` (dev tracks trunk; staging/prod pin digests).
- **Contents:** `AppProject nexus-dev`, `Application nexus-namespaces-dev` (base), `Application
  platform-hello-dev`.

```bash
kubectl kustomize .   # preview base + dev ArgoCD apps
```
