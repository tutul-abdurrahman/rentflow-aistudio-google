# RentFlow — Design Output

Sample set of design screens for RentFlow (Bangla-first, mobile-first property & rent
management web app). These are **visual design deliverables** — clean HTML/CSS used as a
design canvas. There is no real backend, no forms, no app logic.

Full package: 33 screens (01–33), components, and the design system — see
`../handoff/README.md` for the developer handoff brief.

## How to view

- Open `index.html` in a browser — it links every screen and component snippet.
- Each screen is standalone; you can open any file directly.
- **Mobile-first rule:** every screen is designed for a ~390px phone and centers its
  content at `max-w-md`. Resize the browser wider to see tablet/desktop naturally —
  there are no separate desktop/mobile copies.
- The receipt screen is print-first: use the **প্রিন্ট** button (or Ctrl/Cmd+P) to see
  the A4 output with dashed cut lines.

## Token rule (single source of truth)

- All colors, spacing, radius, shadows, motion and type come from
  `design-system/tokens.css`.
- Screens link it via a relative path: `<link rel="stylesheet" href="../../design-system/tokens.css">`.
- **Never duplicate the token block and never hardcode hex/spacing/radius values** in a
  screen or component file. The only hardcoded values allowed are structural (e.g. the
  print-only dashed cut borders `1.5px dashed #bbb` on the receipt sheet).
- Light visual tweaks belong in the tokens file, not in screens.

## Conventions

- **Bangla-first:** all user-facing copy is natural, professional Bengali.
- **Money:** ৳ + Bengali numerals (০১২৩৪৫৬৭৮৯), e.g. `৳১২,৫০০`.
- **Typography:** Noto Sans Bengali (Google Fonts) via `var(--font-sans)`; body font set
  in each screen head.
- **Bottom nav:** 5 tabs — বিল · রেন্টি · হোম (center, raised) · সারাংশ · আরও.
  Fixed, centered at `max-w-md`, top hairline, safe-area padding. Active
  non-home tab = saffron icon + label inside a saffron-tint pill. The center
  হোম tab is a raised circle with two states: **inactive** (raised paper
  circle, 2px `--color-border-strong` border, ink house, faint label — every
  screen except the dashboard) and **active** (raised saffron circle +
  `ring-4 ring-(--color-primary-tint)` + semibold label — dashboard only).
  Hidden at `lg:` where the sidebar takes over (see
  Conventions (v2) below). Standalone flows (login, print) have no bottom nav.
- **Buttons:** saffron solid primary with ink text; ink outline secondary. 5 states
  (default / hover / focus / active / disabled). Focus ring is global in tokens.css.
- **Cards:** flat white (`--color-surface-raised`), hairline border
  (`--color-border`), `rounded-(--radius-card)`, `p-(--space-lg)`. **No card shadows.**
- **Shadows** are reserved for overlays / bottom sheets / FAB only.
- **Status colors:** পরিশোধিত=green, আংশিক=amber, বাকি=amber+ink, অতিরিক্ত বকেয়া=vermillion,
  লোন=teal — always as tint chip + dot.
- **Icons:** small consistent inline stroke SVGs (24px, `stroke="currentColor"`,
  stroke-width ~1.8). **No emoji.**

## Tooling

Tailwind CSS v4 via browser CDN. Design tokens are referenced with the CSS-variable
shorthand, e.g. `bg-(--color-primary)`, `text-(--color-ink)`, `p-(--space-lg)`,
`rounded-(--radius-card)`. If a utility does not compile, fall back to the arbitrary form
`bg-[var(--color-primary)]`.

## Folder map

```
design-output/
├── components/   reusable component snippets (canonical patterns for future screens)
├── screens/      one responsive HTML per screen
├── assets/       static images go here (placeholder README.txt)
├── index.html    navigation hub
└── README.md     this file
```

## Conventions (v2)

Latest shared-shell patterns — apply these to every new screen.

- **Natural Bangla copy:** short, direct, everyday spoken Bangla — never stiff or
  literal translations. Bad: "আপনার অ্যাকাউন্টে প্রবেশ করতে তথ্য দিন". Good:
  "মোবাইল নম্বর আর পাসওয়ার্ড দিন".
- **Brand mark:** the canonical RentFlow logo is the home-icon mark — a saffron
  solid circle with an ink house outline inside, next to the "RentFlow" wordmark.
  Canonical snippet lives in `components/brand.html`; reuse it for the sidebar and
  auth screens (login/signup).
- **Bottom nav:** center-raised হোম; order বিল | রেন্টি | হোম | সারাংশ | আরও.
  Fixed at bottom, centered at `max-w-md`, hidden at `lg:` where the sidebar
  shows instead. States: active non-home tab = saffron-tint pill behind the
  icon + `font-semibold` label + `aria-current="page"`; inactive tabs =
  faint icon + label. হোম inactive = raised paper circle, 2px
  `--color-border-strong`, ink house, faint label. হোম active (dashboard
  only) = raised saffron circle + `ring-4 ring-(--color-primary-tint)` +
  semibold label.
- **Page gutter:** the mobile x-padding lives on `main` only — canonical
  `mx-auto w-full px-5 pb-32 md:max-w-3xl lg:max-w-6xl lg:px-8 lg:pb-16
  xl:max-w-7xl`. Do **not** also put `px-4` on headers or sections that sit
  directly in main (keep `px-4` inside cards).
- **Desktop / sidebar:** the admin sidebar (`components/sidebar.html`) shows at
  `lg:`+ and the bottom nav hides; the content area clears it with
  `lg:pl-[264px]`. One responsive file per screen — no separate desktop copies.
- **Print:** A4 portrait with `margin: 0`. If default browser margins appear in
  the print dialog, set **Margins: None**.
