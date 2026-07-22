# Contributing to NEXUS Commerce OS

Thanks for your interest. This repository is **source-available but proprietary**
(see [LICENSE](LICENSE)); contributions are welcome under the terms below.

> **Before you start:** the architecture documentation in [`/docs`](docs/00-README.md)
> (13 docs + 23 ADRs) is **certified and frozen** ([ADR-0023](docs/adr/ADR-0023-doc-freeze-and-approval-gate.md)).
> Code conforms to the docs; it does not silently change them. A change that
> alters an architectural decision requires a **new or superseding ADR**, not an
> edit buried in a code PR.

## Ground rules

- **Every change goes through a Pull Request.** Direct pushes to `main` are
  blocked by branch protection.
- **Commits must be signed** (verified signatures are required on `main`). See
  [GitHub commit signing](https://docs.github.com/authentication/managing-commit-signature-verification).
- **A code-owner review is required.** [CODEOWNERS](.github/CODEOWNERS) routes
  each path to its owning team automatically.
- **`ci-gate` must be green.** The aggregate status check gates every merge; it
  runs lint, typecheck, build, tests, SAST, secret-scan, dependency-scan, SBOM,
  signing, and the doc-consistency lint — all fail-closed.

## Commit convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <summary>

<body — the "why", not just the "what">
```

`type` ∈ `feat | fix | docs | chore | refactor | test | perf | ci | build | security`.
Reference the relevant ADR or doc where applicable (e.g. `feat(affiliate): ... (ADR-0008)`).

## Local development

Prerequisites: **Node ≥ 20** (see [`.nvmrc`](.nvmrc)), **pnpm ≥ 9**, **Go ≥ 1.22**,
**Terraform ≥ 1.7**.

```bash
pnpm install                 # install workspace deps (uses the committed lockfile)
pnpm -w run lint             # lint all workspaces
pnpm -w run typecheck        # type-check
pnpm -w run build            # build
python scripts/doc_consistency_lint.py   # docs must stay consistent
```

Run the same checks CI runs before opening a PR — `ci-gate` will not pass
otherwise.

## Pull request checklist

The [PR template](.github/PULL_REQUEST_TEMPLATE.md) is your checklist. In short:

- [ ] Linked to an ADR/doc (or explains why none is needed).
- [ ] Signed commits; Conventional Commit messages.
- [ ] `ci-gate` green; doc-consistency lint green.
- [ ] Security impact considered (secrets, IAM, exposure).
- [ ] Tests added/updated where behavior changed.

## Reporting bugs & security issues

- Functional bugs → [open a Bug report](https://github.com/nexus-commerce-os/nexus-commerce-os/issues/new/choose).
- Security vulnerabilities → **do not** open a public issue; follow
  [SECURITY.md](SECURITY.md).

## Code of Conduct

Participation is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).
