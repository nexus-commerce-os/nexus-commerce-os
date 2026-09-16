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

---

## INC-0002 — The CTA's secondary button was invisible in dark mode

| Field | Value |
| --- | --- |
| **Date found** | 2026-08-05 |
| **Severity** | Medium — one of two calls to action was unreadable for dark-theme visitors |
| **Status** | Fixed; verified by measurement in both themes |
| **Fix** | `fix(ui): ghost button follows the CTA band's own text token` (this commit) |

**1. Summary.** `.cta-final .btn-ghost` set `color: #e9efea`, a hardcoded near-white. The band it
sits in is `background: var(--ink); color: var(--paper)`, which **inverts with the theme**. In dark
mode `--ink` is `#e9efea` — so the button's text became exactly its own background colour.

**2. Impact.** In dark mode the secondary button ("Read the method", "Back to home", "Read how we
rank") rendered as text at **1.00:1** — invisible. Only its border hinted that anything was there,
and that border was `rgba(255,255,255,0.28)`: white on a near-white band, so almost invisible too.
It affected every page carrying the final CTA band.

**3. Why it stayed hidden.** It was introduced *as a fix for the same bug on the other theme*. The
original defect was the ghost button being near-black on the always-dark band in light mode; the
repair replaced one theme-dependent token with a constant, which by construction can only be right
in one theme. The verification that accepted it only looked at light mode.

**4. Detection.** A contrast sweep across both themes during the `/verified-savings` build returned
`btn-ghost 1:1` in dark. That reading was initially assumed to be a probe artefact — two earlier
readings in the same sweep genuinely were — so it was checked directly: the computed colour and the
band's computed background were both `rgb(233,239,234)`.

**5. Root cause.** A hardcoded colour used to solve a problem whose cause was theme inversion. The
band advertises its own correct foreground in `color: var(--paper)`; the fix ignored that and
substituted a literal.

**6. Fix.** `color: var(--paper)`, with the border as `color-mix(in oklab, var(--paper) 28%,
transparent)`. The button now derives from the same token as the band's own text, so it inverts with
it automatically.

**7. Verification.** Measured with real sRGB compositing in both themes across 87 text elements on
the page: dark mode has **no element below AAA**; the ghost button specifically moved from 1.00:1 to
passing. Light mode is unchanged.

**8. Related defects checked.** Audited every hardcoded light colour scoped to a themed surface.
`.demo-panel` and its children (`.dp-sub`, `.ex-*`) are also hardcoded, but correctly so: that panel
sets a **fixed gradient** background that does not invert, so fixed foregrounds are right there. The
distinction is whether the surface's own background is theme-dependent — `.cta-final` was the only
place where it is and the foreground was not.

**9. Prevention.** The reusable lesson: **when a surface derives its background from a theme token,
everything drawn on it must derive from a theme token too.** A literal colour on an inverting
surface is a bug in whichever theme was not being looked at.

**10. Process note.** Both this defect and INC-0001 were introduced or missed by a review that
checked one state and generalised. The cheap corrective is not more review but **wider sampling**:
this sweep only found it because it ran the same measurement over both themes rather than the one
that happened to be on screen.
