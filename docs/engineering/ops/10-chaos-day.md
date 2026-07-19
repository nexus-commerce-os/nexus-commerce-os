# Chapter 10 — Chaos Day (P0.1 Resilience Validation)

**Status:** 🟢 Game-day runbook · **Scope:** prove the *platform foundation* self-recovers from single-component failure. **Staging only** (never prod at P0.1). Referenced by [Stage D — D11](09-execution-checklist.md).

> **Principle (ADR-0017 blast-radius isolation):** each experiment has a **hypothesis**, a bounded **blast radius**, a measured **steady-state**, and an **abort** switch. You are testing that *automation* recovers — not heroics. If steady-state does not return within the stated budget, **abort, restore, and file a finding** (do not "help it along").

## Game-day setup (do first)
- **Roles:** Commander (calls the experiment), Operator (injects), Observer (watches dashboards), Scribe (records).
- **Steady-state baseline:** `platform-hello` p95 latency, error rate, and pod-ready count on the golden-signals Grafana dashboard ([Ch6](06-observability.md)). Screenshot it.
- **Announce** in the ops channel; set a **30-min** window; confirm the **abort** path for each experiment below.
- **Blast radius:** staging namespace only; money-path namespace is untouched (it has no workload at P0.1 but its isolation is part of the test).

---

## EXP-1 — Kill a node
- **Hypothesis:** killing one worker node reschedules its pods to healthy nodes and the autoscaler replaces the node; steady-state returns.
- **Steady-state:** `platform-hello` stays Ready ≥ 1; p95 unchanged beyond a brief blip.
- **Blast radius:** one node in the discovery pool.
- **Inject:** `aws ec2 terminate-instances --instance-ids <NODE_INSTANCE_ID>` (or `kubectl drain <node> --ignore-daemonsets --delete-emptydir-data` for a graceful variant).
- **Expected auto-recovery:** pods `Pending`→`Running` on other nodes within seconds (PDB honored); Cluster Autoscaler ([Ch5](05-kubernetes.md)) provisions a replacement node within a few minutes.
- **Verify:** `kubectl get pods -o wide` (rescheduled) · `kubectl get nodes` (replacement `Ready`) · dashboard returns to baseline · a trace still completes in Tempo.
- **Abort/rollback:** none needed (self-heals); if a replacement never joins, check ASG desired capacity + subnet capacity.
- **Proves:** node-level HA + autoscaler + PDB.

## EXP-2 — Delete a pod
- **Hypothesis:** deleting a pod triggers an immediate ReplicaSet replacement with no user-visible failure.
- **Steady-state:** request success rate stays 100% (readiness gates traffic off the terminating pod).
- **Inject:** `kubectl delete pod <platform-hello-pod> -n staging`
- **Expected auto-recovery:** a new pod `Running`+`Ready` within seconds; the Service only routed to Ready pods throughout.
- **Verify:** `kubectl get pods -w` · continuous `curl` loop to `/healthz` shows no 5xx · restart counter increments by 1.
- **Abort/rollback:** none; if the new pod crash-loops, inspect `kubectl describe`/logs in Loki.
- **Proves:** ReplicaSet self-healing + readiness-gated routing.

## EXP-3 — Restart a service
- **Hypothesis:** a rolling restart completes with zero downtime (surge + PDB + readiness).
- **Steady-state:** success rate 100% during the roll.
- **Inject:** `kubectl rollout restart deployment/platform-hello -n staging`
- **Expected auto-recovery:** rolling update honors `maxUnavailable`/`maxSurge` + PDB; old pods drain only after new ones are Ready.
- **Verify:** `kubectl rollout status deployment/platform-hello` = complete · request loop shows no error · trace continuity in Tempo.
- **Abort/rollback:** `kubectl rollout undo deployment/platform-hello`.
- **Proves:** zero-downtime rollout config.

## EXP-4 — NAT Gateway failure
- **Hypothesis:** losing one NAT (egress cell) does not sever egress — the egress-cell fleet + multi-AZ routing absorb it ([ADR-0017](../../adr/ADR-0017-blast-radius-isolation.md) R-020).
- **Steady-state:** outbound calls (e.g. image pulls / OTLP export) continue.
- **Blast radius:** one AZ's NAT.
- **Inject:** `aws ec2 delete-nat-gateway --nat-gateway-id <NAT_ID>` (or detach its route) in one AZ.
- **Expected auto-recovery:** other AZs' NAT cells carry egress; **if a single-NAT-per-AZ design is in use, this experiment reveals it** — that is a valuable finding, not a pass. Terraform re-apply recreates the NAT.
- **Verify:** from a pod in the affected AZ, `curl -s https://example.com` still succeeds (routed via a healthy cell) · no OTLP export gap in Tempo.
- **Abort/rollback:** `terraform apply` to recreate the NAT; restore the route table.
- **Proves:** egress-cell redundancy (or exposes a single-NAT SPOF to fix before GA).

## EXP-5 — Revoke an IAM permission
- **Hypothesis:** revoking a non-critical IAM permission degrades *only* the dependent function and is detected (GuardDuty/CloudTrail), not silently ignored.
- **Steady-state:** core serving unaffected; the revoked capability fails **closed** with a clear error.
- **Blast radius:** one scoped IRSA role's single permission (e.g. an S3 read the canary doesn't need for serving) — **NOT** a money-path or cluster-critical role.
- **Inject:** attach a deny, or remove a statement, on a **test** IRSA role: `aws iam put-role-policy … <deny>`.
- **Expected auto-recovery:** the dependent action returns `AccessDenied` (fails closed); CloudTrail logs the denial; no crash of unrelated paths. **Recovery is by restoring the policy** (IAM changes are not "self-healing" — the test is that failure is *contained + observable*, and restore is clean).
- **Verify:** the affected call shows `AccessDenied` in logs/Loki · CloudTrail event present · unrelated endpoints stay green.
- **Abort/rollback:** `aws iam delete-role-policy …` / re-apply Terraform to restore least-privilege state.
- **Proves:** least-privilege blast-radius containment + auditability (fail-closed, observable).

---

## Chaos Day exit
- **Record each experiment:** hypothesis held? recovery time? any finding? (Scribe → a game-day report.)
- **Any hypothesis that did NOT hold is a finding** → fix forward, or file for the relevant phase (e.g. a single-NAT SPOF → fix the network module before GA).
- **Attach the game-day report** to the [Stage D / Ch8 evidence bundle](09-execution-checklist.md). Self-recovery on EXP-1/2/3 and contained+observable failure on EXP-4/5 = the P0.1 resilience bar.

---
*Back to [Execution Checklist](09-execution-checklist.md) · [Manual index](00-README.md).*
