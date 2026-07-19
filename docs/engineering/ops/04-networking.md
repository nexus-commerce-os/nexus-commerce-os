# Chapter 4 — Networking

**Status:** 🟢 Runbook · **Phase:** P0.1 · **Applies:** the `network` fabric of the `region-stack` for `dev` (staging/prod repeat) · **Depends on:** [Chapter 3 — Terraform Bootstrap](03-terraform-bootstrap.md) (remote state + GitHub-OIDC deploy roles MUST already exist) · **Blocks:** [Chapter 5 — Kubernetes](05-kubernetes.md)

> This chapter stands up the per-region network fabric — one VPC, three subnet tiers across ≥3 AZs, the horizontally-scaled egress-cell fleet, route tables, default-deny security groups, subnet-tier NACL posture, and PrivateLink VPC endpoints — by driving the [`network` module](../../../infrastructure/terraform/modules/network/README.md) from the [`envs/dev`](../../../infrastructure/terraform/envs/dev/) root. It realizes [09 §2 topology](../../09-cloud-architecture.md#2-high-level-cloud-topology) and [09 §4 networking](../../09-cloud-architecture.md#4-networking), and enforces the egress-cell decision of [ADR-0017 R-020](../../adr/ADR-0017-blast-radius-isolation.md).
>
> Every step below carries all **8 fields** required by [00-README §Step format](00-README.md): **Objective · Prerequisites · Commands · Expected output · Verification · Rollback · Common failure · Troubleshooting.**

---

## 0. Orientation

### 0.1 What is being applied, and how it is addressed

`dev` is a **thin composition**: `envs/dev/main.tf` instantiates a single `region-stack` as `module "primary"`, and `region-stack` instantiates the `network` module as `module "network"`. Network resources are therefore addressed in `dev` state as:

```
module.primary.module.network.<RESOURCE>
```

This chapter provisions **only** the network sub-module. The remaining primitives (compute/data/observability) are applied in [Chapter 5](05-kubernetes.md) and later. To stage the foundation without pulling in EKS, operators **MUST** drive the `network` sub-module with `-target`, then finish with a full sub-module convergence apply (§4.9). `-target` is used here as a deliberate, documented bring-up sequence — Terraform auto-includes each target's dependencies, so ordering is always safe.

> **Terraform will print** `Note: … -target … should be used … as an exception …`. That warning is **expected** for staged bring-up and MUST NOT be treated as an error. §4.9 removes the exception by converging the whole sub-module untargeted.

### 0.2 `dev` fabric shape (derived, nothing hardcoded)

With `vpc_cidr = 10.10.0.0/16`, three discovered AZs (`<AZ_A>`,`<AZ_B>`,`<AZ_C>`, default `us-east-1a/b/c`), and the module's `*_newbits = 4`, subnet CIDRs are **derived** by `cidrsubnet()` (see [module main](../../../infrastructure/terraform/modules/network/README.md)):

| Tier | AZ-A | AZ-B | AZ-C | Internet route |
|------|------|------|------|----------------|
| **public** (netnum 0–2) | `10.10.0.0/20` | `10.10.16.0/20` | `10.10.32.0/20` | → IGW |
| **private-app** (netnum 3–5) | `10.10.48.0/20` | `10.10.64.0/20` | `10.10.80.0/20` | → egress cell (NAT) |
| **private-data** (netnum 6–8) | `10.10.96.0/20` | `10.10.112.0/20` | `10.10.128.0/20` | **none** (endpoints only) |

`dev` deviations from prod (from [`envs/dev/main.tf`](../../../infrastructure/terraform/envs/dev/)): `egress_cell_count = 1` (cost-capped, **not** HA — prod is one cell per AZ), `enable_flow_logs = false` (prod/staging **MUST** enable), `interface_endpoint_services` inherits the `region-stack` default `["ecr.api","ecr.dkr","sts","logs","secretsmanager","kms"]`.

```mermaid
flowchart TB
  subgraph VPC["VPC 10.10.0.0/16 · dev · us-east-1"]
    subgraph PUB["public tier ×3 AZ"]
      IGW["Internet Gateway"]
      NAT["egress cell (NAT+EIP)<br/>ADR-0017 R-020"]
    end
    subgraph APP["private-app tier ×3 AZ"]
      RTA["rt-app-&lt;az&gt; → NAT"]
    end
    subgraph DATA["private-data tier ×3 AZ · internet-isolated"]
      RTD["rt-data-&lt;az&gt; → no 0.0.0.0/0"]
      IFE["interface endpoints<br/>ecr/sts/logs/secrets/kms"]
    end
    S3E["S3 gateway endpoint"]
  end
  IGW --> NAT
  APP --> NAT --> IGW
  S3E -. attached to app+data route tables .-> DATA
  S3E -. .-> APP
```

### 0.3 Global prerequisites (all steps assume these)

- **P-1** [Chapter 3](03-terraform-bootstrap.md) complete: the `global` stack's `tfstate_bucket`, `tflock_table`, `tfstate_kms_key_arn` outputs exist, and the GitHub-OIDC deploy role is assumable.
- **P-2** Operator workstation tools per [00-README §Prerequisites](00-README.md): `terraform ≥ 1.7`, `aws` CLI v2, `jq`.
- **P-3** `env.sh` exports (never committed): `export AWS_REGION=<REGION>`, `export AWS_PROFILE=<DEPLOY_PROFILE>`, `export PREFIX=nexus-dev-use1`, `export TFDIR=infrastructure/terraform/envs/dev`, `export NET=module.primary.module.network`.
- **P-4** Credentials resolve to the **dev** account (`aws sts get-caller-identity` returns `<DEV_ACCOUNT_ID>`), and that account matches the backend `key = dev/us-east-1/terraform.tfstate`.

> **Idempotency contract (whole chapter).** Every `apply` step MUST be safe to re-run: a second `terraform apply` of the same target MUST report `No changes. Your infrastructure matches the configuration.` No step relies on run order beyond dependency edges Terraform already tracks. This is the operational meaning of "a 2nd apply is a no-op."

---

## Step 4.0 — Initialize the backend and produce the network plan

**Objective** — Initialize the `dev` root against the Chapter-3 remote state, then produce a reviewable plan scoped to the `network` sub-module so the operator sees the full fabric before any resource is created.

**Prerequisites** — P-1…P-4. `backend.tf` bucket/table/kms filled from the `global` stack outputs (values are placeholders in-repo and MUST come from Chapter 3, never be committed).

**Commands**
```bash
source ./env.sh
terraform -chdir="$TFDIR" init \
  -backend-config="bucket=nexus-tfstate-<DEV_ACCOUNT_ID>" \
  -backend-config="dynamodb_table=nexus-tflock" \
  -backend-config="kms_key_id=alias/nexus-tfstate"
terraform -chdir="$TFDIR" validate
terraform -chdir="$TFDIR" plan -target="$NET" -out=net.tfplan
```

**Expected output** — `init`: `Terraform has been successfully initialized!` with the S3 backend. `validate`: `Success! The configuration is valid.` `plan`: the `-target` exception note, then a summary creating the network resources only — for `dev`: 1 VPC, 1 IGW, 9 subnets (3×3 tiers), 1 EIP + 1 NAT (egress cell), 1 public + 3 app + 3 data route tables with their routes/associations, 1 S3 gateway endpoint, 6 interface endpoints + their SG, and the default-deny SG. Flow-log resources show **0 to add** (disabled in `dev`). Ends `Plan: <N> to add, 0 to change, 0 to destroy.`

**Verification** — `terraform -chdir="$TFDIR" show -json net.tfplan | jq '.resource_changes | map(select(.address | startswith("module.primary.module.network"))) | length'` returns the plan's add count; confirm no address outside `module.primary.module.network` appears: `jq -r '.resource_changes[].address' <(terraform -chdir="$TFDIR" show -json net.tfplan) | grep -v '^module.primary.module.network' | grep -v '^$' || echo "SCOPED-OK"`.

**Rollback** — No resources were created; discard the plan artifact: `rm -f net.tfplan`. To fully back out backend init, remove `$TFDIR/.terraform/` and re-init.

**Common failure** — `Error: Failed to get existing workspaces … AccessDenied` on the state bucket, or `Error acquiring the state lock`.

**Troubleshooting** — AccessDenied ⇒ the assumed role is not the Chapter-3 deploy role for the dev account; re-check `AWS_PROFILE`/OIDC and `aws sts get-caller-identity`. Lock contention ⇒ a prior run crashed; inspect the `nexus-tflock` DynamoDB item and `terraform -chdir="$TFDIR" force-unlock <LOCK_ID>` **only** after confirming no other apply is live. Backend key mismatch ⇒ verify `backend.tf` `key = dev/us-east-1/terraform.tfstate`.

---

## Step 4.1 — VPC + Internet Gateway

**Objective** — Create the region VPC (`aws_vpc.this`, DNS support + hostnames on) and its Internet Gateway (`aws_internet_gateway.this`) — the root of the fabric that every later step attaches to.

**Prerequisites** — Step 4.0 succeeded; `net.tfplan` reviewed.

**Commands**
```bash
terraform -chdir="$TFDIR" apply \
  -target="$NET.aws_vpc.this" \
  -target="$NET.aws_internet_gateway.this"
# second run proves idempotency
terraform -chdir="$TFDIR" apply \
  -target="$NET.aws_vpc.this" -target="$NET.aws_internet_gateway.this"
export VPC_ID=$(terraform -chdir="$TFDIR" state show "$NET.aws_vpc.this" | awk '/^ *id /{print $3; exit}' | tr -d '"')
aws ec2 describe-vpcs --vpc-ids "$VPC_ID" --region "$AWS_REGION" \
  --query 'Vpcs[0].{cidr:CidrBlock,dns:EnableDnsSupport,state:State}'
```

**Expected output** — First apply: `Apply complete! Resources: 2 added, 0 changed, 0 destroyed.` Second apply: `No changes. Your infrastructure matches the configuration.` `describe-vpcs`: `{ "cidr": "10.10.0.0/16", "state": "available" }`. The VPC carries tag `Name=nexus-dev-use1-vpc` plus the FinOps `env`/`owner` tags.

**Verification** — DNS attributes MUST be on (EKS/PrivateLink depend on them): `aws ec2 describe-vpc-attribute --vpc-id "$VPC_ID" --attribute enableDnsHostnames --region "$AWS_REGION" --query 'EnableDnsHostnames.Value'` returns `true`. IGW MUST be attached: `aws ec2 describe-internet-gateways --filters Name=attachment.vpc-id,Values="$VPC_ID" --region "$AWS_REGION" --query 'InternetGateways[0].Attachments[0].State'` returns `"available"`.

**Rollback** — `terraform -chdir="$TFDIR" destroy -target="$NET.aws_internet_gateway.this" -target="$NET.aws_vpc.this"` (IGW first — the VPC cannot be destroyed while the IGW is attached). Or discard by reverting the commit and re-planning.

**Common failure** — `VpcLimitExceeded` (5 VPCs/region default), or a lingering same-CIDR VPC from a prior failed run.

**Troubleshooting** — VpcLimitExceeded ⇒ delete abandoned VPCs or request a quota increase. Duplicate CIDR is not blocked by AWS but signals a partial prior apply; `terraform -chdir="$TFDIR" state list | grep network` to see what state already tracks, and reconcile before re-applying rather than creating a second VPC.

---

## Step 4.2 — Subnets (public / private-app / private-data across ≥3 AZs)

**Objective** — Create the three subnet tiers, each replicated across the discovered AZs: `aws_subnet.public` (edge/ALB/NAT), `aws_subnet.app` (EKS nodes), `aws_subnet.data` (Aurora/Redis/MSK — **isolated**). Multi-AZ ≥3 is an availability NFR ([09 §8]); the module `validate`s AZ count ≥ 3.

**Prerequisites** — Step 4.1 complete (`VPC_ID` set).

**Commands**
```bash
terraform -chdir="$TFDIR" apply \
  -target="$NET.aws_subnet.public" \
  -target="$NET.aws_subnet.app" \
  -target="$NET.aws_subnet.data"
aws ec2 describe-subnets --filters Name=vpc-id,Values="$VPC_ID" --region "$AWS_REGION" \
  --query 'sort_by(Subnets,&CidrBlock)[].{name:Tags[?Key==`Name`]|[0].Value,az:AvailabilityZone,cidr:CidrBlock,tier:Tags[?Key==`Tier`]|[0].Value}' \
  --output table
```

**Expected output** — `Apply complete! Resources: 9 added, 0 changed, 0 destroyed.` The table lists 9 subnets: three `Tier=public` (`10.10.0.0/20`,`/20`@16,`/20`@32), three `Tier=private-app` (`.48/.64/.80`), three `Tier=private-data` (`.96/.112/.128`), spread one per tier across the three AZs. Public subnets carry `kubernetes.io/role/elb=1`; app subnets `kubernetes.io/role/internal-elb=1`; all carry `map_public_ip_on_launch=false`.

**Verification** — Exactly 3 distinct AZs MUST be covered: `aws ec2 describe-subnets --filters Name=vpc-id,Values="$VPC_ID" --region "$AWS_REGION" --query 'Subnets[].AvailabilityZone' --output text | tr '\t' '\n' | sort -u | wc -l` returns `3`. No subnet auto-assigns public IPs: the same query for `MapPublicIpOnLaunch` MUST be all `false` (nodes MUST NOT get public IPs). Re-run the apply ⇒ `No changes`.

**Rollback** — `terraform -chdir="$TFDIR" destroy -target="$NET.aws_subnet.data" -target="$NET.aws_subnet.app" -target="$NET.aws_subnet.public"`. Subnets destroy cleanly only if nothing (ENIs, NAT, endpoints) is in them yet — at this step nothing is.

**Common failure** — `InvalidSubnet.Range` / CIDR overlap, or `Value (<az>) for parameter availabilityZone is invalid` when the discovered AZ list drifts.

**Troubleshooting** — CIDR overlap almost always means `*_newbits` or `vpc_cidr` was hand-edited so tiers collide; the module derives non-overlapping bands (public/app/data occupy netnum `0..n-1 / n..2n-1 / 2n..3n-1`) — restore defaults rather than hardcoding CIDRs. Invalid AZ ⇒ `data.aws_availability_zones` picked an AZ your account can't use; the env `slice(...,0,3)`s the discovered list, so re-run `plan` to refresh discovery.

---

## Step 4.3 — Egress-cell fleet (NAT), ADR-0017 R-020

**Objective** — Create the horizontally-scaled egress-cell fleet: one `aws_eip.egress` + one `aws_nat_gateway.egress_cell` per selected AZ (`egress_cell_count = 1` in `dev`; **one per AZ** in staging/prod). The cells are the enforcement plumbing for the outbound-allowlist control point ([09 §4]) and, per [ADR-0017 R-020](../../adr/ADR-0017-blast-radius-isolation.md), are a **fleet, not a chokepoint** — losing a cell reroutes.

**Prerequisites** — Steps 4.1–4.2 complete; the public subnets exist (NAT lives in the public tier).

**Commands**
```bash
terraform -chdir="$TFDIR" apply \
  -target="$NET.aws_eip.egress" \
  -target="$NET.aws_nat_gateway.egress_cell"
aws ec2 describe-nat-gateways --filter Name=vpc-id,Values="$VPC_ID" --region "$AWS_REGION" \
  --query 'NatGateways[].{name:Tags[?Key==`Name`]|[0].Value,az:SubnetId,state:State,eip:NatGatewayAddresses[0].PublicIp}' \
  --output table
terraform -chdir="$TFDIR" output -json egress_cell_public_ips
```

**Expected output** — `Apply complete! Resources: 2 added, 0 changed, 0 destroyed.` (`dev`; staging/prod add one EIP+NAT per AZ). Each NAT shows `state=available` with a `Role=egress-cell` tag and a stable public IP. `egress_cell_public_ips` echoes the EIP(s) — these are the **stable outbound source IPs partners allowlist**, so they MUST be recorded and change-controlled.

**Verification** — NAT MUST sit in a **public** subnet (never app/data): resolve its `SubnetId` and confirm the `Tier=public` tag. NAT reaches `available` (can take 1–3 min): `aws ec2 describe-nat-gateways --filter Name=vpc-id,Values="$VPC_ID" --region "$AWS_REGION" --query 'NatGateways[?State!=`available`]'` returns `[]`. Second apply ⇒ `No changes`.

**Rollback** — `terraform -chdir="$TFDIR" destroy -target="$NET.aws_nat_gateway.egress_cell" -target="$NET.aws_eip.egress"` (NAT before EIP; releasing an EIP still attached to a live NAT fails). Note: partner-allowlisted EIPs are operationally significant — coordinate before releasing, as a new EIP means a new outbound IP to re-allowlist.

**Common failure** — `AddressLimitExceeded` (5 EIPs/region default) or NAT stuck `pending`→`failed` because the public subnet has no IGW route yet.

**Troubleshooting** — EIP limit ⇒ release abandoned EIPs or raise the quota. NAT `failed` ⇒ the public tier's IGW default route (Step 4.4) is a soft dependency for a *functioning* NAT; the gateway still creates here, but if it reports `failed`, confirm Step 4.1's IGW is attached and re-create the NAT. In prod, `egress_cell_count = 0` (one per AZ) — verify the fleet size equals AZ count, not 1.

---

## Step 4.4 — Route tables (public→IGW · app→NAT · data→none)

**Objective** — Create and associate the routing that defines each tier's reachability: public route table with `0.0.0.0/0 → IGW`; one **per-AZ** app route table with `0.0.0.0/0 → local egress cell` (falling back to the first cell if an AZ has none); per-AZ data route tables with **no default route** — the data tier is internet-isolated by construction ([09 §4]).

**Prerequisites** — Steps 4.1–4.3 complete.

**Commands**
```bash
terraform -chdir="$TFDIR" apply \
  -target="$NET.aws_route_table.public"  -target="$NET.aws_route.public_internet" \
  -target="$NET.aws_route_table_association.public" \
  -target="$NET.aws_route_table.app"     -target="$NET.aws_route.app_egress" \
  -target="$NET.aws_route_table_association.app" \
  -target="$NET.aws_route_table.data"    -target="$NET.aws_route_table_association.data"
# Enumerate routes per tier
aws ec2 describe-route-tables --filters Name=vpc-id,Values="$VPC_ID" --region "$AWS_REGION" \
  --query 'RouteTables[].{name:Tags[?Key==`Name`]|[0].Value,routes:Routes[].{dst:DestinationCidrBlock,gw:GatewayId,nat:NatGatewayId}}'
```

**Expected output** — `Apply complete! Resources: <N> added, 0 changed, 0 destroyed.` (`dev`: 1 public RT + 3 app RTs + 3 data RTs, one public route, 3 app routes, plus associations for all 9 subnets). `rt-public` has a `0.0.0.0/0 → igw-…` route; each `rt-app-<az>` has `0.0.0.0/0 → nat-…`; each `rt-data-<az>` has **only** the implicit local VPC route (and, after Step 4.7, the S3 prefix-list route) — **no** `0.0.0.0/0`.

**Verification** — Data-tier isolation is the load-bearing invariant. This query MUST return empty:
```bash
aws ec2 describe-route-tables --filters Name=vpc-id,Values="$VPC_ID" Name=tag:Name,Values="${PREFIX}-rt-data-*" \
  --region "$AWS_REGION" \
  --query 'RouteTables[].Routes[?DestinationCidrBlock==`0.0.0.0/0`]' --output text
```
Empty output ⇒ data tier has no internet path (PASS). Conversely each `rt-app-*` MUST have a NAT-targeted default route. Second apply ⇒ `No changes`.

**Rollback** — `terraform -chdir="$TFDIR" destroy -target="$NET.aws_route_table_association.app" -target="$NET.aws_route_table_association.data" -target="$NET.aws_route_table_association.public" -target="$NET.aws_route.app_egress" -target="$NET.aws_route.public_internet" -target="$NET.aws_route_table.app" -target="$NET.aws_route_table.data" -target="$NET.aws_route_table.public"` (associations and routes before their tables). Removing an association reverts the subnet to the VPC main route table.

**Common failure** — A **data** route table shows a `0.0.0.0/0` route (isolation breach), or `RouteAlreadyExists` on re-apply after a manual console edit.

**Troubleshooting** — Any default route on a data RT is a P0 finding: it means someone added a route outside the module — remove it and add a Config rule/guardrail so it cannot recur; the module never writes a default route into `aws_route_table.data`. `RouteAlreadyExists` ⇒ console drift; `terraform -chdir="$TFDIR" apply` will reconcile, or import/remove the manual route. If app egress does not work end-to-end, confirm the app route's `nat_gateway_id` resolves to an `available` cell from Step 4.3.

---

## Step 4.5 — Security groups (default-deny; money-path has no `0.0.0.0/0`)

**Objective** — Create the baseline `aws_security_group.default_deny` (no ingress; egress restricted to the VPC CIDR) and the interface-endpoint SG `aws_security_group.endpoints` (ingress 443 from the VPC only). Consumers reference these and open ports **by SG-reference, not CIDR** ([09 §4]); no money-path security group may carry a `0.0.0.0/0` rule.

**Prerequisites** — Step 4.1 complete (`VPC_ID` set).

**Commands**
```bash
terraform -chdir="$TFDIR" apply \
  -target="$NET.aws_security_group.default_deny" \
  -target="$NET.aws_security_group.endpoints"
aws ec2 describe-security-groups --filters Name=vpc-id,Values="$VPC_ID" \
  Name=tag:Name,Values="${PREFIX}-default-deny-sg","${PREFIX}-vpce-sg" --region "$AWS_REGION" \
  --query 'SecurityGroups[].{name:Tags[?Key==`Name`]|[0].Value,ingress:IpPermissions,egress:IpPermissionsEgress}'
```

**Expected output** — `Apply complete! Resources: 2 added, 0 changed, 0 destroyed.` `default-deny-sg`: **empty** `IpPermissions` (ingress) and a single egress rule scoped to `10.10.0.0/16` (protocol `-1`). `vpce-sg`: one ingress rule tcp/443 from `10.10.0.0/16`, egress return-traffic within the VPC. Neither SG contains `0.0.0.0/0`.

**Verification** — The default-deny SG MUST have zero ingress rules: `aws ec2 describe-security-groups --filters Name=vpc-id,Values="$VPC_ID" Name=tag:Name,Values="${PREFIX}-default-deny-sg" --region "$AWS_REGION" --query 'SecurityGroups[0].IpPermissions' --output text` returns empty. **Money-path guard** — no network-module SG may expose `0.0.0.0/0` on any rule; this MUST return empty:
```bash
aws ec2 describe-security-groups --filters Name=vpc-id,Values="$VPC_ID" --region "$AWS_REGION" \
  --query 'SecurityGroups[?IpPermissions[?IpRanges[?CidrIp==`0.0.0.0/0`]] || IpPermissionsEgress[?IpRanges[?CidrIp==`0.0.0.0/0`]]].GroupId' --output text
```
Second apply ⇒ `No changes`.

**Rollback** — `terraform -chdir="$TFDIR" destroy -target="$NET.aws_security_group.endpoints" -target="$NET.aws_security_group.default_deny"`. Both use `create_before_destroy`; a destroy fails if another resource (a live endpoint or ENI) still references the SG — remove the referrer first.

**Common failure** — `DependencyViolation` on destroy because interface endpoints (Step 4.7) already attach `vpce-sg`; or a downstream consumer added an ingress CIDR rule directly onto the shared default-deny SG.

**Troubleshooting** — DependencyViolation ⇒ destroy Step 4.7 endpoints before the SG, or leave the SG (it is the correct end state). If describe shows an unexpected CIDR ingress on `default-deny-sg`, a consumer violated the SG-reference rule — that belongs in the consuming module as an SG-referenced rule, not a CIDR on the shared baseline; revert it. Money-path SGs are provisioned by the `compute`/data modules in later chapters, but the invariant (no `0.0.0.0/0`) is asserted here and re-asserted at the [Chapter 8 exit gate](08-exit-gate-validation.md).

---

## Step 4.6 — NACL posture (subnet-tier defense-in-depth)

**Objective** — Establish and verify the subnet-tier network-ACL posture as a **stateless defense-in-depth layer beneath the stateful default-deny SGs** (§4.5). The `network` module does **not** yet ship custom `aws_network_acl` resources — the enforced L4 control today is the default-deny SG — so this step (a) verifies the AWS-created **default NACL** that every new subnet is associated with, and (b) documents the per-tier NACL hardening operators SHOULD add for staging/prod.

**Prerequisites** — Steps 4.2 and 4.4 complete (subnets exist and are associated).

**Commands**
```bash
# Every subnet MUST be associated with a NACL (default NACL until custom ones are added)
aws ec2 describe-network-acls --filters Name=vpc-id,Values="$VPC_ID" --region "$AWS_REGION" \
  --query 'NetworkAcls[].{id:NetworkAclId,default:IsDefault,subnets:Associations[].SubnetId,
           ingress:Entries[?Egress==`false`].{rule:RuleNumber,action:RuleAction,cidr:CidrBlock},
           egress:Entries[?Egress==`true`].{rule:RuleNumber,action:RuleAction,cidr:CidrBlock}}'
```

**Expected output** — One `IsDefault=true` NACL associated with all 9 `dev` subnets, with the standard default entries (rule 100 `allow` both directions, rule `32767` `deny`). No subnet is left unassociated (an unassociated subnet silently inherits the default NACL — verify explicitly).

**Verification** — Every subnet in the VPC MUST resolve to exactly one NACL association:
```bash
SUBNET_CT=$(aws ec2 describe-subnets --filters Name=vpc-id,Values="$VPC_ID" --region "$AWS_REGION" --query 'length(Subnets)')
ASSOC_CT=$(aws ec2 describe-network-acls --filters Name=vpc-id,Values="$VPC_ID" --region "$AWS_REGION" --query 'length(NetworkAcls[].Associations[])')
test "$SUBNET_CT" = "$ASSOC_CT" && echo "NACL-COVERAGE-OK ($SUBNET_CT)" || echo "GAP: $SUBNET_CT subnets vs $ASSOC_CT NACL assocs"
```
**Hardening (staging/prod, SHOULD):** add per-tier restrictive `aws_network_acl` resources (e.g. data-tier NACL denying `0.0.0.0/0` egress to reinforce Step 4.4 at L4, public-tier NACL scoped to CDN/GA ingress). Track this as a defense-in-depth item for the module; until then the default-deny SG is the enforced control and the data-tier route isolation (§4.4) is the primary internet-isolation guarantee.

**Rollback** — No Terraform-managed NACL resources are created by this step, so there is nothing to `destroy`; the default NACL is owned by the VPC and is removed only when the VPC is destroyed (Step 4.1 rollback). If custom per-tier NACLs are later added to the module, their rollback is `terraform destroy -target=$NET.aws_network_acl.<tier>`, which reverts the subnet to the default NACL.

**Common failure** — A subnet appears with **no** NACL association (impossible under AWS defaults but can occur mid-apply), or a hand-added custom NACL blocks return traffic (NACLs are **stateless** — both directions and ephemeral ports must be allowed).

**Troubleshooting** — Missing association ⇒ re-run Step 4.2/4.4; AWS auto-associates the default NACL on subnet create. If custom NACLs are introduced and connectivity breaks, remember NACLs are stateless: allow ephemeral return ports `1024–65535` on the reverse direction, and keep NACL rules coarse (tier-level) with the fine-grained allow/deny left to SGs.

---

## Step 4.7 — VPC endpoints (S3 gateway + interface PrivateLink)

**Objective** — Create the S3 **gateway** endpoint (`aws_vpc_endpoint.s3_gateway`, attached to the app + data route tables) and the **interface** endpoints (`aws_vpc_endpoint.interface`, one per service in `interface_endpoint_services` — `dev` inherits `ecr.api, ecr.dkr, sts, logs, secretsmanager, kms`). This keeps managed-service and S3 traffic on the AWS backbone, lets the internet-isolated data tier reach S3/managed services without NAT, and cuts NAT/egress cost ([09 §4], [09 §9]).

**Prerequisites** — Steps 4.2, 4.4, 4.5 complete (data subnets, route tables, and `vpce-sg` exist).

**Commands**
```bash
terraform -chdir="$TFDIR" apply \
  -target="$NET.aws_vpc_endpoint.s3_gateway" \
  -target="$NET.aws_vpc_endpoint.interface"
aws ec2 describe-vpc-endpoints --filters Name=vpc-id,Values="$VPC_ID" --region "$AWS_REGION" \
  --query 'VpcEndpoints[].{svc:ServiceName,type:VpcEndpointType,state:State,dns:PrivateDnsEnabled}' --output table
```

**Expected output** — `Apply complete! Resources: 7 added, 0 changed, 0 destroyed.` (`dev`: 1 gateway + 6 interface). The S3 gateway endpoint is `Gateway` type and attached to 6 route tables (3 data + 3 app). Each interface endpoint is `Interface` type, `State=available`, `PrivateDnsEnabled=true`, provisioned in the three **data** subnets behind `vpce-sg`.

**Verification** — Interface endpoints reach `available` (can take a minute): `aws ec2 describe-vpc-endpoints --filters Name=vpc-id,Values="$VPC_ID" Name=vpc-endpoint-type,Values=Interface --region "$AWS_REGION" --query 'VpcEndpoints[?State!=\`available\`]'` returns `[]`. The S3 gateway MUST attach to the data route tables (so the isolated tier reaches S3 off-internet): `aws ec2 describe-vpc-endpoints --filters Name=vpc-id,Values="$VPC_ID" Name=service-name,Values="com.amazonaws.${AWS_REGION}.s3" --region "$AWS_REGION" --query 'VpcEndpoints[0].RouteTableIds | length(@)'` returns `6`. Cross-check module output: `terraform -chdir="$TFDIR" output -json` exposes `s3_gateway_endpoint_id` and `interface_endpoint_ids`. Second apply ⇒ `No changes`.

**Common failure** — Interface endpoint stuck `pending` or `PrivateDnsEnabled` failing because VPC DNS attributes are off; or `InvalidServiceName` for a service short-name not available in `<REGION>`.

**Troubleshooting** — Private DNS requires the VPC's `enableDnsSupport`+`enableDnsHostnames` (verified in Step 4.1) — if off, private DNS silently fails and pods fall back to public endpoints via NAT. `InvalidServiceName` ⇒ the service isn't offered in the region or the short-name is wrong; list valid names with `aws ec2 describe-vpc-endpoint-services --region "$AWS_REGION" --query 'ServiceNames' | grep <svc>` and adjust `interface_endpoint_services`. If ECR pulls still traverse NAT, confirm both `ecr.api` **and** `ecr.dkr` endpoints exist and `vpce-sg` allows 443 from the app CIDR.

**Rollback** — `terraform -chdir="$TFDIR" destroy -target="$NET.aws_vpc_endpoint.interface" -target="$NET.aws_vpc_endpoint.s3_gateway"`. Removing endpoints makes the data tier lose its off-internet path to those services — do this only during teardown, since with the data tier internet-isolated there is no NAT fallback for managed-service reachability.

---

## Step 4.8 — VPC Flow Logs (audit trail) — staging/prod

**Objective** — Enable VPC Flow Logs → CloudWatch for the immutable audit trail. In `dev` this is **intentionally off** (`enable_flow_logs = false`); staging/prod **MUST** set `enable_flow_logs = true`. Documented here so the fabric is complete across environments.

**Prerequisites** — Step 4.1 complete. Applies when the env sets `enable_flow_logs = true` (staging/prod).

**Commands**
```bash
# dev: expect zero flow-log resources
terraform -chdir="$TFDIR" state list | grep -E 'network\.aws_flow_log|network\.aws_cloudwatch_log_group\.flow' || echo "FLOW-LOGS-OFF (expected in dev)"
# staging/prod (enable_flow_logs=true): apply the flow-log resources
terraform -chdir="$TFDIR" apply \
  -target="$NET.aws_cloudwatch_log_group.flow" \
  -target="$NET.aws_iam_role.flow" -target="$NET.aws_iam_role_policy.flow" \
  -target="$NET.aws_flow_log.this"
aws ec2 describe-flow-logs --filter Name=resource-id,Values="$VPC_ID" --region "$AWS_REGION" \
  --query 'FlowLogs[].{status:FlowLogStatus,dest:LogDestination,traffic:TrafficType}'
```

**Expected output** — `dev`: the grep prints `FLOW-LOGS-OFF (expected in dev)` and apply is not run. staging/prod: `Apply complete! Resources: 4 added, …`; `describe-flow-logs` shows `FlowLogStatus=ACTIVE`, `TrafficType=ALL`, destination `/nexus/vpc/<PREFIX>/flow-logs`.

**Verification** — `dev`: no flow-log resources in state (PASS by absence). staging/prod: `FlowLogStatus` MUST be `ACTIVE` and the log group retention MUST equal `flow_log_retention_days`. Re-apply ⇒ `No changes`.

**Rollback** — staging/prod: `terraform -chdir="$TFDIR" destroy -target="$NET.aws_flow_log.this" -target="$NET.aws_iam_role_policy.flow" -target="$NET.aws_iam_role.flow" -target="$NET.aws_cloudwatch_log_group.flow"`, or flip `enable_flow_logs = false` and apply (the `count` guard removes them). `dev`: nothing to roll back.

**Common failure** — Flow log `FlowLogStatus=FAILED` because the IAM role's trust or permissions to CloudWatch Logs are incomplete.

**Troubleshooting** — `FAILED` ⇒ confirm the module's `aws_iam_role.flow` trusts `vpc-flow-logs.amazonaws.com` and its policy allows `logs:CreateLogStream`/`PutLogEvents` on the group ARN; both are provisioned by the module, so a failure usually means the role hadn't propagated when the flow log was created — re-apply. Do not enable flow logs in `dev` to "match prod" — the `dev` deviation is deliberate (cost), and topology parity is validated in staging.

---

## Step 4.9 — Converge the whole `network` sub-module (drop `-target`) and confirm no-op

**Objective** — Remove the staged-`-target` exception by applying the **entire** `network` sub-module untargeted, proving the fabric is whole and internally consistent, then re-applying to prove the chapter's idempotency contract.

**Prerequisites** — Steps 4.1–4.7 complete (4.8 per env).

**Commands**
```bash
terraform -chdir="$TFDIR" plan  -target="$NET" -out=net-converge.tfplan
terraform -chdir="$TFDIR" apply -target="$NET"
# idempotency proof
terraform -chdir="$TFDIR" plan  -target="$NET" -detailed-exitcode; echo "exit=$?"
```

**Expected output** — The convergence `plan` MUST already read `No changes` (the staged steps created everything). `apply`: `No changes. Your infrastructure matches the configuration.` The idempotency `plan -detailed-exitcode` prints `exit=0` (0 = no changes; 2 would mean drift; 1 = error).

**Verification** — `exit=0` from `-detailed-exitcode` is the machine-checkable idempotency gate — a **second apply is a no-op**. Resource count in state matches the plan from Step 4.0: `terraform -chdir="$TFDIR" state list | grep -c 'module.primary.module.network'`. This is the network portion of the [Chapter 8 exit gate](08-exit-gate-validation.md) evidence.

**Rollback** — Full network teardown (only during environment decommission): `terraform -chdir="$TFDIR" destroy -target="$NET"`. This destroys the fabric in reverse dependency order; it will fail while [Chapter 5](05-kubernetes.md) compute/data resources still reference these subnets/SGs, which is the correct guard — tear those down first.

**Common failure** — Convergence `plan` shows unexpected changes (drift) even though every staged step said `No changes`.

**Troubleshooting** — Drift here means an out-of-band console/CLI edit between steps (a manually added route, SG rule, or tag). Inspect with `terraform -chdir="$TFDIR" plan -target="$NET"` and reconcile: either `apply` to restore the module's declared state, or, if the manual change was legitimate, encode it in the module and re-plan. Never leave the sub-module in a targeted-partial state — the untargeted convergence is what makes state authoritative.

---

## Staging & prod (repeat)

The identical fabric is applied to `staging` and `prod` by switching `$TFDIR` to `infrastructure/terraform/envs/staging` and `.../prod` and repeating Steps 4.0–4.9 — the module is the same, only the env's inputs differ. Key differences the operator MUST honor:

| Input | dev | staging | prod |
|-------|-----|---------|------|
| `egress_cell_count` | `1` (cost-capped) | `0` ⇒ one cell per AZ | `0` ⇒ one cell per AZ (HA, ADR-0017 R-020) |
| `enable_flow_logs` | `false` | `true` | `true` |
| Regions (`region-stack` instances) | 1 (us-east-1) | 2 (us-east-1 + **ap-south-1** regulated tier) | ≥2 (primary + **in-zone DR pair**) |
| Endpoint public access (downstream, Ch5) | `true` (narrowed CIDRs) | private | private |

Staging carries the **ap-south-1 regulated-region tier + its in-zone DR pair** so residency/DR is exercised before the P4 South-Asia market opens ([09 §12], ADR-0016). Each additional region is a separate `region-stack` instance in the env root with its own provider alias; run Steps 4.0–4.9 per region address (e.g. `module.primary.module.network` and `module.dr_pair.module.network`).

---

## Exit criteria for this chapter

- [ ] VPC `available`, DNS support + hostnames on, IGW attached (§4.1).
- [ ] 9 subnets across 3 AZs, three tiers, no public-IP-on-launch (§4.2).
- [ ] Egress-cell fleet `available`; outbound EIP(s) recorded for partner allowlist (§4.3).
- [ ] `rt-data-*` has **no** `0.0.0.0/0`; `rt-app-*` routes to a NAT; `rt-public` routes to IGW (§4.4).
- [ ] Default-deny SG has zero ingress; **no** network SG carries `0.0.0.0/0` (money-path guard) (§4.5).
- [ ] Every subnet is NACL-associated; per-tier NACL hardening tracked for staging/prod (§4.6).
- [ ] S3 gateway endpoint attached to app+data route tables; interface endpoints `available` with private DNS (§4.7).
- [ ] Flow logs `ACTIVE` in staging/prod (off by design in dev) (§4.8).
- [ ] Untargeted `plan -target="$NET" -detailed-exitcode` returns `0` — **a second apply is a no-op** (§4.9).

Proceed to [Chapter 5 — Kubernetes](05-kubernetes.md) only after the boxes above are checked; the network outputs (`app_subnet_ids_list`, `data_subnet_ids_list`, `default_deny_security_group_id`, `vpc_id`) are the composition contract EKS and the data tier consume.

---

*Prev: [Chapter 3 — Terraform Bootstrap](03-terraform-bootstrap.md) · Next: [Chapter 5 — Kubernetes](05-kubernetes.md) · Up: [00 — Manual index](00-README.md)*
