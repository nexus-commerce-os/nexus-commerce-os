# ADR-0018 — Connector sandboxing & security hardening

**Status:** Accepted (remediation, Review R1, WS-F) · **Date:** 2026-07-14 · **Deciders:** CTO, Security Architect, Red Team
**Closes:** R-016, R-017, R-055, R-065, R-066, R-067, R-068, R-070, R-071.

## Context
The connector plugin model put **credentialed third-party code in-process**; signed handoffs could be defeated by an affiliate **open redirect** (confused deputy); CI used **self-hosted runners with OIDC**; the merchant allow-list was **inherited unvetted** from 4 networks; anti-scraping targeted the REST tier not the **agent surface** (the moat); ATO could inherit standing mandates + change payout destination in one session; connector-**self-declared** capabilities drove compliance routing.

## Decision
1. **Connectors run out-of-process, sandboxed** (R-017): each connector is an isolated, least-privilege worker in a **hardened runtime (gVisor / Kata Containers / microVM), not ordinary namespaces** — it runs credentialed third-party code over hostile data, so a compromised/malicious connector cannot pivot into the platform (H-8).
2. **Open-redirect defense** (R-016): the final redirect target is validated against a **per-merchant canonical-destination allowlist**; affiliate wrapper URLs are resolved and the ultimate host checked; the agent can never emit an unvalidated redirect.
3. **CI runner hardening** (R-065): ephemeral, single-use runners in an isolated account; **short-lived OIDC with tight audience/branch conditions**; no persistent runner credentials; SLSA provenance on every artifact.
4. **Merchant allow-list vetting** (R-066): merchants inherited from networks pass a **NEXUS vetting pipeline** (reputation, fraud signals, TOS, category policy) before becoming handoff-eligible at catalog scale; unvetted = discoverable-but-not-recommended until vetted.
5. **Agent-surface anti-abuse** (R-067): bot/abuse defense covers the **conversational agent API** (the scraping target), not just REST — signed first-party workload identity for our own agent, anomaly/velocity on third-party agent access, per-scope caps.
6. **ATO containment** (R-068): high-risk actions (payout-destination change, standing-mandate creation) require **step-up re-auth** and a **cool-down**; changing payout destination **revokes** active standing mandates.
7. **Capabilities are NEXUS-verified, not trusted** (R-070): a connector's self-declared `capabilities()` (regions/compliance) is **verified** by NEXUS before it drives compliance/market routing; a connector cannot self-assert into a market.
8. **Secret rotation decoupled from contract cadence** (R-071): per-region × per-connector secrets rotate on a **security schedule**, independent of slow partner-contract cycles; rotation is automated (ESO + KMS).

## Backward compatibility / Migration / Rollback
- **Compat:** connector interface unchanged externally; the *hosting* becomes out-of-process (internal).
- **Migration:** move connectors to sandboxed workers one at a time behind the existing Gateway interface; add redirect-allowlist + vetting pipeline before P1 GA.
- **Rollback:** sandboxing/rotation are reversible ops changes; open-redirect validation and capability-verification are **safety-critical, not rollback-eligible**.

## Affected docs
[04 §6/§6.1](../04-system-architecture.md), [07 §9.1](../07-api-architecture.md), [08 §5.6/§6/§7](../08-security-architecture.md), [10 §2](../10-deployment-architecture.md), [ADR-0008](ADR-0008-affiliate-gateway.md).
