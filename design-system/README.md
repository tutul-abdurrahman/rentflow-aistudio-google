# RentFlow — Design System Tokens

## What this is

`tokens.css` is the **single source of truth** for all RentFlow design tokens. It contains two clearly separated sections:

1. **PRIMITIVES** — raw core values (palette, spacing scale, type scale, radii, shadows, motion). These are purpose-agnostic building blocks.
2. **TOKENS (semantic)** — purpose-named values that reference primitives via `var()`. Screens must use only these names.

Theme: **"Paper & Ink"** — warm, human, clean financial tool. Warm off-white paper surfaces, deep ink typography, warm saffron/amber brand accent. Bangla-first UI (Noto Sans Bengali) with ৳ and Bengali numerals.

## How screens use it

Every screen HTML must link the tokens file and **never** duplicate token values:

```html
<link rel="stylesheet" href="design-system/tokens.css" />
```

Rules:

- Reference semantic tokens only (e.g. `var(--color-primary)`, `var(--space-md)`).
- Never copy the token block or hardcode hex/spacing values inside a screen file.
- If a screen needs a one-off value that isn't a token, prefer adding a semantic token over an inline value.

## Primitive vs Token rule

- **Light visual tweak** (tint, spacing, a shadow) → change the **semantic token** only. No other file changes.
- **Core change** (a new brand color, a new scale step, a different base font) → update the **primitive**, then update the tokens that reference it.

Keep the two sections in sync — a token must never point to a primitive that no longer exists.

## Tailwind v4 mapping (for the dev team)

When the real product moves to Tailwind v4, map these CSS variables into a `@theme` block. Example:

```css
@import 'tailwindcss';

@theme {
  /* Colors */
  --color-paper: var(--paper);
  --color-paper-soft: var(--paper-soft);
  --color-ink: var(--ink);
  --color-ink-muted: var(--ink-muted);
  --color-ink-faint: var(--ink-faint);
  --color-primary: var(--saffron);
  --color-primary-deep: var(--saffron-deep);
  --color-primary-tint: var(--saffron-tint);
  --color-success: var(--green);
  --color-warning: var(--amber);
  --color-danger: var(--vermillion);
  --color-info: var(--teal);
  --color-line: var(--line);
  --color-line-strong: var(--line-strong);

  /* Spacing (4/8 hybrid) */
  --spacing-3xs: var(--space-3xs);
  --spacing-2xs: var(--space-2xs);
  --spacing-xs: var(--space-xs);
  --spacing-sm: var(--space-sm);
  --spacing-md: var(--space-md);
  --spacing-lg: var(--space-lg);
  --spacing-xl: var(--space-xl);
  --spacing-2xl: var(--space-2xl);
  --spacing-3xl: var(--space-3xl);
  --spacing-4xl: var(--space-4xl);
  --spacing-5xl: var(--space-5xl);
  --spacing-6xl: var(--space-6xl);

  /* Radius */
  --radius-sm: var(--radius-sm);
  --radius-md: var(--radius-md);
  --radius-lg: var(--radius-lg);
  --radius-card: var(--radius-card);
  --radius-pill: var(--radius-pill);

  /* Font */
  --font-sans: var(--font-sans);
  --text-xs: var(--text-xs);
  --text-sm: var(--text-sm);
  --text-base: var(--text-base);
  --text-md: var(--text-md);
  --text-lg: var(--text-lg);
  --text-xl: var(--text-xl);
  --text-2xl: var(--text-2xl);
  --text-3xl: var(--text-3xl);
  --text-display: var(--text-display);
}
```

The token names are kept identical across both systems so mapping stays mechanical.

## Confirmed foundation summary

Locked in with Tutul — do not change without explicit confirmation:

- **Palette** — "Paper & Ink" + saffron: paper `#FAF6F0`, ink `#1B2432`, saffron `#DF9C35`; functional semantic green (paid) / amber (partial) / vermillion (overdue) / teal (loan-info), each with a paired tint.
- **Spacing** — 4/8 hybrid scale, 12 steps from 2px to 64px.
- **Radius** — mixed: card 16, input 10, button 8, pill 999.
- **Typography** — single family Noto Sans Bengali, base body 16px, Bengali numerals + ৳.
- **Elevation** — hybrid: flat cards with hairline borders; shadows reserved for overlays/floats only.
- **Motion** — moderate functional motion (fast/base/slow: 120/180/280ms, standard easing).
- **Buttons** — saffron solid primary / ink outline secondary, each with 5 states: default, hover, focus, active, disabled.
