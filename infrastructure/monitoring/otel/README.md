# `monitoring/otel` — OpenTelemetry Collector

**Purpose:** the single vendor-neutral telemetry ingestion gateway — fans OTLP in and routes
**traces → Tempo, metrics → Prometheus, logs → Loki** ([docs/09 §11](../../../docs/09-cloud-architecture.md),
[docs/10 §7](../../../docs/10-deployment-architecture.md)).
**Owner:** SRE / Observability.
**Dependencies:** Tempo, Prometheus, Loki (the export targets); the OTel Operator (optional, for
SDK auto-inject via the chart annotation). Services reach it at
`otel-collector.observability.svc.cluster.local:4317` (gRPC) / `:4318` (HTTP).

## Failure-domain rule (ADR-0017 R-060)

OpenTelemetry is the **anti-lock-in instrumentation standard** — swap any backend without
re-instrumenting a single service. This collector and its backends run in a **separate failure
domain** off the critical path: workloads only *export* here. The autoscaler (HPA/KEDA)
consumes metrics *from* this domain but the domain **must not depend on the workloads being up**
— otherwise a workload outage would blind the very autoscaler meant to recover it (the
**no circular dependency** invariant). The collector fails safe: if a backend is down it buffers
/ drops to `debug` rather than backpressuring the app.

## Config highlights ([`otel-collector-config.yaml`](otel-collector-config.yaml))

- **Receivers:** OTLP gRPC (4317) + HTTP (4318).
- **Processors:** `memory_limiter` (self-protection), `k8sattributes` (pod/ns/node enrichment),
  `tail_sampling` (keep 100% of errors + >500 ms traces, sample 10% of the happy path — 100%
  *coverage* without 100% *volume*, docs/10 §7), `batch`.
- **Exporters:** `otlp/tempo`, `prometheusremotewrite`, `otlphttp/loki`.
- **Self-observability:** the collector exposes its own `/metrics` on `:8888` and a health check
  on `:13133`.

## Deploy shape

Horizontally-scaled **gateway** Deployment behind the Service above, optionally paired with a
node **DaemonSet** agent tier (docs/09 §11 "DaemonSet/gateway per region"). This file is the
gateway pipeline; wire it as a ConfigMap consumed by the OTel Collector Helm chart / Operator.
