# P0.3 Provider Access Preparation

**Status:** 🔴 `BLOCKED ON PROVIDER APPROVAL` · **Prepared:** 2026-08-01

Everything required so that connector implementation can begin **immediately** after an affiliate
account is approved — and nothing that presumes one exists.

> **No connector code. No adapter. No mock provider. No scraped data.** These are documentation
> artifacts. `services/affiliate` remains the P0.1 scaffold, unmodified.

---

## Artifacts

| # | Artifact | Purpose |
| --- | --- | --- |
| 1 | [Provider Comparison Matrix](PROVIDER-COMPARISON-MATRIX.md) | Impact vs CJ across 24 attributes, from official documentation only |
| 2 | [Provider Capability Matrix](PROVIDER-CAPABILITY-MATRIX.md) | Design requirements marked SUPPORTED / PARTIAL / UNSUPPORTED / UNKNOWN |
| 3 | [Integration Readiness Checklist](INTEGRATION-READINESS-CHECKLIST.md) | 13 items, none ticked without evidence |
| 4 | [Secret Inventory](SECRET-INVENTORY.md) | Credential **names** only |
| 5 | [Environment Template](.env.provider.example) | Blank values, no invented defaults |
| 6 | [Data Mapping Template](DATA-MAPPING-TEMPLATE.md) | Empty; filled from real data in step 5 |
| 7 | [Acceptance Tests](ACCEPTANCE-TESTS-P0.3.md) | AT-P03-01…20, all `NOT EXECUTED` |
| 8 | [Risk Register](RISK-REGISTER.md) | 12 external risks; no mitigation uses fake data |
| 9 | [Readiness Report](READINESS-REPORT.md) | Status determination with evidence |

Related: [P0.3 Provider Readiness Check](../P0.3-PROVIDER-READINESS-CHECK.md) ·
[P0.3 Thin-Slice Design](../DESIGN-P0.3-COMMERCE-THIN-SLICE.md)

## Position in the authorized sequence

Steps 1–4 are the founder's. This directory is the engineering preparation that makes **step 5**
fast, and step 5 is the only thing that can turn `BLOCKED` into `READY`.

| Step | Owner | State |
| --- | --- | --- |
| 1. Apply to Impact | Founder | ⬜ |
| 2. Await approval | Founder | ⬜ |
| 3. Collect documentation | Founder | ⬜ |
| 4. Hand over documentation | Founder | ⬜ |
| 5. Readiness verification | Engineering | ⬜ Prepared, awaiting real data |
| 6. Connector implementation | Engineering | ⬜ Not authorized |

## The one thing not to misread — Ruling 3

**Impact is not preferred because it is better.** Impact's column is fuller than CJ's because Impact
publishes server-rendered documentation and CJ does not — `developers.cj.com` returned an
application shell on every public route tried. That is a difference in documentation access, not in
capability.

Impact becomes the preferred **first** implementation only because its official documentation is
objectively accessible, its API capability is evidence-backed, its required fields can be verified,
and engineering uncertainty is therefore lower. **No provider preference is permanent.** If CJ later
supplies equivalent evidence, the comparison is re-evaluated objectively.
