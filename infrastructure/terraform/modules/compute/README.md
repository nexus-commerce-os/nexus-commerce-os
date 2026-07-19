# Module: `compute`

> Upstream-Kubernetes EKS cluster with data-driven node pools that encode the discovery-vs-money blast-radius split and the GPU warm floor.

| Field | Value |
|-------|-------|
| **Purpose** | Provision an EKS control plane, its IRSA OIDC provider, and a configurable set of managed node groups (discovery / money / GPU-warm-floor / spot-ingestion). Emits the OIDC ARN the `security` module uses to mint scoped ServiceAccount roles. |
| **Owner** | Platform / Compute (`infra-compute`) |
| **Instantiated by** | `envs/{dev,staging,prod}` — once per region, wired to that region's `network` app subnets. |
| **Maps to** | [09 §3 compute](../../../../docs/09-cloud-architecture.md#3-compute), [09 §10 identity](../../../../docs/09-cloud-architecture.md#10-cloud-security-posture); **ADR-0003** (EKS/upstream K8s, no PaaS lock-in); **ADR-0017 R-059** (discovery vs money pool split) & **R-078** (GPU warm floor); **ADR-0019 R-019** (blue-green upgrade matrix, pinned add-ons). |

## What it creates

- **`aws_eks_cluster`** — private API by default, control-plane audit logs on, Kubernetes **secrets envelope-encrypted** with a customer-managed KMS key.
- **IRSA OIDC provider** — `aws_iam_openid_connect_provider` derived from the cluster issuer; thumbprint via the `tls` provider. This is the pod-identity root; **no node-wide credentials**.
- **Node IAM role** — least-privilege managed policies + **SSM** (so node access is session-manager, not inbound SSH).
- **Managed node groups** — `for_each` over `var.node_pools`. Taints/labels drive the **discovery vs money** scheduling split; `min_size > 0` on GPU-interactive/money pools is the **warm floor**; `capacity_type = "SPOT"` for interruptible ingestion/batch. `desired_size` drift is ignored (autoscaler/Karpenter owns it).
- **Pinned add-ons** — CNI/CoreDNS/kube-proxy/EBS-CSI at explicit versions (upgrade-matrix requirement).

## The pool split (why it's config, not code)

The single most important cloud-security/reliability property here (ADR-0017 R-059) is that a **discovery surge cannot starve the money path**. That is expressed purely as data in `node_pools`, e.g.:

```hcl
node_pools = {
  money     = { instance_types=["m7g.large"], desired_size=3, min_size=3, max_size=9,
                labels={ pool="money" },
                taints=[{ key="pool", value="money", effect="NO_SCHEDULE" }] }
  discovery = { instance_types=["c7g.xlarge"], desired_size=3, min_size=2, max_size=40,
                labels={ pool="discovery" } }
  gpu-warm  = { instance_types=["g5.xlarge"], ami_type="AL2023_x86_64_NVIDIA",
                desired_size=1, min_size=1, max_size=6,          # warm floor: never 0
                labels={ pool="gpu", workload="inference" },
                taints=[{ key="nvidia.com/gpu", value="true", effect="NO_SCHEDULE" }] }
  ingest    = { instance_types=["m7g.large"], capacity_type="SPOT",
                desired_size=0, min_size=0, max_size=20, labels={ pool="ingest" } }
}
```

Workloads then use `nodeSelector`/tolerations (in Helm, out of scope here) to land on the right pool.

## Inputs / Outputs

**Key inputs:** `name_prefix`, `cluster_version`, `app_subnet_ids` (from `network`), `node_pools` (map), `cluster_addons` (pinned), `cluster_encryption_kms_key_arn` (from `security`), `endpoint_public_access` (false in prod).

**Outputs:** `cluster_name`, `cluster_endpoint`, `cluster_certificate_authority`, `oidc_provider_arn` + `oidc_provider_url` (→ `security` IRSA roles), `node_role_arn`, `node_group_names`.

## Dependencies

- **Upstream:** `network` (app subnet ids), `security` (KMS key ARN for secret encryption — optional in dev).
- **Downstream:** `security` (IRSA roles keyed on `oidc_provider_arn`), `monitoring` (collectors as IRSA), all in-cluster Helm/Argo workloads.

## Security notes

- **Private API endpoint** default; public access is opt-in and **must** carry narrowed `public_access_cidrs` (never `0.0.0.0/0`).
- **IRSA over node roles:** the node role is deliberately minimal; app permissions come from per-SA IRSA roles in `security`.
- **Secrets envelope encryption** with a CMK (NFR-SEC-01); control-plane audit logs shipped for [09 §10].
- **Upgrades are blue-green** (ADR-0019 R-019): stand up a new pool on the target version, drain, retire — never in-place on the money pool. Add-on versions are pinned so the skew matrix is explicit.

## How to test in isolation

```bash
terraform -chdir=modules/compute init -backend=false
terraform -chdir=modules/compute validate
```
