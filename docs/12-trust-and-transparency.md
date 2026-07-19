# 12 — Trust & Transparency

**Status:** 🟢 Draft-complete (R4-remediated) · **Owner:** CEO + Legal + Product · **Depends on:** [ADR-0021](adr/ADR-0021-legal-product-truth.md), [11 Product Guidelines](11-product-guidelines.md)

---

> This document is the basis of NEXUS's **public** Trust & Transparency commitments. It states, in plain language, what users can rely on — and how each commitment is *enforced*, not just promised. Internal enforcement mechanisms are linked for auditability.

## 1. Our promise

**NEXUS works for the buyer.** We make money when you save money and buy through us — never by steering you to whoever pays us most. Everything below is engineered, tested, and auditable, not marketing.

## 2. Commission-Blind Recommendations (D5)

- **Your ranking is decided by value to you, not by our commission.** Commission amount **never** raises a product's rank.
- This is **enforced in code**: the ranking pipeline cannot read monetization signals, and a **CI neutrality test** fails the build if varying a merchant's commission changes the neutral order ([04 §5.3 / §10](04-system-architecture.md#53-neutrality-enforcement), [ADR-0020](adr/ADR-0020-performance-consistency-hardening.md)).
- **Recommendation logic is auditable** — we can demonstrate that ranking is commission-blind.

## 3. Honest disclosure (D1)

- We **clearly disclose** that we may earn an affiliate commission wherever affiliate links appear.
- Our **AI agent tells you** before it sends you to a merchant that the purchase may earn us a commission — and that it never affects the recommendation.
- Disclosure is **identical across Web, Mobile, API, and AI**.

## 4. Sponsored vs. organic (D5)

- **Sponsored placements are always clearly labeled** and visually distinct from organic recommendations, on every surface.
- Sponsored content **cannot** reorder your neutral results — it occupies clearly-marked slots only.

## 5. Honest savings (D4)

- We show savings in four honest states — **Estimated → Pending → Confirmed → Reversed** — and always explain which and why.
- We **never** present estimated or pending savings as guaranteed.
- Our headline **"Verified Money Saved" counts only *Confirmed* savings** — money you actually kept.

## 6. Legitimate data only

- All product, price, and review data comes from **authorized APIs, licensed feeds, and affiliate networks** — never unauthorized scraping ([ADR-0001](adr/ADR-0001-data-sourcing.md)). This protects you and the merchants.

## 7. Privacy & your data

- We minimize what we collect, store it in your region, and let you inspect and erase it ([08 Security §9](08-security-architecture.md), [ADR-0016](adr/ADR-0016-region-residency-lifecycle.md)).
- Personalization does **not** require surveillance; we do not sell your personal data.

## 8. We never touch your payment

- NEXUS is a **referral** service: you pay the **merchant** directly on their own checkout. **We never see your card details, hold your funds, or take custody of your order** ([ADR-0006](adr/ADR-0006-referral-only-model.md)).

## 9. Travel

- We present flights, hotels, and other travel as **independent options you book directly with the provider** — we are not a package organizer (D2).

## 10. How to hold us to this

- These commitments are backed by **CI fitness tests**, **independent attribution reconciliation** ([ADR-0011](adr/ADR-0011-attribution-reconciliation.md)), a **price-claim accuracy audit** (≥99%, NFR-COMP-01), and **published, auditable** ranking neutrality. Where a commitment is gated by law (e.g., cashback per jurisdiction), we say so.

---
*Related: [11 — Product Guidelines](11-product-guidelines.md) · [ADR-0021](adr/ADR-0021-legal-product-truth.md) · [Vision §8 Guiding principles](01-vision.md#8-guiding-principles)*
