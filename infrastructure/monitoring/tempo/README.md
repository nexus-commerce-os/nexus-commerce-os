# `monitoring/tempo` — distributed tracing backend

**Purpose:** store + query OpenTelemetry traces; **100% coverage of user-facing paths**
(NFR-OBS-01) with tail-sampled volume ([docs/09 §11](../../../docs/09-cloud-architecture.md),
[docs/10 §7](../../../docs/10-deployment-architecture.md)).
**Owner:** SRE.
**Dependencies:** the OTel Collector (ships OTLP traces here + does the authoritative tail
sampling); Prometheus (Tempo's metrics-generator remote-writes RED/service-graph metrics +
exemplars back to it); Grafana (Tempo data source + trace↔log↔metric correlation); object storage
(S3) in prod. Reachable at `tempo.observability.svc.cluster.local:4317`.

## Notes

- **Sampling lives in the collector, not here** — Tempo stores what it's given; the collector's
  `tail_sampling` keeps 100% of errors + slow (>500 ms) traces and 10% of the happy path (100%
  *coverage*, not 100% *volume*).
- **`metrics_generator`** emits service-graph + span metrics with **exemplars** to Prometheus, so
  a spike on the golden-signals dashboard links straight to an example trace.
- **Retention** 14 d here (docs/09 §11: traces 7–30 d, 100% of errors/slow kept).
- **Skeleton scope:** single-binary, local storage. Prod = microservices mode on **S3**, separate
  failure domain (ADR-0017 R-060).
