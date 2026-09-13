# Artifact 4 — Secret Inventory

**Names only. No values, ever.**

This file exists so the operator knows what to obtain and where each item comes from. It contains no
credential values, and none may be added to it — not as an example, not redacted, not "temporarily".

> **Handling rule.** Every value below is entered by the operator **directly into the secret store**.
> Values must never appear in: chat, tickets, source control, documentation, screenshots, log output,
> error messages, or test fixtures.

---

## 1. Impact

Credential names follow the vendor's own documented terminology (HTTP Basic: Account SID as username,
Auth Token as password).

| Name | Kind | Source |
| --- | --- | --- |
| `IMPACT_ACCOUNT_SID` | Identifier | Impact platform → User profile → Settings → Technical → API |
| `IMPACT_AUTH_TOKEN` | **Secret** | Same screen — "Create Access Token" |
| `IMPACT_API_BASE_URL` | Configuration | Documented API host |
| `IMPACT_API_VERSION` | Configuration | Reference version in use (public reference is v16) |
| `IMPACT_PROGRAM_ID` | Identifier | The approved program used for tracking-link generation |
| `IMPACT_CATALOG_ID` | Identifier | The catalog the slice reads |
| `IMPACT_MEDIA_PARTNER_PROPERTY_ID` | Identifier | Property the tracking link is attributed to |

## 2. CJ Affiliate

| Name | Kind | Source |
| --- | --- | --- |
| `CJ_PERSONAL_ACCESS_TOKEN` | **Secret** | CJ developer portal, authenticated |
| `CJ_PUBLISHER_ID` | Identifier | CJ account |
| `CJ_API_BASE_URL` | Configuration | Documented API host |

`UNKNOWN` whether CJ requires further identifiers (website id, property id). The portal is not
publicly retrievable — see artifact 1 §1. This list is provisional and completed in step 5.

## 3. Provider-neutral

Already declared in §3 of the readiness check; repeated so the inventory is complete in one place.

| Name | Kind | Purpose |
| --- | --- | --- |
| `COMMERCE_PROVIDER` | Configuration | Active connector — `impact` \| `cj` |
| `COMMERCE_PROVIDER_CACHE_TTL_MAX_S` | Configuration | Contractual cache cap → `license_tag.cache_ttl_max_s` |
| `COMMERCE_MERCHANT_ALLOWLIST` | Configuration | Approved merchant domains for the signed hand-off |

## 4. Classification

| Kind | Handling |
| --- | --- |
| **Secret** | Secret store only. Never logged, never echoed in errors, never in a test fixture |
| Identifier | Not secret, but account-specific — treat as configuration, keep out of the repo |
| Configuration | Non-sensitive; may carry a documented default once verified |

**Two names are secrets: `IMPACT_AUTH_TOKEN` and `CJ_PERSONAL_ACCESS_TOKEN`.** CJ's own
documentation states tokens must never be placed "in publically accessible places, such as in
client-side code or public code repositories."

## 5. Boot-time validation (design note, not implementation)

Following the pattern already proven in Identity: when a connector is enabled, its required names are
validated at boot and the service **refuses to start** if any is missing — rather than failing at the
first shopper request. **No such code is authorized yet**; this records the intended behaviour so the
inventory and the eventual implementation cannot drift.
