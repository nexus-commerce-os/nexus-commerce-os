# infrastructure/security/iam — least-privilege, IRSA, break-glass

> **Purpose.** The identity-and-access doctrine for machine + human access to the platform:
> least privilege everywhere, workload identity via IRSA (no node-wide credentials), and an
> audited, time-boxed break-glass path for incidents.
> **Owner.** `@nexus-commerce-os/cloud-security`.
> **Dependencies.** [`infrastructure/terraform`](../../terraform) (IAM module provisions the
> roles/policies described here), [`infrastructure/github/oidc-trust.md`](../../github/oidc-trust.md)
> (CI/CD federation), the service mesh (SPIFFE workload identity), and the §11 human-access path
> in docs/10.

Certified by docs/08 §3 (IAM, P3 least privilege), §5.5 (CI runner OIDC), docs/10 §3
(break-glass), ADR-0018 (R-065, R-068), ADR-0019 (R-018, break-glass).

## 1. Least privilege (P3)

- **Every human, service, agent, and token gets the minimum scope for the minimum time**
  (docs/08 P3). No shared "admin" role; no long-lived keys.
- **Deny-by-default**: absence of an explicit grant is a deny (docs/08 §3.3).
- **Separation of duties** is encoded as policy: e.g. a `finance` member MUST NOT approve a
  payout they initiated; the `production` environment forbids self-review (docs/08 §3.3,
  [`../../github/environments.yml`](../../github/environments.yml)).
- **CI/CD holds no static cloud keys** — OIDC federation only, one least-privilege role per
  capability, PR refs restricted to the read-only plan role (ADR-0018 R-065; see
  [`oidc-trust.md`](../../github/oidc-trust.md)).

## 2. IRSA — workload identity in-cluster

- Pods assume AWS permissions via **IRSA** (IAM Roles for Service Accounts): each service
  account maps to a scoped IAM role through the cluster's OIDC provider. **No node instance
  profile grants app permissions** — a compromised pod cannot inherit node-wide rights.
- **SSRF hardening pairs with this**: fetchers that call partner/feed URLs run with **no
  ambient cloud credentials** and the metadata endpoint (169.254.169.254) is blocked
  (docs/08 §5.4), so a stolen token has nothing to escalate to.
- IRSA is a **control-plane lock-in surface** tracked by the portability check (docs/10 §2) —
  it stays behind an abstraction or a documented per-cloud exit-runbook equivalent (ADR-0019 R-012).

## 3. Break-glass (emergency human access)

- Break-glass is **logged, MFA-gated, and auto-expiring** (docs/10 §3, ADR-0019 R-018). It is
  the sanctioned path for an operator to make an emergency change during an incident.
- Declaring break-glass **freezes ArgoCD self-heal for the scoped resource(s) only** — the
  incident blast radius, never the whole cluster — so the emergency fix is not silently
  reconciled away mid-incident.
- **Exit reconciles intentionally**: the operator must land the fix (or its replacement) back
  in the config repo before leaving break-glass, so exit does not re-trigger the outage. Every
  entry/exit and manual change under it is captured in the §11 evidence trail (audit).

## 4. Placeholders (resolved at org bootstrap)

- Concrete role ARNs / account ids are `vars.*` placeholders wired from Terraform outputs.
- `@nexus-commerce-os/*` approver teams do not exist until the GitHub org is created.
- The break-glass runbook + MFA integration are provisioned with the incident-response tooling.
