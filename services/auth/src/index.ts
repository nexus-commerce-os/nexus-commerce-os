// services/auth — Identity & Profile (NestJS/TS)
// P0.1 SCAFFOLD — intent declaration only. NO implementation.
//
// This module will (P0.2 — Core Platform) own:
//   • OIDC authentication + passkeys/MFA (NFR-SEC-02, docs/08 §3)
//   • RBAC + ABAC authorization
//   • User Service, Settings, consent, per-user agent spend policy
//   • tamper-evident audit logging of every privileged action
//
// Boundary rules (do NOT violate when implementing):
//   • owns its own DB schema under its own DB role (ADR-0020)
//   • reached only via typed interfaces + domain events (no cross-module DB access)
//
// Intentionally exports nothing: there is no auth logic in the scaffold.
export {};
