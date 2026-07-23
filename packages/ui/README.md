# packages/ui — React design-system primitives

**Status:** 🟢 In use (10 primitives; consumed by `apps/web`)
**Owner:** `@nexus-commerce-os/frontend` `@nexus-commerce-os/platform` (per [`.github/CODEOWNERS`](../../.github/CODEOWNERS) `/packages/`)
**Runtime / language:** TypeScript + React (consumed by `apps/web`, `apps/admin`)
**Certified-architecture component:** shared presentation primitives for the Client tier ([04 §3](../../docs/04-system-architecture.md#3-context--container-map-c4-level-2))
**Governing ADRs:** [ADR-0010](../../docs/adr/ADR-0010-platform-principles.md) (replaceability) · NFR-A11Y-01 (WCAG 2.2 AA)

## Purpose

The shared React component library for all NEXUS apps. Presentation only — **no data
fetching, no business logic.**

## Design approach — headless-with-global-tokens

Primitives render the platform's **global CSS classes** (`.btn`, `.card`, `.sec-head`, …);
the **consuming app owns the token/CSS layer** (see [`apps/web/src/app/globals.css`](../../apps/web/src/app/globals.css),
which defines the `:root` tokens, light/dark themes, and those classes). This keeps the
components tiny and un-opinionated about styling, and keeps one source of truth for the
look. A component that needs a variant accepts an optional `className` that is appended.

## Usage

```tsx
import { Button, SectionHead, Card, StatePill } from "@nexus/ui";

<SectionHead eyebrow="The model" title="A referral layer, not a checkout.">
  It does one thing extremely well.
</SectionHead>
<Button href="#cta">Join the waitlist →</Button>
<Button variant="ghost" onClick={fn}>Cancel</Button>
```

`apps/web` consumes it via a workspace dependency (`"@nexus/ui": "workspace:*"`); because
the package ships raw TS (`main: src/index.ts`), the app declares
`transpilePackages: ["@nexus/ui"]` in `next.config.mjs`.

## Primitives

| Component | Renders | Key props |
|-----------|---------|-----------|
| **`Button`** | `.btn .btn-{variant}` (`<a>` if `href`, else `<button>`) | `variant?: "primary"\|"ghost"` · `href?` · `type?` · `disabled?` · `onClick?` |
| **`Eyebrow`** | `.eyebrow` label `<p>` | `className?` |
| **`SectionHead`** | `.sec-head` (Eyebrow + `<h2>` + optional lede) | `eyebrow` · `title` · `children?` (lede) |
| **`Card`** | `.card` surface `<div>` | `className?` · `style?` |
| **`StatePill`** | `.st .{est\|pend\|conf\|rev}` `<span>` | `state: SavingsState` (`estimated\|pending\|confirmed\|reversed`) |
| **`Receipt`** | `.receipt` (header, rows, total, stamp, footer) | `title` · `code?` · `rows: ReceiptRow[]` · `totalLabel` · `totalValue` · `stamp?` · `footer?` · `ariaLabel?` |
| **`Step`** | `.step` (`STEP {index}` + title + body) | `index` · `title` · `children` · `className?` |
| **`FeatureCard`** | `.promise` (icon + title + body) | `icon` · `title` · `children` · `className?` |
| **`MetricStat`** | `.metric` (value + caption) | `value` · `label` · `className?` |
| **`PhaseTag`** | `.phase[.live]` chip | `code` · `live?` · `children` |

`SavingsState` maps to the four ratified savings states ([11 §2](../../docs/11-product-guidelines.md) · [ADR-0021](../../docs/adr/ADR-0021-legal-product-truth.md) D4).

## Dependencies

- Peer: `react`, `react-dom` (provided by consuming apps)
- Dev: `@types/react` (types for the primitives)

## Conventions

- Type-only React imports (`import type { ReactNode } from "react"`) — the package
  builds with the automatic JSX runtime (`jsx: "react-jsx"`).
- Every component is presentational and side-effect-free (imperative behaviour like the
  receipt count-up lives in the consuming page, targeting the rendered classes/refs).
- Accessible-by-default (WCAG 2.2 AA, NFR-A11Y-01): semantic elements, `aria-*` passed
  through where relevant.
