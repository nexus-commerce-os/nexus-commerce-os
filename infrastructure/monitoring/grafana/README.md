# `monitoring/grafana` — dashboards & datasources as code

**Purpose:** visualization layer — **dashboards-as-code** (version-controlled, not click-ops) plus
provisioned datasources wiring **metrics ↔ traces ↔ logs** correlation
([docs/10 §7](../../../docs/10-deployment-architecture.md), [docs/09 §11](../../../docs/09-cloud-architecture.md)).
**Owner:** SRE.
**Dependencies:** Prometheus, Tempo, Loki (datasources); Grafana ≥ 10. Reads recording rules from
the [prometheus](../prometheus) config.

## Contents

| Path | Role |
|------|------|
| [`dashboards/golden-signals.json`](dashboards/golden-signals.json) | per-service RED golden signals: traffic, error ratio (vs 0.05% budget), p95 latency (vs 400 ms), saturation, error-budget burn |
| [`dashboards/money-vms.json`](dashboards/money-vms.json) | **placeholder** business dashboard — VMS/MAU, handoff→conversion, coupon apply-success, ledger reconciliation. Renders empty until product services emit the metrics (no business logic at P0.1) |
| [`provisioning/datasources.yaml`](provisioning/datasources.yaml) | Prometheus (default, with exemplars→Tempo), Tempo (traces→logs/metrics, service map), Loki (derived `trace_id`→Tempo) |
| [`provisioning/dashboards.yaml`](provisioning/dashboards.yaml) | file provider loading the JSON dashboards into the `NEXUS` folder |

## Design notes

- **Reproducible from Git** (docs/10 §0.1 #1): dashboards are JSON in-repo, `editable: false` /
  `allowUiUpdates: false` — the UI is read-only; changes go through PRs.
- **Cross-signal correlation** is the point: a latency spike on golden-signals → exemplar → Tempo
  trace → correlated Loki logs by `trace_id`. This is how on-call goes metric→trace→log in one hop.
- **Two dashboard tiers** (docs/10 §7): per-service **golden signals** + **business** (money/VMS).
  The money dashboard is scoped to the isolated `nexus-money` domain (ADR-0017 R-059).
