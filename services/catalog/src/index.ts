// services/catalog — Catalog & Offer (NestJS/TS)
// P0.1 SCAFFOLD — intent declaration only. NO implementation.
//
// This module will (P0.3 — Commerce Foundation) own:
//   • the canonical offer/product schema (money as integer minor-units, NFR-CONS-01)
//   • read-optimized catalog projections for Search + Price Intelligence (CQRS)
//   • consumption of authorized, license-tagged `offer.upserted` events (ADR-0001)
//
// Legitimacy boundary: offers enter ONLY via the authorized feed-ingestion adapter;
// no scraping, no provider SDK in the core module (ADR-0010).
//
// Intentionally exports nothing: there is no catalog logic in the scaffold.
export {};
