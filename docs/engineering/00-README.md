# Engineering Specifications

Formal engineering specs for the **implementation** of NEXUS, derived from the certified architecture ([../00-README.md](../00-README.md)) and the [Implementation Roadmap (P0.1–P0.8)](../13-implementation-roadmap.md). These documents specify *how* to build; the `docs/01–13` set (certified, frozen) specifies *what* and *why*.

| # | Document | Purpose |
|---|----------|---------|
| E1 | [P0.1 Engineering Specification & Production Blueprint](E1-P0.1-engineering-spec.md) | The authoritative build spec: monorepo, Git strategy, branch protection, CODEOWNERS, CI/CD, Terraform, Kubernetes, security, observability |
| E2 | [P0.1 Acceptance Test Specification & Definition of Done](E2-P0.1-acceptance-tests.md) | Concrete, testable acceptance criteria per component + the formal DoD + exit-gate evidence checklist |
| E3 | [P0.2–P0.8 Engineering Roadmap](E3-P0.2-P0.8-roadmap.md) | Detailed per-sub-phase engineering plan, sequencing, and exit gates from Core Platform through Performance |
| E4 | [P0.1 Master Execution Prompt](E4-P0.1-master-prompt.md) | The complete, reusable execution spec for building/rebuilding P0.1 |

**Conventions:** RFC-2119 keywords; every claim traces to a certified doc or ADR; the [doc-consistency lint](../04-system-architecture.md#10-fitness-functions-how-we-keep-it-healthy) guards these too (they are inside `docs/`).
