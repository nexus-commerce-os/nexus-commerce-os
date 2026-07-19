# Module: `storage`

> Versioned, encrypted, TLS-only S3 buckets with residency-guarded cross-region replication.

| Field | Value |
|-------|-------|
| **Purpose** | Provision the object store (images, feed files, backups, lake) as hardened S3 buckets: versioning, SSE-KMS, public-access-block, TLS-only policy, lifecycle tiering, and **opt-in CRR that is hard-blocked for personal-data buckets**. |
| **Owner** | Data Platform (`infra-data`) |
| **Instantiated by** | `envs/{dev,staging,prod}` — per region. |
| **Maps to** | [09 §5 object store](../../../../docs/09-cloud-architecture.md#5-managed-data-services-mapping), [09 §6 S3 CRR non-personal](../../../../docs/09-cloud-architecture.md#6-multi-region-strategy), [09 §9 lifecycle/cost](../../../../docs/09-cloud-architecture.md#9-cost-architecture-finops); **ADR-0016 R-013** (residency: no personal data cross-region); **ADR-0003** (S3 API is de-facto standard, adapter-wrapped). |

## What it creates (per bucket, `for_each` over `var.buckets`)

- **`aws_s3_bucket`** with a `random_id` suffix for global uniqueness; `prevent_destroy`.
- **Public access block** — all four flags `true`.
- **Versioning** (default on).
- **SSE-KMS** with the customer-managed key + bucket keys.
- **TLS-only bucket policy** — denies any `aws:SecureTransport=false` request.
- **Lifecycle rules** — transition (Intelligent-Tiering by default) + expiry + noncurrent-version expiry.

## The residency guard (ADR-0016 R-013)

Cross-region replication is opt-in via `var.replication`. A **`precondition`** fails the plan if any replicated bucket has `contains_personal_data = true`:

```
Cross-region replication is FORBIDDEN for personal-data bucket "..." (residency).
```

So personal/ledger object data physically cannot be configured to leave its residency zone through this module. Only catalog/offer/asset (non-personal) buckets may replicate.

## Inputs / Outputs

**Key inputs:** `name_prefix`, `kms_key_arn` (from `security`), `buckets` (map with `contains_personal_data` + `lifecycle_rules`), `replication` (map, non-personal only), `replication_role_arn`.

**Outputs:** `bucket_ids`, `bucket_arns` (→ IRSA policies), `bucket_domain_names`.

## Dependencies

- **Upstream:** `security` (KMS key, replication role).
- **Downstream:** application services (via IRSA policies scoped to `bucket_arns`), backup jobs, the lakehouse.

## Security notes

- Encryption at rest (CMK) + in-transit (TLS-only policy); public access fully blocked.
- **Residency-safe by construction** — personal buckets cannot be replicated.
- `prevent_destroy` + versioning guard against accidental data loss.

## How to test in isolation

```bash
terraform -chdir=modules/storage init -backend=false
terraform -chdir=modules/storage validate
```
