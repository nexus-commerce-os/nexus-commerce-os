# AI-DOS — Persistent Project Memory & Decision Log

> This file is the **single source of truth** for the orchestrator. Every agent reads this
> before acting and appends decisions here. It is the durable memory that keeps the entire
> project consistent across the 13 layers and 100+ specialized agents.

- **Project codename:** `NEXUS`
- **Working product name:** NEXUS Commerce OS *(branding provisional — see [ADR-0002](docs/adr/ADR-0002-branding.md))*
- **Mission:** Build the world's most advanced, legally-compliant, AI-powered Shopping Super-Platform that unifies discovery, price-intelligence, savings, booking, affiliate/dropship commerce, and a creator economy behind a single conversational AI shopping agent.
- **Orchestrator:** AI-DOS (this session)
- **Started:** 2026-07-13
- **Current phase:** `PHASE 0 — Documentation & Architecture` (no application code yet, by mandate)

---

## Prime Directives (non-negotiable constraints)

1. **Documentation before code.** No feature code until the 10 foundational documents reach production quality.
2. **Legal-only data.** Official APIs, licensed merchant feeds, affiliate networks, authorized integrations **only**. No unauthorized scraping, no copyright infringement. This is an architectural constraint, not a footnote — it shapes the data layer (see [System Architecture](docs/04-system-architecture.md)).
3. **Every decision is justified.** Alternatives, trade-offs, risks, assumptions, scalability, and implementation strategy for every material choice. Captured as ADRs.
4. **Consistency over speed.** A change in one document must propagate to all affected documents. This log records the propagation.
5. **CTO mindset.** Challenge weak ideas, propose stronger alternatives, optimize for scalability, maintainability, security, performance, accessibility, legal compliance, and long-term growth.

---

## Deliverable Status Board

| # | Document | Status | Owner agent(s) |
|---|----------|--------|----------------|
| 01 | [Product Vision](docs/01-vision.md) | 🟢 Draft-complete | CEO, CPO, Strategy, Market Research |
| 02 | [Software Design Document (SDD)](docs/02-software-design-document.md) | 🟢 Draft-complete | CTO, Solution Architect |
| 03 | [Business Model](docs/03-business-model.md) | 🟢 Draft-complete | CEO, CFO, COO, Revenue |
| 04 | [System Architecture](docs/04-system-architecture.md) | 🟢 Draft-complete | Enterprise/Solution/Software Architect |
| 05 | [AI Architecture](docs/05-ai-architecture.md) | 🟢 Draft-complete | AI Orchestrator, LLM/RAG/Search/Rec Eng |
| 06 | [Database Architecture](docs/06-database-architecture.md) | 🟢 Draft-complete | Database Architect |
| 07 | [API Architecture](docs/07-api-architecture.md) | 🟢 Draft-complete | API Architect |
| 08 | [Security Architecture](docs/08-security-architecture.md) | 🟢 Draft-complete | Security Layer (OWASP/IAM/Compliance) |
| 09 | [Cloud Architecture](docs/09-cloud-architecture.md) | 🟢 Draft-complete | Cloud Architect, DevOps |
| 10 | [Deployment Architecture](docs/10-deployment-architecture.md) | 🟢 Draft-complete | DevOps, SRE |

Legend: 🟢 Draft-complete (integrated & consistency-checked) · 🟡 In progress · ⚪ Queued · 🔴 Blocked

> **All 10 foundational documents are draft-complete and passed the integration pass**
> (58 Mermaid diagrams valid; 100% of cross-doc links resolve; NFR IDs consistent).
> Remaining before "production-ratified": human review of the 4 Open Questions below +
> sign-off. Implementation planning kickoff lives in [doc 10 §12](docs/10-deployment-architecture.md).

---

## Canonical Decisions (summary — full ADRs in `docs/adr/`)

| ADR | Decision | Status |
|-----|----------|--------|
| [0001](docs/adr/ADR-0001-data-sourcing.md) | Data sourced **only** via official APIs / licensed feeds / affiliate networks | Accepted |
| [0002](docs/adr/ADR-0002-branding.md) | Codename NEXUS; consumer brand deferred to trademark clearance | Proposed |
| [0003](docs/adr/ADR-0003-cloud-provider.md) | Cloud: multi-cloud-capable, **AWS-primary** baseline | Proposed |
| [0004](docs/adr/ADR-0004-architecture-style.md) | Architecture: modular-monolith-first → strangler to microservices | Proposed |
| [0005](docs/adr/ADR-0005-ai-model-gateway.md) | AI: model-agnostic gateway, Claude/GPT/OSS behind one router | Proposed |
| [**0006**](docs/adr/ADR-0006-referral-only-model.md) | **Pure referral + deep-link + affiliate; NO payments/custody/order/fulfillment. Agent = decide + handoff. Marketplace custody = optional P5+/P7** | **Accepted (Founder-ratified 2026-07-13)** |
| [**0007**](docs/adr/ADR-0007-phased-global-rollout.md) | **Phased market rollout (US→CA/UK/AU→EU→BD/IN/PK/ME→global); i18n + multi-currency + country flags + regional compliance modules + tax abstraction + regional affiliate routing from day 1** | **Accepted (Founder-ratified 2026-07-13)** |
| [**0008**](docs/adr/ADR-0008-affiliate-gateway.md) | **Affiliate Gateway plugin architecture; common connector interface; no provider SPOF; automatic failover. Launch set: Amazon PA-API, CJ, Impact, Rakuten** | **Accepted (Founder-ratified 2026-07-13)** |
| [**0009**](docs/adr/ADR-0009-ai-cost-strategy.md) | **AI ≤ $0.01/resolved request; cheapest-capable routing + cascade + 4-tier cache (prompt/embedding/response/semantic) + OSS/cloud + FinOps (per-user/session/feature budgets, anomaly detection)** | **Accepted (Founder-ratified 2026-07-13)** |
| [**0010**](docs/adr/ADR-0010-platform-principles.md) | **Platform principles: model-agnostic, no lock-in, every subsystem replaceable, every provider adapter-wrapped, health checks + metrics everywhere, rollback for every change** | **Accepted (Founder-ratified 2026-07-13)** |

---

## Assumptions Register

| ID | Assumption | Impact if wrong | Validation plan |
|----|-----------|-----------------|-----------------|
| A1 | Phased markets (ADR-0007): P1 US → P2 CA/UK/AU → P3 EU → P4 BD/IN/PK/ME → P5 global; i18n/multi-currency from day 1 | Compliance surface & expansion cost | Market Research; per-phase legal sign-off |
| A2 | ≥4 affiliate networks live before P1 (Amazon PA-API, CJ, Impact, Rakuten; ADR-0008); none a SPOF | Catalog breadth + revenue resilience | Partnerships pipeline; Gateway failover tests |
| A3 | Conversational AI agent is the core differentiator, not just search | Product priority & AI budget | User testing, north-star metric |
| A4 | Unit economics carried by affiliate + ads + subscription, not markup | Revenue model viability | Business Model doc §5 |
| A5 | Conversion is observed only via affiliate-network **postbacks** (async, reversible) — attribution reliability is now business-critical | VMS metric + cashback accuracy | Affiliate integration §; Attribution audit |

---

## Open Questions (to resolve before Phase 1 / coding)

- [x] ~~**OQ#1** — order custody vs pure referral~~ — **RESOLVED: Pure Referral ([ADR-0006](docs/adr/ADR-0006-referral-only-model.md)).**
- [x] ~~**OQ#2** — launch geographies~~ — **RESOLVED: phased rollout ([ADR-0007](docs/adr/ADR-0007-phased-global-rollout.md)).**
- [x] ~~**OQ#3** — initial affiliate partners~~ — **RESOLVED: Amazon/CJ/Impact/Rakuten via plugin Gateway ([ADR-0008](docs/adr/ADR-0008-affiliate-gateway.md)).**
- [x] ~~**OQ#4** — AI budget~~ — **RESOLVED: ≤ $0.01/request cost strategy ([ADR-0009](docs/adr/ADR-0009-ai-cost-strategy.md)).**

**✅ All open questions closed 2026-07-13. Baseline eligible for final ratification pending the Ultra Adversarial Review gates (Arch/Sec/Scale/Maint ≥95, Doc-consistency ≥98).**

---

## Change Log

| Date | Change | Propagated to |
|------|--------|---------------|
| 2026-07-13 | Project initialized; /docs scaffold created; memory established | — |
| 2026-07-13 | Docs 01–04, README, ADR-0001/0002/0004 authored; docs 05–10 dispatched to parallel agents | — |
| 2026-07-13 | Consistency fix: "two backend languages/bounded to 2" → "three runtimes (TS/Go/Python), bounded to 3" (found during doc 07 authoring) | SDD §6, System Arch §9 |
| 2026-07-13 | Doc 07 (API Architecture) delivered | Board |
| 2026-07-13 | Docs 05, 06, 08, 09, 10 + ADR-0003, ADR-0005 delivered by parallel agents | Board |
| 2026-07-13 | Integration pass: fixed dead links (ADR-0005 filename in 09; ADR-0003 target in 10; `../` depth in ADR-0003); reconciled RTO/RPO wording in 10 vs 06/09 | 09, 10, ADR-0003 |
| 2026-07-13 | Verified: 58 Mermaid diagrams valid; 100% relative links resolve; NFR IDs consistent → board flipped 🟢 | All |
| 2026-07-13 | **OQ#1 ratified (Founder): Pure Referral model → ADR-0006.** Removed all payment/order/checkout/custody assumptions; "agentic checkout" → "agentic handoff"; marketplace custody → optional P5+/P7. Revenue reordered (affiliate/sponsored/premium-AI/merchant-analytics/ads primary) | 01,02,03,04,08,10 (direct); 05,06,07 (via agents); ADR-0006 new |
| 2026-07-13 | Post-ratification validation PASSED: 100% links resolve · 58 Mermaid valid · 0 residual ADR-0006 contradictions · SDD §4.2 anchor (5 refs) consistent. Data-model insight recorded: conversion postbacks are async+reversible → `attributed_conversion` is a separate later-arriving record with hold/clawback reversing ledger entries | All |
| 2026-07-13 | **OQ#2–#4 ratified (Founder).** ADR-0007 (phased rollout US→CA/UK/AU→EU→BD/IN/PK/ME + i18n/multi-currency/flags/compliance-modules/tax-abstraction/regional-routing), ADR-0008 (Affiliate Gateway plugin, no SPOF, 4 launch connectors), ADR-0009 (AI ≤$0.01/req + 4 caches + FinOps budgets), ADR-0010 (platform principles: replaceable/adapters/health/metrics/rollback). Propagated across 01,03 (direct) + 04,05,07,08,10 (agents) + 09 (manual recovery after agent API error) | All 8 docs + 4 ADRs |
| 2026-07-13 | Reconciled stale pre-ADR-0007 "US/EU/BD simultaneous launch" phrasing → phased (06,08); added engineering-P vs market-Phase disambiguation (10); South-Asia/ME compliance placed at P6 | 06,08,10 |
| 2026-07-13 | Full validation suite PASSED: links · 64 Mermaid · 10/10 ADRs referenced · referral consistency · cost-model (≤$0.01) · threat-model coverage · propagation. **All OQs closed → baseline eligible for final ratification. Launching Ultra Adversarial Review.** | All |
| 2026-07-14 | **Ultra Review Round 1 COMPLETE (24/25 reviewers, 160→90 unique findings).** Readiness: Arch 62 · Sec 60 · Scale 63 · Maint 68 · Doc 85 — **GATES FAIL, P0 NOT authorized.** 20 Critical + 34 High. Artifacts: [review report v1](docs/review/00-architecture-review-report-v1.md), [risk register](docs/review/01-master-risk-register.md), [scale sim](docs/review/02-scalability-simulation.md) | Review |
| 2026-07-14 | Refactoring pass STARTED (10 workstreams A–J). Dominant theme: money/revenue integrity under async reversible postbacks. Remediation ADRs 0011+ being authored | docs/review/00 §5 |

## Review status

- **Round 1:** 🔴 FAIL — 20 Critical / 34 High. Final Risk Score 432 (SEVERE). Production Readiness 30/100.
- **Gates (all must pass):** Arch≥95, Sec≥95, Scale≥95, Maint≥95, Doc≥98. **Currently 62/60/63/68/85.**
- **Refactoring workstreams:** A revenue-integrity · B money/ledger · C AI-cost-vs-trust · D multi-region/residency · E SPOF · F security/supply-chain · G privacy/compliance · H portability/ops · I product-truth · J doc-consistency. See [review report §5](docs/review/00-architecture-review-report-v1.md).
- **P0 remains BLOCKED** until Round-2 clears all gates with zero open Criticals.

### Remediation ADRs (Review R1 → refactoring)

| ADR | Closes | Status |
|-----|--------|--------|
| [0011](docs/adr/ADR-0011-attribution-reconciliation.md) attribution reconciliation | R-001,021,033 | Accepted |
| [0012](docs/adr/ADR-0012-postback-integrity.md) provisional accrual + fingerprint + forged-postback | R-002,003,084,085 | Accepted |
| [0013](docs/adr/ADR-0013-ledger-per-context.md) ledger-per-context + GL | R-004,034,035,069 | Accepted |
| [0014](docs/adr/ADR-0014-wallet-hold-gate.md) wallet held/available + payout hold-gate | R-005,022(backend),037(backend) | Accepted |
| [0015](docs/adr/ADR-0015-ai-trust-cost-integrity.md) grounding-protected + deterministic price verify | R-006,007,011,048-057,081 | Accepted |
| [0016](docs/adr/ADR-0016-region-residency-lifecycle.md) region-before-market + residency fence + erasure | R-010,013,014,015,036,073-076 | Accepted |
| [0017](docs/adr/ADR-0017-blast-radius-isolation.md) de-SPOF (AI config/egress/gateway/cluster/Redis/obs/GPU) | R-009,020,029,059,060,078,082 | Accepted |
| [0018](docs/adr/ADR-0018-connector-security-hardening.md) connector sandbox + open-redirect + ATO + CI | R-016,017,055,065-068,070,071 | Accepted |
| [0019](docs/adr/ADR-0019-portability-ops-maturity.md) real portability + EKS upgrade + rollback proof | R-012,018,019,058,061-064,077 | Accepted |
| [0020](docs/adr/ADR-0020-performance-consistency-hardening.md) perf + canonical money + contract-first | R-008,026-032,038-045,051,079,080,083,084 | Accepted |
| [0021](docs/adr/ADR-0021-legal-product-truth.md) D1–D5: FTC disclosure/travel/cashback-gating/savings-UX/commission-blind | R-021,022,023,024,037,046,047 | ✅ **ACCEPTED (Founder-ratified 2026-07-14)** |
| [0022](docs/adr/ADR-0022-round2-remediation.md) Round-2 remediation | NC-1…NC-9 + R-009/012/014/019/020 | Accepted |

> **Honest ceiling:** R-023 & R-024 are **Critical, legal, and approval-gated** → Security/Legal readiness **cannot honestly reach ≥95** until the Founder/Legal approve ADR-0021. This will be reported, not inflated (per Risk Policy).

**Refactoring pass applied (2026-07-14):** ADR-0011–0020 woven into all 8 technical docs by parallel per-doc agents (no conflicts); consolidation fixes (neutrality-test strengthened as enforcement-only, §8.5→§8.4 ref, stale ledger/egress/postback wording retired). Validation: links PASS, 66 Mermaid valid (xychart-beta ok), remediation markers coherent across docs. ADR-0021 items remain OPEN pending approval.

**Round 2 (2026-07-14):** 15 auditors. 15/24 R1 Criticals verified closed; Arch 62→73, Sec 60→74, Scale 63→78, Maint 68→66, Doc 85→80. **NO-GO** — 4 R1 Criticals open (R-021/022 UX, R-023/024 legal), 5 partial, **9 NEW Criticals** (NC-1..NC-9: reconciliation-panel not blinded, ledger fan-out no compensation, reversal keyed on attacker timestamp, money-integrity absent from exec plan, phantom R-081, ADR-0014-vs-0021 contradiction, sim not re-run, R-024 dropped from bookkeeping, portability blind to control-plane). [Report v2](docs/review/04-architecture-review-report-v2.md), [register v2](docs/review/03-master-risk-register-v2.md).

**Round 3 (2026-07-14):** ADR-0022 authored (+ simplifies ledger fan-out to event-driven idempotent consumers per complexity-auditor). Applied to docs 04/05/06/08/09/10 + sim re-run by 7 agents. 9 NC + 5 partials remediated in ADR-0022. **CORRECTION (Round 4 caught this): the NC-3 NEXUS-seq reversal wording was NOT propagated to docs 04 §5.4 / 07 §9 in R3 — those still read 'last-writer-by-network-timestamp' (open Critical C-1). Fixed in Round 5. The earlier 'validated docs 04/07' claim was inaccurate and is retracted.** Sim §10: remediation neutral-to-better at scale, +25-40% worse at 10K-100K cost floor.

**D1–D5 ratified (Founder, 2026-07-14):** [ADR-0021](docs/adr/ADR-0021-legal-product-truth.md) → **ACCEPTED**. R-023 (FTC disclosure), R-024 (travel independent-referrals-only), R-021/R-022 (savings four-state + VMS=Confirmed-only), R-037 (cashback per-jurisdiction gated), R-046/R-047 (commission-blind + agent disclosure) all closed/controlled. New docs [11 Product Guidelines](docs/11-product-guidelines.md) + [12 Trust & Transparency](docs/12-trust-and-transparency.md). Propagated to 01/03/05/08; validation PASS (links, 66 Mermaid, no stale OPEN legal Criticals).

**Round 4 (2026-07-14, 12 auditors): NO-GO.** Scores Arch 88 · Sec 88 · Scale 91 · Maint 92 · Doc 89 (all < gate). **1 open Critical C-1** — the NC-3 reversal-ordering fix was NOT propagated to docs 04 §5.4 / 07 §9 in R3 (they still said `last-writer-by-network-timestamp`), and my R3 change-log falsely claimed "validated." [Report v3](docs/review/05-architecture-review-report-v3-FINAL.md). Honest, correct catch.

**Round 5 remediation (2026-07-14):** C-1 fixed in docs 04 §5.4 + 07 §9 (NEXUS-seq reversal) + new reversal-ordering CI fitness function; false log entry retracted; doc-consistency fixes (exactly-once→effectively-once ×4, ADR-0012 body, doc-08 ledger diagram, anchors ×5, ADR-0014 savings vocab, headers, docs 11/12); security Highs H-6/7/8 (panel rotation, fingerprint anti-gaming, hardened connector runtime); [ADR-INDEX lineage map](docs/adr/ADR-INDEX-lineage.md) added; scalability design (surge admission control + OpenSearch cellularization + load-test-as-P1-gate) dispatched.

**Round 5 (2026-07-14, 12 auditors): NO-GO.** Arch 90 · Sec 84 · Scale 92 · Maint 90 · Doc 87. C-1 durably closed (verified), but **2 new Criticals** (C-A stale savings vocab at doc06:352; C-B CONVERSION single-column `network_txn_id` UK vs mandated composite) + the **recurring ADR→doc propagation-failure** (H-6/7/8 written to ADRs, not docs). [Report v4](docs/review/07-architecture-review-report-v4-FINAL.md).

**Round 6 remediation (2026-07-14):** C-A + C-B fixed at source (doc06); H-6/7/8 propagated into canonical docs 04/06/07/08; anchors fixed (ADR-0005, doc11 headings, #7-cross-cutting-concerns, #43); exactly-once→effectively-once (07/ADR-0013); `disclosure` field added to doc07; sub-1M cost floor disclosed in 03/05/09. **STRUCTURAL FIX: doc-consistency lint** (banned terms · dangling anchors · ADR-status drift) added as CI fitness function ([04 §10](docs/04-system-architecture.md) + [10 §2](docs/10-deployment-architecture.md)) and RUN — catches the propagation-failure class mechanically. Validation: anchor-lint clean, links PASS, 68 Mermaid, C-B composite verified. **CORRECTION (R6 review caught this): my banned-terms lint had an over-broad exemption (exempted any line mentioning 'dedup'), so it falsely reported PASS while two unqualified `exactly-once` survived at doc06:402/893 — the "banned-terms PASS" claim was inaccurate. Fixed in R6 close-out + lint tightened.**

**Round 6 review (2026-07-14, 12 auditors): CONDITIONAL-GO.** Gates Arch 96 ✅ · Sec 95 ✅ · Scale 96 ✅ · Maint 89 ❌ · Doc 91 ❌. **Design certified sound; no fund-loss exploit found.** C-A + C-B verified fixed at source. 2 doc-fidelity Criticals: doc06 exactly-once (lint false-negative) + stale ADR-INDEX-lineage. [Report v5](docs/review/08-architecture-review-report-v5-FINAL.md). Chair ruling: **"P0 authorized the instant these 2 Criticals close AND the lint re-runs green."**

**Round 6 close-out (2026-07-14):** doc06:402/893 exactly-once→effectively-once; H-6/7 propagated to docs 04/07/08 (closes the residual High); ADR-INDEX-lineage updated through R6; false "banned-terms PASS" retracted; lint exemption tightened + re-run.

## ✅ FINAL CERTIFICATION — UNCONDITIONAL GO (Round 7, 2026-07-14)

**All five gates cleared on source-verified evidence · zero open Criticals.**

| Dimension | Final | Gate | |
|-----------|-------|------|---|
| Architecture | **96** | ≥95 | ✅ |
| Security | **96** | ≥95 | ✅ |
| Scalability | **96** | ≥95 | ✅ |
| Maintainability | **96** | ≥95 | ✅ |
| Documentation | **98** | ≥98 | ✅ |

**Final Risk Score 12** (from 432) · **Architecture Readiness 96** · **Production Readiness 90** · **0 open Criticals** (12 auditors/red-teams found no new Critical). Design certified sound, no fund-loss exploit. Report: [09-FINAL-CERTIFICATION](docs/review/09-FINAL-CERTIFICATION.md). **Phase-0 documentation is production-ratified; P0 implementation is AUTHORIZED.** 10 non-blocking Highs (pre-code operational validation: load-test execution, surge test, hardened-runtime rollout, GL divergence-SLI, etc.) tracked into P0.

**P0 build decomposition adopted (Founder, 2026-07-14):** implementation P0 split into **P0.1 Infra · P0.2 Core Platform · P0.3 Commerce · P0.4 Money Integrity 🔒 · P0.5 AI · P0.6 Observability · P0.7 Security · P0.8 Performance**, each with a measurable exit gate. Formalized in [13 — Implementation Roadmap](docs/13-implementation-roadmap.md) mapped to certified ADRs. CTO refinements: Observability + Security-scanning are **cross-cutting from P0.1** (not late phases); P0.4 "zero money mismatch" made measurable (recon gap=0, no unconfirmed payable, reversal-ordering test). Lint GREEN (14 docs).

**P0.1 Infrastructure Foundation — SCAFFOLD DELIVERED (2026-07-14).** Monorepo scaffolded (204 files) by 5 role-teams: root spine (workspace/CODEOWNERS/gitignore + runnable doc-lint & mermaid & verify & bootstrap scripts); Terraform 8 modules + region-stack + global + 3 envs (all `terraform validate` ✅, fmt-clean); CI (`ci.yml` 18 jobs fail-closed OIDC-only cosign+SBOM+SLSA) + `cd-prod.yml` (manual approval); K8s `nexus-common` library chart + Kustomize + ArgoCD + OTel/Prom/Grafana/Loki/Tempo (separate failure domain); `platform-hello` Go canary (/healthz //readyz //metrics + OTel, distroless); apps/services/packages intent-only scaffolds (ZERO business logic). Report: [PHASE-P0.1-REPORT.md](PHASE-P0.1-REPORT.md). Lint GREEN, architecture unchanged.

**P0.1 Engineering Specs authored (2026-07-14):** [docs/engineering/](docs/engineering/00-README.md) — E1 Engineering Spec & Production Blueprint (771 ln), E2 Acceptance Test Spec & DoD (502 ln, 34 tests), E3 P0.2–P0.8 Roadmap (328 ln), E4 Master Execution Prompt (233 ln). "Engineering Spec" + "Production Blueprint" merged (same thing at P0.1) per CTO consolidation. Lint GREEN (52 files), 78 Mermaid valid.

**P0.1 Installation & Operations Manual authored (2026-07-14):** [docs/engineering/ops/](docs/engineering/ops/00-README.md) — 9 chapters, ~3,635 lines, from empty AWS account + empty GitHub org to a verified exit gate. Ch1 GitHub Org · Ch2 AWS Foundation · Ch3 Terraform Bootstrap · Ch4 Networking · Ch5 Kubernetes · Ch6 Observability · Ch7 CI/CD · Ch8 Exit-Gate Validation (sign-off). Every procedural step has all 8 fields (Objective·Prerequisites·Commands·Expected·Verification·Rollback·Common-failure·Troubleshooting). CTO sequencing fix: Bootstrap before Networking. Lint GREEN (61 files, 85 Mermaid).

**P0.1 Execution Checklist + Chaos Day added (2026-07-14):** ops [Ch9 Execution Checklist](docs/engineering/ops/09-execution-checklist.md) (Stage A GitHub · B AWS · C Terraform destroy→apply idempotency · D CI/CD, tick-box + exit evidence) + [Ch10 Chaos Day](docs/engineering/ops/10-chaos-day.md) (5 experiments: node kill · pod delete · service restart · NAT failure · IAM revoke — hypothesis/steady-state/inject/recover/verify/abort each). Ops manual now 11 chapters / ~3790 lines. Lint GREEN (63 files). **These are USER-executed (no cloud creds here); AI-DOS co-pilots on pasted evidence.**

**Evidence Policy adopted (2026-07-14):** binding — a `PASS` requires an objective artifact (CLI/plan/Actions-log/AWS-CLI/kubectl/screenshot/CloudTrail/Prometheus/Grafana/scan); no artifact ⇒ `NOT VERIFIED`; never infer. Encoded in ops [00-README](docs/engineering/ops/00-README.md) + authoritative [Ch11 Verification Ledger](docs/engineering/ops/11-verification-ledger.md).

**Governance (2026-07-14, Founder-directed → [ADR-0023](docs/adr/ADR-0023-doc-freeze-and-approval-gate.md)):** (1) **Documentation FREEZE** — docs/ changes only for Evidence · Bug-fix · ADR · execution-learning. No new speculative docs. (2) **4-approval implementation-complete gate** — Engineering Lead + Security Lead + Platform Lead + Founder, each MUST cite objective evidence (else void). Ch8 sign-off updated. **OPEN founder decision: domain/brand** (part of P0.1 per founder; but branding = ADR-0002 deferred → founder to ratify brand domain OR authorize a staging/ops placeholder domain so P0.1 ingress/TLS/external-dns isn't blocked).

**Founder decisions (2026-07-14):** (1) **Domain = staging/ops/preview placeholder** (staging.<yourdomain>.com etc.) — NOT a final brand domain; brand-swap later = DNS/Ingress/Cert only ([ADR-0002](docs/adr/ADR-0002-branding.md) updated). (2) `NEXUS` NOT locked as final brand — a **Brand Discovery Phase** (trademark · domain · SEO · social · pronunciation · legal) gates any Final-Brand ADR. (3) **Working rule "Evidence Before Opinion"** (per Founder, NOT a new doc — logged here): architecture/security review→evidence; performance→benchmark; cost→measurement; scalability→load-test; reliability→chaos-test. Unprovable claims stay **Roadmap/Assumption, never Fact.** Complements [ADR-0023](docs/adr/ADR-0023-doc-freeze-and-approval-gate.md) + the Evidence Policy. (4) **Execution cadence: one-evidence → one-verification → one-ledger-entry** (not 50 steps at once). **Today = Stage A GitHub only.**

> **CURRENT STATE (2026-07-14):** P0.1 code+specs+ops-manual (12 ch incl. ledger) complete & lint-green (65 files). **Docs FROZEN.** **P0.1 EXIT GATE = 🔴 NOT VERIFIED (0/44 PASS)** — awaiting the user's live execution evidence (GitHub → AWS → Terraform). AI-DOS co-pilots: user pastes evidence → ledger row flips PASS/FAIL. No new docs (freeze). **P0.2 BLOCKED until ledger all-PASS + 4-approval Ch8 sign-off.** **P0.1 EXIT GATE = 🔴 NOT VERIFIED — 0/44 items PASS** (no live evidence submitted yet; DoD-5/6 are PASS-candidates on the re-runnable in-repo lint, all else NOT VERIFIED). AI-DOS cannot execute (no cloud creds) — user runs stages, pastes evidence, AI-DOS flips ledger rows PASS/FAIL. **P0.2 BLOCKED until ledger all-PASS + Ch8 sign-off.** **The P0.1 exit gate is now executable** by the user in their GitHub+AWS via the manual; it must be **objectively verified (Ch8 sign-off, evidence attached)** before P0.2. **STOPPED at P0.1 — awaiting the user's exit-gate execution or explicit approval to proceed.** Execution-dependent DoD (apply-idempotency, live CI pass, rollback drill) **require the user's GitHub org + AWS** — wired to pass, NOT executed here (honestly reported). **STOPPED before P0.2 per STOP CONDITION. Awaiting explicit approval to proceed.** — both named Criticals (doc06 exactly-once; stale lineage) closed & verified at source, and the **doc-consistency lint re-runs GREEN over the full docs tree** (anchors/banned-terms/links all PASS; C-A four-state + C-B composite verified). Residual High (H-6/7 propagation) also closed into 04/07/08. Design **certified sound, no fund-loss exploit**.
>
> **Honest gate position:** R6 *formal* scores were Arch 96 ✅ · Sec 95 ✅ · Scale 96 ✅ · Maint 89 · Doc 91 — Maint & Doc were **capped by the two now-closed Criticals**. Per the chair's ruling P0 is authorized on the objective condition (now met). A formal **Round-7 re-score** is the only thing between CONDITIONAL-GO and an unconditional GO on the strict ≥95/≥98 criteria — awaiting user decision. **No score inflation: I am NOT asserting Maint≥95/Doc≥98 as certified until a re-score confirms it.**
>
> **Non-blocking Highs to track into P0:** load-test execution (H-3, unexecutable pre-code), flash-sale surge test (P2), connector hardened-runtime rollout validation, GL divergence-SLI (H-5).

> **CURRENT STATE (2026-07-20) — Stage A EXECUTED LIVE (AI-DOS via user's authenticated `gh`):** Org `nexus-commerce-os` (id 306595611). Repo `nexus-commerce-os/nexus-commerce-os` created + **276-file P0.1 scaffold pushed** (main `ee0cedd`; secret-scanned clean). **Stage A ledger 9/10 PASS:** A1 org, A2 repo, A3 branch-protection (neg-tested: direct push rejected), A4 ruleset `main-protection` (id 19182359), A5 CODEOWNERS (10 teams `@nexus-commerce-os/*` + PR#1 auto-requested sre+devsecops), A6 required-signatures (neg-tested), A7 required-reviews (1+code-owner, PR#1 BLOCKED@0), A8 required-check `ci-gate` (neg-tested), A10 environments (staging auto + production gated wait_timer=10/reviewer). **A9 OIDC deferred → Stage B (needs AWS role).** **Evidence:** `stage-a-evidence.txt` (repo root, local) + live CLI transcripts. **KEY DECISION (Founder-approved in-session):** GitHub free plan blocks branch-protection/rulesets on *private* repos (403) → **repo made PUBLIC** to enable controls at zero cost (no secrets committed; verified). To return private later, org must move to **GitHub Team**. **Overall gate 11/44 PASS; Stages B/C/D + Ch8 4-approval still pending. P0.2 remains BLOCKED.** How: authenticated via `gh auth login` (device flow, user); AI-DOS then drove all repo config from the Bash tool on the user's machine (git in Bash PATH; PowerShell lacked git — non-blocking).

> **CURRENT STATE (2026-07-20) — PREMIUM REVIEW + REMEDIATION (T1–T7 done, LOCAL, not yet pushed):** Ran an end-to-end 17-agent adversarial review (score **72/100**; docs 80-88 world-class, app/CI/OSS-presentation 57-68). Then remediated in 7 tranches, each verified: **T1** OSS/presentation baseline (LICENSE=proprietary-source-available, SECURITY/CONTRIBUTING/CoC/PR+issue templates, dependabot, .nvmrc, .editorconfig); **T2** buildability — the #1 finding "CI can never go green" FIXED: generated `pnpm-lock.yaml` (corepack+npm-global pnpm 9.7.0), `tsconfig.base.json`+9 per-workspace tsconfigs, unified `eslint.config.mjs` (ESLint9 flat), prettier scope, `.env.example` → verified `typecheck 9/9 · lint 9/9 · test 3/3 · format ✅ · frozen-lockfile ✅`; **T3** CI/CD security — cd-prod command-injection closed (inputs→env, quoted "$VAR", digest regex-validated), `.semgrep/` ruleset (unblocks sast gate), smoke fail-open→fail-closed, honest CodeQL-Go comment; **T4** terraform — dev-EKS `endpoint_public_access=false` (0.0.0.0/0 exposure closed) + compute precondition guard + versions lock-claim honest + cache dead-var removed, all `terraform fmt` clean; **T5** consistency — 77 team-refs `@nexus/*`→`@nexus-commerce-os/*` (npm-scopes untouched — no overlap), ops/01 ORG fixed, ADR-0023 registered in index+mermaid, 22→23 ADR strings, ADR-0002 status; **T6** observability — tail-sampling single-owner invariant documented + metrics double-count killed (serviceMonitor default off + scrape annotations gated on `not otel.enabled`); **T7** README overhaul (badges+OSS-links+module phrasing) + doc polish (mermaid typo, 5 mislabeled Vision citations, watchlist_autobuy→watchlist_one_tap_alert L-01 fix, ClickHouse Decimal disclaimer, §A1→§10.1 anchor, §10.3/10.4 physical reorder). **Gates green throughout: doc-consistency lint PASS (65 files), mermaid PASS (85 diagrams).** Total **82 files** (57 mod + 25 new). **Toolchains installed this session (portable, no admin): AWS CLI 2.36.2, terraform 1.9.8, pnpm 9.7.0, Go NOT installed.** **DEFERRED (need Go/terraform-validate/opa to verify — won't add unverified blocking jobs): Go/Python CI test-job, CodeQL-go/gosec, OPA policy extensions, EBS-CSI IRSA, CloudWatch-CMK, Aurora random_id snapshot, .terraform.lock.hcl generation, ADR-0003/4/5 status, docs/history relocation.** **BLOCKER TO PUSH: branch-protection solo-merge deadlock** — main requires PR + code-owner approval (can't self-approve) + signed commits; needs Founder decision (bypass-actor / 2nd reviewer / approvals=0). All 82 files sit local until resolved.

## Numbering disambiguation (avoid conflation)

Two independent numbering schemes exist and **do not correspond**:
- **Document numbers** `01–10` = the deliverables in `/docs` (this is what all cross-references use).
- **Org-layer numbers** `01–13` = the agent org chart (Executive…Business) in [Vision §9](docs/01-vision.md#9-the-operating-model-how-ai-dos-builds-this).

E.g. "layer 06 Backend" ≠ "document 06 Database". **All cross-references in docs use document numbers only.**
