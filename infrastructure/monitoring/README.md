# `infrastructure/monitoring` — NEXUS observability stack

**Purpose:** the full observability pipeline — **OpenTelemetry** ingestion fanning out to
**Tempo (traces)**, **Prometheus (metrics)**, and **Loki (logs)**, visualized in **Grafana** with
SLO burn-rate alerting. Realizes NFR-OBS-01 (100% tracing of user-facing paths) and the
health/metrics-from-day-one mandate of [ADR-0010](../../docs/adr/ADR-0010-platform-principles.md)
(#5 health, #6 metrics), operationalized in [docs/09 §11](../../docs/09-cloud-architecture.md) and
[docs/10 §7](../../docs/10-deployment-architecture.md).
**Owner:** SRE / Observability.

## The one non-negotiable: a SEPARATE failure domain (ADR-0017 R-060)

The entire stack runs in its **own failure domain, off the critical path**. Services **export**
telemetry to it; it **never** depends on the workloads it watches. This breaks the **autoscaling
circular dependency** — the HPA/KEDA control loop that scales the app consumes metrics *from* this
domain, so if this domain depended on the app being up, a workload outage would blind the very
autoscaler meant to recover it. In prod, observability is a **dedicated/managed cluster**, not just
a namespace ([docs/09 §11](../../docs/09-cloud-architecture.md)). Everything here is HA and
independent; backends fail **safe** (collector buffers/drops rather than backpressuring the app).

## Pipeline

```
service SDKs ──OTLP──▶ [ otel ] ──▶ Tempo   (traces)
 (nexus-common          collector ──▶ Prometheus (metrics, remote-write) ──▶ Grafana + Alertmanager
  chart wires            (tail       ──▶ Loki    (logs, OTLP-native)
  OTEL_* env)             sampling)
```

## Subdirectories (each has its own README: purpose · owner · dependencies)

| Dir | Signal | Backend |
|-----|--------|---------|
| [`otel/`](otel) | ingestion + routing | OpenTelemetry Collector (gateway) |
| [`prometheus/`](prometheus) | metrics + SLO burn alerts | Prometheus (+ Thanos/AMP in prod) |
| [`tempo/`](tempo) | traces | Tempo |
| [`loki/`](loki) | logs | Loki |
| [`grafana/`](grafana) | dashboards + datasources | Grafana (dashboards-as-code) |

## How it ties to the rest of P0.1

- The [`nexus-common`](../kubernetes/charts/nexus-common) library chart injects `OTEL_*` env +
  the `instrumentation.opentelemetry.io/inject-sdk` annotation + `prometheus.io/scrape` + a
  `ServiceMonitor`, so **every** service is wired to this stack by construction. The CI
  **metrics/OTel presence** gate ([docs/10 §2](../../docs/10-deployment-architecture.md)) fails any
  service that isn't.
- [`platform-hello`](../../services/platform-hello) is the walking-skeleton that proves the
  pipeline end-to-end: its `/metrics` are scraped here, its `/` handler emits traces to Tempo, and
  its logs land in Loki — the golden-signals dashboard lights up from a real workload.
- The SLO burn-rate series in [`prometheus/`](prometheus) back the **§4 automated canary
  rollback** — the same math pages on fast burn and aborts a bad canary.

## Scope caveat

These are **skeleton** configs (single-target, local/filesystem storage, RF=1) sufficient to run
the P0.1 pipeline in lower envs. Prod swaps in S3-backed, replicated, microservices-mode
deployments per [docs/09 §11](../../docs/09-cloud-architecture.md) retention/HA targets. No secrets
or PII live in any config here (docs/10 §1, §9).
