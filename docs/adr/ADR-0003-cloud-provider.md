# ADR-0003 — Cloud Provider: AWS-Primary, Multi-Cloud-Capable

**Status:** Proposed
**Date:** 2026-07-13
**Deciders:** Cloud Architect, DevOps, CTO
**Depends on:** [SDD §6](../02-software-design-document.md#6-technology-stack--decisions-with-alternatives), [System Architecture](../04-system-architecture.md)
**Supersedes:** —
**Related:** [ADR-0004 (architecture style)](ADR-0004-architecture-style.md), [09 — Cloud Architecture](../09-cloud-architecture.md)

---

## Context

NEXUS is a global, AI-heavy shopping super-platform whose infrastructure must satisfy:

- **Managed Kubernetes** as the compute substrate ([SDD §6](../02-software-design-document.md#6-technology-stack--decisions-with-alternatives): "Kubernetes on AWS, multi-cloud-capable").
- **Managed data engines**: PostgreSQL, Redis, OpenSearch, Kafka, ClickHouse, object store — with minimal operational headcount in Phase 1.
- **Data residency** across US, EU and South-Asia (Bangladesh corridor) per **NFR-PRIV-01**.
- **Availability** of 99.95% discovery (**NFR-AVAIL-01**) and 99.9% checkout (**NFR-AVAIL-02**).
- **Cost as a first-class driver** — AI inference and infra are the largest variable costs ([Business Model §5](../03-business-model.md)); the provider choice must not amplify egress or managed-service premiums, and must preserve pricing leverage.
- **No deep lock-in** — the [Prime Directives](../../PROJECT_MEMORY.md) demand evolvability; a single-vendor trap would compromise long-term cost negotiation and portability.

We must choose a primary cloud posture without foreclosing multi-cloud, and record how we avoid lock-in while still using managed services aggressively.

## Decision

**Adopt AWS as the primary cloud, with a deliberately multi-cloud-capable architecture.**

- Run all compute on **Amazon EKS** (upstream Kubernetes), not a proprietary compute PaaS.
- Provision **all** infrastructure through **Terraform** (provider-agnostic HCL, cloud-specific modules) and deploy **all** workloads through **Helm/Kustomize** — never through console or provider-locked CI primitives.
- Prefer managed AWS data services (Aurora PostgreSQL, ElastiCache, OpenSearch Service, MSK, S3) **but only for engines that are open-source and self-hostable elsewhere**, so any single service can be re-platformed to another cloud or self-hosted on Kubernetes without a rewrite.
- Wrap provider-specific services (queues, secrets, KMS, object store) behind **narrow internal interfaces** (ports/adapters) so the application depends on capabilities, not SDKs.
- Keep a **portability caveat** on record for every managed service (see [09 §5](../09-cloud-architecture.md#5-managed-data-services-mapping)).

## Options considered

| Option | Managed K8s | Managed Kafka | Data-engine breadth | Residency (US/EU/AP-South) | AI/GPU + inference | Cost posture | Lock-in risk | Verdict |
|--------|-------------|---------------|---------------------|----------------------------|--------------------|--------------|--------------|---------|
| **AWS-primary, MC-capable** | EKS (upstream) | MSK (managed Apache Kafka) | Widest (Aurora, OpenSearch **native fork**, ElastiCache, S3) | us-east-1, eu-*, ap-south-1 (Mumbai) all GA | Broad GPU fleet + Bedrock optional | Spot + Savings Plans + Graviton; egress is the watch-item | Medium — mitigated by IaC/Helm/open engines | ✅ **Chosen** |
| GCP-primary | GKE (best-in-class) | No first-party Kafka (Confluent MP) | Strong analytics (BigQuery) but OpenSearch/Kafka weaker | ap-south (Mumbai/Delhi) GA | Excellent TPUs, strong GPU | Sustained-use discounts, competitive egress | Medium-high on BigQuery gravity | ❌ analytics gravity + weaker managed Kafka/search |
| Azure-primary | AKS | HDInsight/Event Hubs (Kafka-API) | OSS parity weaker; strong enterprise | Central India GA | Good GPU, OpenAI tie-in | EA discounts | Medium-high; AD/enterprise pull | ❌ weaker OSS-data fit for our stack |
| True multi-cloud day 1 | Per-cloud | Per-cloud | N/A | Best residency spread | Best-of-breed shopping | Highest ops + egress | Lowest single-vendor, highest complexity | ❌ premature; operational tax before PMF |

## Consequences

**Positive**

- Fastest path to a managed, elastic platform with the **broadest match** to our exact engines (OpenSearch is an AWS-originated fork; MSK is genuine Apache Kafka; Aurora speaks PostgreSQL wire protocol).
- **NFR-PRIV-01** satisfied: AWS has GA regions in all three residency zones including **ap-south-1 (Mumbai)** for the Bangladesh/South-Asia corridor.
- Portability preserved: because compute is upstream K8s and every data engine is open-source, an exit is a **migration project, not a rewrite**.
- Strong **cost levers**: Graviton (ARM), Spot, Savings Plans, and S3 tiering directly attack the biggest bills.

**Negative / costs**

- **Egress pricing** is a structural cost risk given NEXUS makes many outbound authorized-API calls and multi-region replication; must be actively governed (FinOps, [09 §9](../09-cloud-architecture.md#9-cost-architecture-finops)).
- Managed-service premiums (MSK, OpenSearch Service) can exceed self-hosting at scale — re-evaluate at capacity milestones.
- Multi-cloud-capability is **latent, not free**: we pay a small ongoing "portability tax" (no proprietary shortcuts, adapter layers) to keep the option open.

**Guardrails to keep the decision honest**

- CI lint MUST fail on direct use of a provider SDK outside an approved adapter package.
- No managed service enters the stack without a documented self-host/alternate-cloud fallback.
- Egress and per-service cost budgets MUST have alerts before GA.

## Review triggers

Revisit this ADR if: (a) a residency market appears where AWS has no compliant region; (b) AI inference economics make a GPU/TPU-specific cloud materially cheaper at our volume; or (c) egress costs exceed budgeted thresholds two quarters running.

---
*Part of the [NEXUS](../../PROJECT_MEMORY.md) decision log. Full architecture in [09 — Cloud Architecture](../09-cloud-architecture.md).*
