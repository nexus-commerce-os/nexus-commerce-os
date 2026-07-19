# Module: `network`

> 3-tier, multi-AZ regional VPC with a horizontally-scaled egress-cell fleet and an internet-isolated data tier.

| Field | Value |
|-------|-------|
| **Purpose** | Provision the per-region network fabric: one VPC, three subnet tiers (public / private-app / private-data) across ≥3 AZs, controlled outbound via an egress-cell fleet, and PrivateLink to keep managed-service + S3 traffic off the internet. |
| **Owner** | Cloud / Network Engineering (`infra-network`) |
| **Instantiated by** | `envs/{dev,staging,prod}` — **once per region** (e.g. prod = us-east-1 + us-west-2; staging adds ap-south-1). Never instantiated standalone in prod. |
| **Maps to** | [09 §2 topology](../../../../docs/09-cloud-architecture.md#2-high-level-cloud-topology), [09 §4 networking](../../../../docs/09-cloud-architecture.md#4-networking); **ADR-0017 R-020** (egress cells, de-SPOF); **ADR-0016** (per-region residency fabric). |

## What it creates

- **`aws_vpc`** — one per region, DNS enabled.
- **Subnets (3 tiers × N AZs)** — `public` (ALB/NAT/edge), `private-app` (EKS nodes), `private-data` (Aurora/Redis/MSK). CIDRs are **derived** with `cidrsubnet()` from a single `vpc_cidr` + AZ list — nothing hardcoded.
- **Egress-cell fleet** — one `aws_nat_gateway` + EIP **per AZ** (or capped by `egress_cell_count`). Each private-app AZ routes to its **local** cell; a cell loss re-points (ADR-0017 R-020). This is the enforcement plumbing for the outbound-allowlist control point ([09 §4]); the allowlist policy itself is owned by [08 Security].
- **Data-tier isolation** — the `private-data` route tables have **no `0.0.0.0/0` route**. Data stores cannot reach the internet by construction.
- **VPC endpoints** — S3 **gateway** endpoint (attached to app+data route tables) + configurable **interface** endpoints (ECR/STS/Secrets/KMS/logs…) so managed traffic stays on the AWS backbone.
- **Default-deny SG** — a baseline security group with no ingress; consumers reference it and open ports **by SG-reference, not CIDR**.
- **Flow logs** — optional VPC Flow Logs → CloudWatch for the audit trail.

## Inputs (see `variables.tf` for full validation)

| Name | Type | Required | Notes |
|------|------|:--------:|-------|
| `name_prefix` | string | ✅ | e.g. `nexus-prod-use1`; encodes org+env+region. |
| `vpc_cidr` | string | ✅ | `/20` or larger. |
| `availability_zones` | list(string) | ✅ | **≥3** (validated). |
| `egress_cell_count` | number | | `0` ⇒ one cell per AZ (HA default); `1` ⇒ cost-capped dev. |
| `interface_endpoint_services` | list(string) | | e.g. `["ecr.api","ecr.dkr","sts","logs","secretsmanager","kms"]`. |
| `enable_flow_logs` / `flow_log_retention_days` | bool / number | | audit trail. |
| `tags` | map(string) | ✅ | must include `env` + `owner` (FinOps, [09 §9]). |

## Outputs

`vpc_id`, `vpc_cidr`, `{public,app,data}_subnet_ids` (maps by AZ) + `*_list` flavors, `egress_cell_nat_ids`, `egress_cell_public_ips` (stable outbound IPs partners allowlist), `default_deny_security_group_id`, `s3_gateway_endpoint_id`, `interface_endpoint_ids`.

## Dependencies

- **Upstream:** none (foundation module). Receives its provider (region) from the env root.
- **Downstream:** `compute` (app subnets), `database`/`cache`/`messaging` (data subnets), `security` (SG references).

## Security notes

- **Private-by-default:** only the public tier has an internet route; nodes are in private-app (no public IPs); data stores are internet-isolated.
- **Egress is a control point, not a SPOF:** the cell fleet is the SSRF/exfil enforcement plumbing; the *allowlist policy* is owned by [08]. The stable EIPs are what partners allowlist.
- **No CIDR-based app→data trust:** consumers wire SG-reference rules; this module ships the default-deny baseline.
- **`enable_flow_logs = true`** is expected in staging/prod for the immutable audit trail.

## How to test in isolation

```bash
terraform -chdir=modules/network init -backend=false
terraform -chdir=modules/network validate
terraform -chdir=modules/network fmt -check
```

The module configures **no provider** and reads region via `data.aws_region` — so it validates standalone and composes into any region via a provider alias.
