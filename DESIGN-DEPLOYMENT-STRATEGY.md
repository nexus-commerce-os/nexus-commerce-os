# Design — Deployment Strategy for P0.2 Verification

**Status:** 🟡 DESIGN AND RECOMMENDATION ONLY. **Neither option is implemented.**
**Requested by:** CTO ruling, 2026-07-31 · **Decision required before any `terraform apply`.**

> Repo root, so the [ADR-0023](docs/adr/ADR-0023-doc-freeze-and-approval-gate.md) freeze is intact.
> **No architecture is modified and no security requirement is weakened by either option.**

---

## 1. The distinction this document turns on

**Production architecture** and **deployment verification** are related but not the same thing.

- The production architecture is settled, certified, and not up for revision here.
- Verification asks a narrower question: *what evidence does running the software somewhere real
  actually produce?*

Most of what FU-2 sets out to prove is **software behaviour observed against real infrastructure** —
a real Postgres, a real Redis shared by more than one replica, a real proxy in front, a real mailbox
at the end. A smaller but genuine remainder is **infrastructure behaviour**, and that can only be
proven on the production architecture itself.

Conflating the two costs roughly **$950/month**. Separating them costs roughly **$25/month** for the
first part and defers the second until it is affordable.

## 2. Option A — Production-architecture deployment

Deploy `infrastructure/terraform/envs/dev` as coded (the smallest existing environment).

### Infrastructure

Read from the Terraform, not assumed: 3 AZs with `egress_cell_count = 1`; EKS 1.30 with
`endpoint_public_access = false`; two node pools (`m7g.large` money, `c7g.large` discovery, each
`desired_size = 1`); Aurora PostgreSQL 16.4 writer `db.r7g.large`; two ElastiCache groups of
`cache.t4g.small` with one replica each; **MSK with 3 × `kafka.m7g.large`**; 6 KMS keys.

### Estimated monthly cost — us-east-1, on-demand

| Component | Estimate |
|---|---|
| MSK, 3 × `kafka.m7g.large` | **~$414** |
| Aurora `db.r7g.large` writer | ~$200 |
| EKS control plane | $73 |
| EKS nodes (`m7g.large` + `c7g.large`) | ~$113 |
| ElastiCache, 4 × `cache.t4g.small` | ~$93 |
| NAT gateway ×1 + data processing | ~$35 |
| KMS ×6, EBS, S3, CloudWatch, transfer | ~$35 |
| **Total** | **≈ $960 / month** |

Figures are list-price estimates and exclude storage/IO growth. **The $200 credit lasts
approximately 6 days.** Production would cost materially more — 3 NAT cells, larger pools, a
multi-AZ Aurora reader.

### Evidence obtainable

Everything in Option B, **plus**: the P0.1 exit gate (GitOps deploy, `terraform apply` idempotency,
blue-green cluster upgrade rehearsal); ALB-specific `X-Forwarded-For` topology; Aurora and
ElastiCache failover behaviour; private-subnet network isolation with no public EKS endpoint; the
Ch10 chaos experiments; the observability stack; Secrets Manager and KMS integration as designed;
autoscaling under load.

### Verification gaps

None material for P0.2. This *is* the production architecture.

### Operational risks

- **Cost overrun is the dominant risk.** Credits exhaust in about a week, after which the card is
  charged. A forgotten environment is the classic way this becomes a four-figure surprise.
- `endpoint_public_access = false` means the EKS API needs a bastion or SSM session — correct
  security, additional operational setup.
- MSK is the single largest line item and **nothing in P0.2 uses it.** It exists for P0.3+ commerce
  events. Provisioning it now buys no P0.2 evidence at all.
- Teardown must be verified, not assumed; orphaned NAT gateways and EBS volumes bill silently.

## 3. Option B — Low-cost staging deployment

A deliberately small deployment whose shape is chosen by *what FU-2 needs to observe*, not by what
production looks like.

### Infrastructure

| Component | Choice | Why this and not less |
|---|---|---|
| Compute | 1 × EC2 `t4g.small`, Docker Compose | Runs **two** Identity containers — the shared-rate-limit test needs ≥2 replicas |
| Proxy | nginx on the same host, 1 hop | The forged-`X-Forwarded-For` test needs a **real** proxy with a known hop count |
| Database | RDS PostgreSQL `db.t4g.micro` | Free-tier eligible for 12 months; real migrations, real unique indexes |
| Cache | ElastiCache `cache.t4g.micro`, or Redis container | One Redis shared by both replicas is the property under test |
| TLS | Let's Encrypt on the staging placeholder domain | **Real trusted certificate** — no self-signed, no trust override |
| Secrets | SSM Parameter Store | Free tier; keeps secrets out of the image and out of source control |
| Mail | The real SMTP provider | Same run also closes **FU-1 Gate 1** |

No EKS, no MSK, no Aurora, no NAT gateway (public subnet plus security group).

### Estimated monthly cost

| Component | Estimate |
|---|---|
| EC2 `t4g.small` | ~$12 |
| RDS `db.t4g.micro` | $0 for 12 months, then ~$12 |
| ElastiCache `cache.t4g.micro` | ~$11, or $0 as a container |
| Route 53 hosted zone, EBS, transfer | ~$3 |
| **Total** | **≈ $15 – 30 / month** |

The $200 credit lasts **7 months or more**.

### Evidence obtainable — 12 of the 16 FU-2 checklist items

Health and readiness semantics · refuses to boot unconfigured · full session lifecycle including
refresh rotation and reuse detection · **the complete mail chain end to end, link consumed, replay
rejected** · token stored hashed only in a real database · **enumeration parity for known versus
unknown addresses** · 429 with `Retry-After` · reset throttling stays silent · **forged
`X-Forwarded-For` grants no fresh quota** · **rate limit shared across two replicas** · Redis outage
fails open and is logged · device binding and scoped revocation · migrations `0001` and `0002`
applied to a real Postgres.

The two items I flagged in the FU-2 package as provable only by a real deployment — hop counting and
a shared limit across replicas — **are both satisfied here**, because both need a real proxy and a
real shared Redis, not EKS specifically.

### Verification gaps — the honest list

1. **The P0.1 exit gate is not satisfied.** No GitOps deploy, no `terraform apply` idempotency at
   scale, no blue-green upgrade rehearsal. This is the largest gap and it is structural.
2. **Ingress topology is nginx, not ALB.** The hop-count *mechanism* is verified; the *production
   topology* is not. An ALB may append differently, so this must be re-verified on Option A.
3. **No managed-service failover evidence** — Aurora and ElastiCache failover behaviour is unproven.
4. **No multi-AZ or chaos evidence** (Ch10 experiments).
5. **No network isolation evidence** — public subnet, not the designed private topology.
6. **No observability stack** — the P0.6 gate is untouched.
7. **No autoscaling evidence.**
8. **Single host** — a co-located failure domain, unlike production.

### Operational risks

- A staging environment on a public subnet must be locked down by security group and must never hold
  real user data. Seed accounts only.
- Docker Compose on one host is not the production deployment mechanism; the manifests exercised are
  not the ones production will use.
- Let's Encrypt renewal must be automated, or verification breaks in 90 days.
- The temptation to treat this as "good enough" is itself a risk — hence the naming in §5.

## 4. Exit-gate coverage

| Item | Option A | Option B |
|---|---|---|
| FU-1 Gate 1 — real SMTP provider | ✅ | ✅ |
| FU-2 — software behaviour end to end | ✅ | ✅ (12/16) |
| FU-2 — production ingress topology | ✅ | ❌ mechanism only |
| FU-2 — managed-service failover | ✅ | ❌ |
| P0.1 exit gate | ✅ | ❌ |
| P0.6 observability gate | ✅ | ❌ |
| **Permits PRODUCTION VERIFIED** | ✅ | ❌ |
| **Permits STAGING VERIFIED** | ✅ | ✅ |

## 5. The two states, defined

These must not be used interchangeably, and the board must always show which one is claimed.

**STAGING VERIFIED** — the software's behaviour is proven against real infrastructure *of the same
kinds*: a real database, a real shared cache, a real proxy, a real mail provider, more than one
replica, a real trusted certificate. It says the code is correct outside a test harness. It says
**nothing** about the production topology, failover, isolation or scale.

**PRODUCTION VERIFIED** — the deployed system is proven **on the production architecture**, including
its operational characteristics. It requires the P0.1 exit gate, managed-service behaviour, network
isolation, and observability.

Option B can only ever produce the first. No amount of care changes that, and describing Option B
results as production verification would be false.

## 6. Recommendation

**Option B first, then Option A when budget allows.**

Reasoning:

1. **It buys most of the evidence for about 3% of the cost.** 12 of 16 FU-2 items, plus FU-1 Gate 1,
   for ~$25/month against ~$960.
2. **The largest line item buys nothing for P0.2.** MSK is ~43% of Option A's cost and no P0.2 code
   path touches it. Paying $414/month to verify Identity is not a good trade.
3. **It fails in the right direction.** If Option B surfaces a defect, it is a real defect found for
   $25. If it finds none, Option A later has a far higher chance of a clean run.
4. **The gaps are known and bounded**, listed in §3 rather than discovered later.

**What must not happen:** promoting P0.2 to PRODUCTION VERIFIED on Option B evidence, or quietly
dropping the §3 gap list once staging is green.

### Sequence

| # | Step | Outcome |
|---|------|---------|
| 1 | Set an AWS budget alert **before anything else** | Cost overrun becomes visible |
| 2 | Option B deployment | — |
| 3 | Real SMTP provider run | **FU-1 → VERIFIED** |
| 4 | FU-2 checklist, 12 items | **P0.2 → STAGING VERIFIED** |
| 5 | Option A when budget allows | P0.1 exit gate |
| 6 | Re-verify the §3 gaps on Option A | **P0.2 → PRODUCTION VERIFIED** |

Step 6 is not optional. Staging evidence does not carry over.

## 7. Decisions required

1. **Approve Option B as the staging path**, or direct Option A directly, or defer both.
2. **Confirm the naming** — Option B completion is recorded as `STAGING VERIFIED`, never
   `PRODUCTION VERIFIED`.
3. **Confirm no security relaxation is permitted in staging**: real trusted TLS, the same config
   validation, the same required rate-limit settings, secrets in a secret store, no test-only
   branches. Cheaper infrastructure, identical security posture.
4. **If Option A is chosen instead**, rule on whether MSK may be omitted from the P0.2 verification
   environment — it is 43% of the cost and unused by P0.2.

Nothing is implemented pending these decisions.
