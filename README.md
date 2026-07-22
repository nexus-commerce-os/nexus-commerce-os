# NEXUS Commerce OS — Monorepo

[![License](https://img.shields.io/badge/license-Proprietary%20(source--available)-blue)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-3c873a)](.nvmrc)
[![pnpm](https://img.shields.io/badge/pnpm-%E2%89%A59-f69220)](package.json)
[![Phase](https://img.shields.io/badge/phase-P0.1%20infrastructure-informational)](docs/13-implementation-roadmap.md)
[![Docs](https://img.shields.io/badge/docs-certified%20%26%20frozen-success)](docs/00-README.md)

> **Phase-0 documentation is certified [UNCONDITIONAL GO](docs/review/09-FINAL-CERTIFICATION.md).** This repository holds the **P0.1 Infrastructure Foundation** scaffold — platform foundation only (no business/commerce/AI/referral logic yet). Build plan: [docs/13 — Implementation Roadmap](docs/13-implementation-roadmap.md).

## What this is

A production-grade **monorepo** for NEXUS, an AI shopping super-platform built as a **pure referral + affiliate** intelligence layer ([ADR-0006](docs/adr/ADR-0006-referral-only-model.md)). The full architecture (13 docs, 23 ADRs) lives in [`/docs`](docs/00-README.md) and is **certified and frozen** — code conforms to it; it is not changed by code work.

## Layout

| Path | Purpose |
|------|---------|
| [`/apps`](apps/) | User-facing apps — `web` (Next.js PWA), `admin` |
| [`/services`](services/) | Backend services — `auth`, `catalog`, `affiliate`, `ai`, `search`, `analytics` (+ `platform-hello`, the P0.1 walking-skeleton service) |
| [`/packages`](packages/) | Shared libs — `ui`, `sdk`, `shared`, `config` |
| [`/infrastructure`](infrastructure/) | `terraform` (8 primitive modules + a `region-stack` composition), `kubernetes`, `github`, `monitoring`, `security` |
| [`/docs`](docs/00-README.md) | Certified architecture docs + ADRs + review artifacts (frozen) |
| [`/scripts`](scripts/) | Repeatable automation (bootstrap, verify, lint) |
| [`/tests`](tests/) | `smoke`, `policy` (OPA/conftest) |

## Non-negotiables (from the certified architecture)

- **Secrets never in Git.** OIDC to the cloud; no static credentials.
- **Every artifact signed + SBOM'd** (SLSA-aware). Unsigned images MUST NOT run.
- **Observability + security scanning are built-in from the first commit** — not later phases ([docs/13 §cross-cutting](docs/13-implementation-roadmap.md)).
- **Every change has a tested rollback.** CI enforces it (`Rollback PROVEN` gate).
- **Doc-consistency lint** blocks ADR↔doc drift ([04 §10](docs/04-system-architecture.md#10-fitness-functions-how-we-keep-it-healthy)).
- **Terraform is modular** — never one giant project. Eight primitive modules, composed per environment by the `region-stack`.

## Governance

Every directory carries a `README.md` (**purpose · ownership · dependencies**) and ownership is enforced by [`.github/CODEOWNERS`](.github/CODEOWNERS) (teams `@nexus-commerce-os/*`). Every GitHub Action documents *why it exists*; every Terraform module ships a design doc.

## Getting started (P0.1)

Prerequisites: **Node ≥ 20** ([`.nvmrc`](.nvmrc)), **pnpm ≥ 9**, **Terraform ≥ 1.7**, Docker, kubectl, Helm.

```bash
pnpm install                  # workspace deps (uses the committed pnpm-lock.yaml)
pnpm -w run lint              # eslint across all TS workspaces
pnpm -w run typecheck         # tsc --noEmit
pnpm -w run test              # unit tests
python scripts/doc_consistency_lint.py   # docs must stay consistent
scripts/verify.sh             # the local gate subset (fmt, lint, doc-lint, mermaid, tf validate)
```

> **P0.1 exit gate:** infrastructure deploys automatically, idempotently; CI green; rollback tested. See [`infrastructure/README.md`](infrastructure/README.md) and the P0.1 delivery report.

## Contributing, security & license

- **Contributing:** [`CONTRIBUTING.md`](CONTRIBUTING.md) — PR flow, signed commits, the docs-frozen / ADR rule, and the `ci-gate`.
- **Security:** [`SECURITY.md`](SECURITY.md) — **report vulnerabilities privately** (never a public issue).
- **Conduct:** [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — Contributor Covenant.
- **License:** [`LICENSE`](LICENSE) — **proprietary, source-available**. Public for transparency and review; it is **not** open-source and grants no usage rights. Licensing enquiries via the maintainers.

## Status

`P0.1 Infrastructure Foundation` — scaffold. **STOP after P0.1 exit gate; do not begin P0.2 without explicit approval.**
