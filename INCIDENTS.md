# Incidents

Every defect that reached, or would have reached, a real user gets an entry here — recorded whether
or not anyone outside the team noticed. A bug nobody reported is not a bug that did not happen; it
is a bug whose detection failed too.

---

## INC-0001 — The primary call-to-action button could not be clicked

| Field | Value |
| --- | --- |
| **Date found** | 2026-08-02 |
| **Severity** | High — the site's single conversion path was dead |
| **Status** | Fixed and verified in production |
| **Fix** | [`eda243c`](.) — `fix(ui): CTA glow was swallowing every click in the block` |

**1. Summary.** `.cta-final::after`, a decorative radial-gradient glow, was `position: absolute` with
`inset: 0` and no `pointer-events` rule. It therefore hit-tested above everything inside the final
call-to-action block, including the waitlist submit button.

**2. Impact.** Clicking **"Join the waitlist →"** did nothing at all. The waitlist was the only
conversion on the marketing surface, so the site's entire funnel ended in a button that silently
ignored the visitor. No error appeared, on screen or in the console.

**3. Why it stayed hidden.** Pressing <kbd>Enter</kbd> in the email field still submitted the form,
because that path never goes through the button. Anyone testing by typing and hitting Enter — the
natural way to test a single-field form — would have seen it work perfectly.

**4. Detection.** Found by accident while verifying the Cloudflare deployment: an automated click on
the button produced no network request. `document.elementFromPoint()` at the button's own centre
returned the parent `<div>`, not the button.

**5. Root cause.** Every sibling inside `.cta-final` carries `position: relative` to lift it above
the glow. That raises them *visually* but does not remove the glow from hit-testing: the pseudo-
element is positioned and paints last, so it stays on top for pointer events regardless.

**6. Fix.** Added `pointer-events: none` to `.cta-final::after`.

**7. Verification.** Rebuilt, redeployed, and re-checked against the live Worker:
`elementFromPoint` at the button centre now returns `BUTTON`; a real click produces
`POST /api/waitlist 200`, and the success state renders.

**8. Related defects checked.** Audited every full-bleed pseudo-element in the stylesheet. Three
others matched the shape; two were false positives and were left alone —
`.nav-links a.active::after` is a 2px underline *inside* its anchor, so clicks still reach the link,
and `.receipt::after` is a zig-zag edge below a card with no interactive children. `.hero::before`
already had `pointer-events: none`, which is what made the omission on `.cta-final` an oversight
rather than a pattern.

**9. Prevention.** The reusable lesson: **a decorative overlay must always declare
`pointer-events: none`.** Lifting siblings with `position: relative` is not a substitute — it fixes
appearance and leaves interaction broken. Worth a lint rule if this recurs; one occurrence does not
yet justify one.

**10. Process note.** This shipped through a UI polish pass that included an accessibility and
interaction review. Those reviews read computed styles and the accessibility tree, neither of which
reveals a hit-testing problem. **Verifying that a control is reachable requires actually clicking
it** — nothing cheaper substitutes.
