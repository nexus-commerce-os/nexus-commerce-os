# Artifact 6 — Data Mapping Template

**Empty by instruction.** Rows are added in step 5, from real provider data — never from a schema
page, and never from a field name that merely looks right.

---

## 1. Column definitions

| Column | What goes in it |
| --- | --- |
| **Provider Field** | The field name exactly as the provider returns it. Case-sensitive |
| **Normalized Field** | The NEXUS domain field it becomes |
| **Validation Rule** | What must hold for the value to be accepted. A record failing this is **rejected and counted**, never coerced |
| **Required?** | `REQUIRED` — offer is unusable without it · `OPTIONAL` — offer survives without it |
| **Unknown?** | `YES` if any part of the mapping is unverified against real data. A row with `YES` **may not be implemented** |

## 2. Mapping table

| Provider Field | Normalized Field | Validation Rule | Required? | Unknown? |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |
|  |  |  |  |  |

## 3. Rules for filling this in

1. **One row per field actually observed in real responses.** A field documented but never present
   in sampled data is recorded in the notes below as documented-but-absent — not as a mapping.
2. **No inferred semantics.** If it is not documented what a field means, the row's `Unknown?` is
   `YES` and it stays unimplemented. Guessing that `Manufacturer` means brand is exactly the failure
   this column exists to prevent.
3. **No derived mappings without an explicit rule.** Extracting a model name from a title string is a
   derivation, not a mapping; it requires its own approved rule and must be recorded as derived.
4. **Shipping gets no shortcut.** A mapping that turns an absent shipping field into `0` is
   prohibited by the ruling of 2026-08-01. Absent is `unknown`, and `unknown` is not rankable.
5. **Units and currency are part of validation**, not an afterthought — a price without a confirmed
   ISO 4217 currency fails.

## 4. Documented-but-unobserved fields

Filled during sampling. A field appearing here is a coverage finding, and a mandatory field landing
here triggers the §4a gate.

| Provider Field | Documented meaning | Observed in sample? | Consequence |
| --- | --- | --- | --- |
|  |  |  |  |
|  |  |  |  |
|  |  |  |  |
