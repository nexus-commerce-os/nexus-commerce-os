# Module: `monitoring`

> Observability infra in a separate failure domain — managed Prometheus/Grafana with self-host hooks, no autoscaling circular dependency.

| Field | Value |
|-------|-------|
| **Purpose** | Provision the metrics backbone the autoscalers depend on: an AMP workspace (or self-host hooks), an optional AMG workspace, and the collector IRSA role that remote-writes to it. Deliberately independent of the workload clusters it watches. |
| **Owner** | SRE / Observability (`infra-sre`) |
| **Instantiated by** | `envs/{dev,staging,prod}` — per region, ideally against a **dedicated observability cluster/account**, not the workload cluster. |
| **Maps to** | [09 §11 observability](../../../../docs/09-cloud-architecture.md#11-observability-infrastructure), [09 §7 HPA/KEDA custom metrics](../../../../docs/09-cloud-architecture.md#7-scalability--elasticity); **ADR-0017 R-060** (separate failure domain, no circular dep). |

## What it creates

- **`aws_prometheus_workspace`** (AMP) — long-term/global metric store; feeds HPA/KEDA custom metrics and cost dashboards. Toggle with `enable_managed_prometheus`.
- **`aws_grafana_workspace`** (AMG) — optional dashboards (SSO/SAML auth, service-managed role, Prometheus + CloudWatch data sources).
- **Collector IRSA role** — a scoped role the in-cluster **OTel/Prometheus collector** assumes to `aps:RemoteWrite` to AMP. This is both the managed-mode hook and the self-host hook.
- **Alerts audit log group** — retention-bounded.

## The independence property (ADR-0017 R-060)

The control loop that scales the app (HPA/KEDA) reads these metrics, so the observability stack **must not depend on the app being up** — otherwise a workload outage blinds the autoscaler meant to recover it. This module therefore provisions the metric store as a **managed service** (AMP, its own failure domain) or emits **self-host hooks** (the collector role + endpoints) for a Prometheus/Grafana/Tempo/Loki stack on a **separate cluster/account**. It never co-tenants the metric store with the workloads.

## Managed vs self-host

- **Managed (default):** `enable_managed_prometheus = true` → AMP; optionally `enable_managed_grafana = true` → AMG.
- **Self-host:** set both to `false` → the module still emits the `collector_role_arn` so an in-cluster stack (Helm, on the dedicated obs cluster) can authenticate; wire remote-write to your self-hosted endpoint.

## Inputs / Outputs

**Key inputs:** `name_prefix`, `enable_managed_prometheus`, `enable_managed_grafana`, `oidc_provider_arn` + `oidc_provider_url` (from `compute`), `collector_namespace` / `collector_service_account`.

**Outputs:** `prometheus_workspace_id`, `prometheus_remote_write_endpoint`, `grafana_workspace_endpoint`, `collector_role_arn`, `alerts_log_group_name`.

## Dependencies

- **Upstream:** `compute` (OIDC provider) for the collector IRSA role.
- **Downstream:** in-cluster OTel collector, Alertmanager, cost dashboards ([09 §9]).

## Security notes

- Collector role is scoped to exactly the observability ServiceAccount and to `aps:RemoteWrite` on the one workspace.
- Observability is a **tagged cost center** (telemetry sprawl guard, [09 §11]).
- AMG uses SSO/SAML — no local Grafana admin passwords.

## How to test in isolation

```bash
terraform -chdir=modules/monitoring init -backend=false
terraform -chdir=modules/monitoring validate
```
