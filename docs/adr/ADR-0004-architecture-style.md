# ADR-0004 — Modular monolith first, strangler to services

**Status:** Proposed · **Date:** 2026-07-13 · **Deciders:** CTO, Enterprise/Solution Architect

## Context

NEXUS must ship a trustworthy core loop quickly (Vision H1) yet scale search, AI, price intelligence, and feed ingestion independently under heavy load (NFR-SCAL-01/02, NFR-PERF-01/03). The two classic extremes — microservices-from-day-1 and a single undifferentiated monolith — each fail one of these goals.

## Decision

Build the **transactional core as a modular monolith** (bounded contexts as strictly-separated modules: no shared tables, communication via typed interfaces + domain events, CI-enforced boundaries). **Extract only the latency-critical / independently-scaling concerns as services from day one**: Search, Price Intelligence, AI Serving/Agent, Feed Ingestion, Travel. Evolve further via the **strangler-fig** pattern when metrics justify extraction.

## Options considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| Microservices day 1 | Independent scale/deploy | Distributed-systems tax pre-PMF; slow velocity; costly | ❌ |
| Pure monolith | Max velocity | Can't scale search/AI independently; coupling risk | ❌ |
| **Modular monolith + strategic services** | Velocity **and** targeted scale; clean extraction seams | Requires boundary discipline | ✅ |

## Consequences

- **+** Fast delivery of the core loop; independent scaling where it matters; low ops surface early.
- **+** Extraction is mechanical (boundaries already enforced) → low-risk evolution.
- **−** Requires ongoing discipline (mitigate: CI arch-fitness tests, module ownership, boundary tests — [System Architecture §10](../04-system-architecture.md)).
- **−** Three backend languages (TS/Go/Python) — bounded deliberately, each to a clear domain.

## Related
[System Architecture §2](../04-system-architecture.md), [SDD §6](../02-software-design-document.md).
