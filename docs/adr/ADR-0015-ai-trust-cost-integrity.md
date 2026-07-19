# ADR-0015 — AI trust & cost integrity (grounding never sacrificed to the cost cap)

**Status:** Accepted (remediation, Review R1, WS-C) · **Date:** 2026-07-14 · **Deciders:** CTO, AI Architect, FinOps
**Closes:** R-006, R-007, R-011, R-048, R-049, R-050, R-052, R-053, R-054, R-055, R-056, R-057, R-081.

## Context
The ≤$0.01 cost ceiling ([ADR-0009](ADR-0009-ai-cost-strategy.md)) and its soft-degrade could cut the **grounding / claim-verification** that makes NEXUS trustworthy; "cheapest-capable routing" predicts quality *before* generation (confidence ≠ correctness); and price verification was itself an LLM over an untrusted corpus.

## Decision
1. **Grounding is a protected budget line** (R-006, R-050): claim-verification + guardrail passes are **carved out of** the $0.01 cap and **summed into** the true blended cost; cost-degrade **MUST NOT** disable grounding — it degrades reasoning depth, never truth-checking.
2. **Deterministic price/fact verification** (R-007, R-049): the *price number* a user sees is verified by **deterministic code** against the authorized-feed value at intent ([SDD §8](../02-software-design-document.md) Tier-3), **not** by an LLM. The LLM may phrase; it may not assert an unverified price.
3. **Grounded ≠ true** (R-048): authorized sources can be wrong/fraudulent → cross-source corroboration + anomaly flags on outlier prices before display.
4. **Model-drift canaries** (R-011, R-056): a fixed golden-eval canary runs continuously against every third-party model version; silent drift trips an alert and can auto-pin the prior model. Rollback "seconds" claim is backed by this real detector.
5. **Escalation re-scans** (R-055): mid-cascade escalation to another model **re-runs** the injection/safety scan on the new model — one-time scans don't carry across models.
6. **Eval coverage is stratified** (R-054): eval sets are stratified by (tier × provider × class × locale) with minimum sample power per cell; gates report power, not just pass-rate.
7. **Cost-degrade path is quality-gated** (R-057): the cheaper degrade path passes the **same** quality/eval gate as the primary — never an ungated fallback.
8. **Review corpus freshness** (R-052): a `review.*` event stream invalidates/refreshes the RAG review corpus so revoked/edited reviews aren't served.
9. **Claim-span detection** (R-053): "re-verify claims on cache hit" is backed by a concrete claim-span extractor; price/fact spans are re-grounded, non-claim text reused.

## Backward compatibility / Migration / Rollback
- **Compat:** additive to the AI Gateway; no external contract change.
- **Migration:** introduce the protected budget line + canary harness before enabling cost-degrade in prod.
- **Rollback:** each control is flag-guarded; disabling reverts to [ADR-0009](ADR-0009-ai-cost-strategy.md) behavior (with the logged risk it reopens). Deterministic price verify is **not** rollback-eligible (safety-critical).

## Affected docs
[05](../05-ai-architecture.md) (§2.4, §2.5, §4.3, §8, §9), [09 §9.1](../09-cloud-architecture.md) (budget line), [10](../10-deployment-architecture.md) (eval gate).
