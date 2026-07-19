// services/affiliate — Affiliate & Attribution + Referral/Deep-Link Handoff (NestJS/TS)
// P0.1 SCAFFOLD — intent declaration only. NO implementation.
//
// This module will own:
//   P0.3 — resolve best option, stamp attribution, build signed allow-listed deep-link,
//          redirect to merchant checkout. NO payment, NO custody (ADR-0006).
//   P0.4 — ingest async postbacks as PROVISIONAL non-payable accrual (ADR-0012);
//          purchase-fingerprint dedup; append-only affiliate-accrual sub-ledger (ADR-0013);
//          reversals order on NEXUS receipt sequence + signed reconciliation, never
//          network_event_at — a raw postback can never un-reverse (ADR-0022 NC-3).
//
// Safety invariants (do NOT violate when implementing):
//   • handoff targets are server-side allow-listed + neutrally ranked (no prompt-injected redirect)
//   • no `pending`/unreconciled accrual is ever payable
//
// Intentionally exports nothing: there is no referral/attribution/money logic in the scaffold.
export {};
