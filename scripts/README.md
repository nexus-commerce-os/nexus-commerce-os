# scripts/ — Repeatable automation

**Status:** Scaffold — governance README (scripts themselves are owned outside this scaffold's scope)
**Owner:** `@nexus-commerce-os/platform` (default owner per [`.github/CODEOWNERS`](../.github/CODEOWNERS))
**Runtime / language:** Bash + Python (developer tooling only — not shipped in any runtime image)
**Implemented by phase:** [P0.1](../docs/13-implementation-roadmap.md) (developer + CI ergonomics)

Deterministic, network-free automation for local dev and CI. Every script is idempotent and re-runnable.

| Script | Purpose |
|--------|---------|
| `bootstrap.sh` | Install toolchains + git hooks for a fresh checkout |
| `verify.sh` | Run the local gate subset (format, lint, doc-lint, mermaid, tf validate) |
| `doc_consistency_lint.py` | Enforce the [doc-consistency lint](../docs/04-system-architecture.md#10-fitness-functions-how-we-keep-it-healthy) (banned terms, dangling anchors, ADR-status drift) |
| `mermaid_validate.py` | Validate mermaid diagrams in `docs/` |

> These scripts already exist in the repo; this README documents the directory's purpose and ownership per the "every directory carries a README" governance rule. The scripts are **not** modified by this scaffold task.

## Scope guard

Scaffold task adds only this README. No script logic is added or changed.
