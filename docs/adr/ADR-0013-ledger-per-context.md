# ADR-0013 — Ledger-per-context + asynchronous reconciliation GL

**Status:** Accepted (remediation, Review R1) · **Date:** 2026-07-14 · **Deciders:** CTO, Database Architect, CFO
**Closes:** R-004 (Ledger shared-kernel SPOF), R-034 (ledger seq/ordering not portable), R-035 (outbox→Kafka relay gap), R-069 (single PDP / money invariant not dual-enforced).

## Context

The design routed **four money domains** — affiliate accrual, cashback, rewards, creator payouts — through **one global double-entry Ledger** while calling them independent bounded contexts. A single global double-entry ledger cannot be an independently-consistent context: it is a **shared kernel** and a systemic SPOF. A creator-payout change could corrupt cashback invariants, and the Ledger could never be extracted without a distributed transaction across four domains.

## Decision

1. **Ledger-per-context.** Each money domain owns an **append-only accrual sub-ledger** with its invariant scoped to that domain. Domains never write each other's ledgers.
2. **Reconciliation General-Ledger (GL) service.** A dedicated GL **asynchronously** aggregates the sub-ledgers into the audited, double-entry, hash-chained financial view. The strong double-entry invariant is enforced *within* each sub-ledger; the GL provides eventually-consistent consolidated reporting.
3. **Money invariant dual-enforced in code** (fixes R-069): balance-changing operations are checked by **both** the domain service **and** an independent invariant-checker (belt-and-braces), so a single PDP bug cannot silently break a money invariant. The PDP itself runs HA (no authorization SPOF).
4. **Durable event relay** (fixes R-035): the outbox→Kafka relay uses a **transactional outbox with at-least-once delivery + dedup-on-event-id (effectively-once) semantics** and survives Postgres failover — money events are never lost in the relay gap.
5. **Portable ordering** (fixes R-034): sub-ledger ordering uses a **per-account monotonic sequence** (not a global sequence), which survives the future Postgres→distributed-SQL migration ([06](../06-database-architecture.md)) without a global-ordering assumption.

## Options considered
| Option | Verdict |
|--------|---------|
| One global Ledger (original) | ❌ shared-kernel SPOF; unextractable; cross-domain corruption risk |
| **Ledger-per-context + async reconciliation GL** | ✅ chosen |
| One Ledger declared a named shared-kernel exception via ADR | 🟡 fallback if per-context reconciliation latency proves unacceptable for reporting |

## Consequences
- **+** Each money domain is independently consistent, deployable, and extractable; blast radius contained.
- **+** Migration-safe ordering; no global-sequence lock-in.
- **−** Consolidated financial reporting is **eventually consistent** (reconciliation latency) — acceptable for reporting, not for per-domain authorization (which stays strong).
- **−** More components (sub-ledgers + GL) to operate.

## Rollback
The GL is additive over sub-ledgers; if per-context proves worse, fall back to the single-ledger shared-kernel *exception* (documented) without losing sub-ledger data.

## Affected docs
[02 §3](../02-software-design-document.md), [04 §4/§5.4](../04-system-architecture.md), [06 §3.6/§3.8/§8](../06-database-architecture.md), [08 §8](../08-security-architecture.md).
