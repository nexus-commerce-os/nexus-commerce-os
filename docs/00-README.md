# NEXUS Commerce OS — Documentation Portal

**The AI Shopping Super-Platform.** Production-grade architecture & design documentation, authored by AI-DOS operating as an autonomous software company.

> **Ratified model:** NEXUS is a **pure referral + deep-link + affiliate** intelligence layer — it discovers, compares, and recommends, then hands the user off to the merchant's own checkout. It **never** processes payments, holds funds, or takes order custody ([ADR-0006](adr/ADR-0006-referral-only-model.md)).

> **Reading order matters.** Documents are numbered in dependency order. Each builds on the
> decisions ratified in the previous ones. The canonical decision log lives in
> [`../PROJECT_MEMORY.md`](../PROJECT_MEMORY.md).

## Table of Contents

| # | Document | Purpose |
|---|----------|---------|
| 00 | **This index** | Navigation & conventions |
| 01 | [Product Vision](01-vision.md) | Why we exist, who we serve, north-star, non-goals |
| 02 | [Software Design Document](02-software-design-document.md) | End-to-end design: domains, flows, NFRs, tech stack |
| 03 | [Business Model](03-business-model.md) | Revenue streams, unit economics, GTM, moat |
| 04 | [System Architecture](04-system-architecture.md) | Services, boundaries, data flow, integration |
| 05 | [AI Architecture](05-ai-architecture.md) | Agentic AI, RAG, search, recommendations, safety |
| 06 | [Database Architecture](06-database-architecture.md) | Polyglot persistence, schemas, scaling, consistency |
| 07 | [API Architecture](07-api-architecture.md) | API styles, contracts, versioning, gateway, partners |
| 08 | [Security Architecture](08-security-architecture.md) | Threat model, IAM, data protection, compliance |
| 09 | [Cloud Architecture](09-cloud-architecture.md) | Cloud topology, networking, cost, multi-region |
| 10 | [Deployment Architecture](10-deployment-architecture.md) | CI/CD, environments, IaC, release strategy, SRE |
| 11 | [Product Guidelines](11-product-guidelines.md) | Binding product-behavior rules (disclosure, savings states, neutrality) across all surfaces |
| 12 | [Trust & Transparency](12-trust-and-transparency.md) | Public trust commitments and how each is enforced |
| 13 | [Implementation Roadmap](13-implementation-roadmap.md) | P0.1–P0.8 gated build plan (post-certification) |
| — | [ADRs](adr/) | Architecture Decision Records (the "why") — 23 ADRs, 0001–0023 |
| — | [Review](review/) | Adversarial review reports, master risk registers, scalability simulation |

## Document conventions

- **Diagrams** are authored in [Mermaid](https://mermaid.js.org/) so they render on GitHub and are diffable in version control.
- **Every material decision** carries: *Options considered → Decision → Trade-offs → Risks → Assumptions → Scalability → Implementation strategy.*
- **RFC-2119 keywords** (MUST / SHOULD / MAY) are used for normative requirements.
- **NFR IDs** (`NFR-PERF-01`, etc.) are stable references used across documents.
- **Status badges:** 🟢 Ratified · 🟡 Draft · ⚪ Proposed.

## The company (agent org that authored this)

This documentation was produced by a 13-layer agent organization (Executive → Product → Architecture → AI → Commerce → Backend → Frontend → Mobile → DevOps → Security → QA → Growth → Business). See [01-vision.md §9](01-vision.md#9-the-operating-model-how-ai-dos-builds-this) for the operating model.
