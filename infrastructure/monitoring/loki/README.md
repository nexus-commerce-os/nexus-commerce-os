# `monitoring/loki` — log aggregation

**Purpose:** central structured-log store; logs are **correlated by trace ID** to Tempo traces
and Prometheus metrics ([docs/09 §11](../../../docs/09-cloud-architecture.md)).
**Owner:** SRE.
**Dependencies:** the OTel Collector (ships OTLP logs here via `otlphttp/loki`); Grafana (Loki
data source, cross-links to Tempo via trace ID); object storage (S3) in prod; Alertmanager (ruler).
Reachable at `loki.observability.svc.cluster.local:3100`.

## Notes

- **OTLP-native ingestion** (`allow_structured_metadata: true`) so trace/span IDs on log records
  survive as queryable structured metadata — this is what makes logs↔traces correlation work.
- **Retention** 30 d hot here; prod tiers to object-store archive (docs/09 §11: 30–90 d hot +
  archive; audit logs per [08 Security](../../../docs/08-security-architecture.md)).
- **Skeleton scope:** single-target, filesystem-backed, RF=1. Prod = simple-scalable/microservices
  mode on **S3** with **RF≥3** across AZs, in the separate observability failure domain
  (ADR-0017 R-060).
- No PII in logs — masking/tokenization upstream (docs/10 §1 data-handling hard rule).
