# `nexus-common` — NEXUS platform library Helm chart

**Purpose:** the single library chart **every deployable NEXUS service inherits** so it is
"production-shaped on day one" ([docs/10 §6](../../../../docs/10-deployment-architecture.md), §3).
**Owner:** Platform Engineering + SRE.
**Dependencies:** Helm 3.7+; consumed as a `type: library` dependency by service charts.
Optional runtime dependencies at deploy time: Prometheus Operator (for `ServiceMonitor`),
OTel Collector + Operator (for OTLP export + auto-inject), a CNI that enforces
`NetworkPolicy` (Cilium/Calico).

---

## Why a library chart (design decision)

[docs/10 §3](../../../../docs/10-deployment-architecture.md) mandates *"one library chart
(`nexus-common`) encodes org defaults: probes, resource templates, PodDisruptionBudgets,
topology-spread, OTel sidecar/annotations, NetworkPolicy, ServiceMonitor. Each service is a
thin chart depending on it."* Centralizing these means the CI **health-endpoint presence**,
**metrics/OTel presence**, and Kyverno **resources/rootless/NetworkPolicy** admission gates
([docs/10 §2, §5](../../../../docs/10-deployment-architecture.md)) pass *by construction* —
a service author cannot forget a probe or ship a root container.

It maps directly onto [ADR-0010](../../../../docs/adr/ADR-0010-platform-principles.md)
principles **#5 (health checks)** and **#6 (metrics)**, and honors
[ADR-0017](../../../../docs/adr/ADR-0017-blast-radius-isolation.md) R-059 (discovery vs money
node-pool isolation) via the `pool` value and R-060 (observability is a *separate* failure
domain — services only *export* to it, never depend on it being up to serve).

## What it renders (named templates)

| Template | Object | Guarantees |
|----------|--------|-----------|
| `nexus-common.deployment` | `Deployment` | liveness `/healthz` + readiness `/readyz` + startup probe; **required** requests/limits; non-root, read-only-root-FS, `drop: [ALL]`, `seccomp: RuntimeDefault`; OTel env + operator-inject annotation; topology spread; pool node placement |
| `nexus-common.service` | `Service` | ClusterIP exposing `http` + `metrics` ports |
| `nexus-common.serviceaccount` | `ServiceAccount` | IRSA-ready (`eks.amazonaws.com/role-arn`); token automount off by default |
| `nexus-common.hpa` | `HorizontalPodAutoscaler` | CPU + memory targets, scale up/down behavior |
| `nexus-common.pdb` | `PodDisruptionBudget` | voluntary-disruption floor (NFR-AVAIL-01) |
| `nexus-common.networkpolicy` | `NetworkPolicy` | **default-deny** ingress+egress; re-allows DNS, OTel export, metrics scrape, named namespaces only |
| `nexus-common.servicemonitor` | `ServiceMonitor` | Prometheus Operator scrape of `/metrics` |

## Fail-closed behavior

- `resources.requests.{cpu,memory}` and `resources.limits.{cpu,memory}` have **no defaults** —
  `helm template` **fails** if any is unset (docs/10 §6: resources are a MUST). This is
  deliberate; do not add defaults.
- `image.repository` is required and `image.tag`/`image.digest` must be set — no `:latest`
  (docs/10 §3). Prefer `image.digest` for immutable GitOps pins.

## How a service consumes it

A service chart declares the dependency and adds **thin stub templates** that just `include`
the library templates:

```yaml
# services/<svc>/helm/Chart.yaml
dependencies:
  - name: nexus-common
    version: 0.1.0
    repository: "file://../../../infrastructure/kubernetes/charts/nexus-common"
```

```yaml
# services/<svc>/helm/templates/all.yaml
{{- include "nexus-common.serviceaccount" . }}
---
{{- include "nexus-common.deployment" . }}
---
{{- include "nexus-common.service" . }}
---
{{- include "nexus-common.hpa" . }}
---
{{- include "nexus-common.pdb" . }}
---
{{- include "nexus-common.networkpolicy" . }}
---
{{- include "nexus-common.servicemonitor" . }}
```

The service's `values.yaml` supplies `image`, `resources`, `pool`, and any overrides. See
[`services/platform-hello/helm`](../../../../services/platform-hello/helm) for the worked
walking-skeleton example.

> **Note on library-chart values:** Helm does **not** auto-merge a library chart's own
> `values.yaml` into the parent. This chart's [`values.yaml`](values.yaml) is therefore a
> **reference schema** — templates read the *parent* chart's `.Values` and fall back to
> `default`s baked into the templates. Copy the keys you need into the service's `values.yaml`.

## Validate locally

```bash
helm dependency build services/platform-hello/helm
helm template hello services/platform-hello/helm | kubectl apply --dry-run=client -f -
```
