# `monitoring/prometheus`

**Purpose:** metrics collection + **SLO burn-rate alerting** and recording rules that back both
alerting and the §4 automated-rollback guardrails ([docs/09 §11](../../../docs/09-cloud-architecture.md),
[docs/10 §7](../../../docs/10-deployment-architecture.md)).
**Owner:** SRE.
**Dependencies:** the OTel Collector (remote-writes metrics here), Grafana (reads these series),
Alertmanager (routes these alerts to PagerDuty/Opsgenie), Argo Rollouts (AnalysisTemplates query
the same burn-rate series). In prod, paired with **Thanos/AMP** for long-term + global aggregation.

## Files

| File | Role |
|------|------|
| [`prometheus.yaml`](prometheus.yaml) | scrape config — collector self-metrics + annotation-based pod discovery across `nexus-platform/discovery/money` |
| [`recording-rules.yaml`](recording-rules.yaml) | precomputed golden-signal SLIs (request rate, error ratio over 5m/30m/1h/6h, p95 latency, availability) |
| [`alert-rules.yaml`](alert-rules.yaml) | **multi-window multi-burn-rate** SLO alerts (fast-burn page / slow-burn ticket), latency SLO, scrape-down |

## Design notes

- **Symptom-based, not cause-based** (docs/10 §7): alerts fire on user-visible **error-budget
  burn**, not on noisy internal causes. Fast-burn (14.4× over 1h & 5m) pages; slow-burn (6× over
  6h & 30m) tickets — the standard Google SRE multiburn pattern for a 99.95% SLO.
- **Same series drive auto-rollback:** Argo Rollouts reads `service:http_errors:ratio_*` during a
  canary and aborts on breach — no human in the revert path (docs/10 §4).
- **Skeleton metric names** are the `platform_hello_*` canary series; every real service emits the
  same golden signals through the library-chart contract, so the rules generalize by swapping the
  metric prefix (or templating per service).
- **Every alert carries a `runbook_url`** — a service/alert without a runbook is not
  production-ready (docs/10 §7).
- **Separate failure domain:** this Prometheus is independent of the workloads it scrapes; the
  autoscaler depends on it, so it must never depend on the app (ADR-0017 R-060).
