# RentFlow — Handoff Brief

## 1. What this is

Bangla-first rent & bill admin for a single Bangladesh property (multi-room mess/basha): meter-based utility splitting, tenant & lease management, a loan sub-module, income/expense tracking. This package is the design-approved visual system plus one responsive HTML per screen — implement the product from it. **Treat the HTML as a design canvas, not production code** (no backend; demo JS is presentation-only).

Suggested stack (recommendation only — Salim decides): Cloudflare Workers + D1 + R2, SvelteKit v2 / Svelte 5 / Tailwind v4, Hono, Bun. Not locked.

## 2. How to view

- Open `design-output/index.html` — the hub lists every screen and component.
- One file per screen: `design-output/screens/NN-*.html`.
- Resize the browser to 390 / 768 / 1024 / 1280 — there are **no separate breakpoint files**.
- Print screens (04, 21, 22): Ctrl+P, **Margins: None**.

## 3. File map

```
RentFlow/
├── design-output/
│   ├── index.html          hub
│   ├── screens/            01 … 33 — one responsive HTML per screen
│   ├── components/         brand · bottom-nav · sidebar · button · input ·
│   │                       kpi-card · sheet · status-chip · empty-state
│   └── assets/             empty (placeholder); icons are inline SVG
├── design-system/          tokens.css + README.md (Tailwind @theme mapping)
└── handoff/README.md       this file
```

Screens link tokens via `../../design-system/tokens.css` (relative from `screens/`).

## 4. Design system — preserve

- **Semantic tokens only** (`--color-primary`, `--color-ink`, `--space-lg`, `--radius-card`, …). Never hardcode hex, except the print cut line `1.5px dashed #bbb` on 04.
- **Palette (Paper & Ink):** paper `#FAF6F0` · ink `#1B2432` · saffron `#DF9C35` · success `#2E7D5B` · warning `#C08A2E` · danger `#C2402F` · info/loan `#1F6F78` · hairline `#E7DFD2`.
- **Font:** Noto Sans Bengali 400/500/600/700. No Inter, no Poppins.
- **Buttons:** saffron solid primary + ink outline secondary, 5 states. Focus ring is global in tokens.
- **Cards:** flat raised surface + hairline, `--radius-card`, no card shadow. Shadows only for overlays/sheets/raised home.
- **Status chips:** tint + 1.5px dot. Paid=green · partial=amber · due=amber · overdue=vermillion · loan=teal.
- **Icons:** inline stroke SVG, stroke-width 1.8, `currentColor`. No emoji, no icon font.
- **Copy:** Bangla UI text; Bengali display numerals (৳১২,৫০০), ASCII form inputs; ৳ currency.
- **Tailwind v4:** `bg-(--color-primary)` shorthand; fall back to `bg-[var(--color-primary)]`.
- **Real app:** map tokens into `@theme` (see design-system/README.md). Don't fork a second palette.

## 5. Shell / nav contract (must implement)

**Bottom nav** order: বিল | রেন্টি | হোম | সারাংশ | আরও

- বিল → `17-bill-preview` · রেন্টি → `09-tenant-list` · হোম → `02-dashboard` (raised 56px saffron circle, shadow-float) · সারাংশ → `22-monthly-summary-ledger` · আরও → `29-settings-hub`
- `lg:hidden`. Centered `max-w-md`, and `md:max-w-3xl` so the bar matches the tablet content column instead of floating as a phone-width island. Active tab = saffron-tint pill.

**Sidebar** `lg+`, 264px. Content `lg:pl-[264px]`.

- ড্যাশবোর্ড 02 · বিল ও মিটার 03 · রেন্টি 09 · সারাংশ 22 · লোন 23 · ফিনান্স 26 · সেটিংস 29
- Active = saffron-tint pill.

**No-nav screens:** 01, 05, 06, 07, 08, 04, 20, 21, 33 (auth / onboarding / print / success).

## 6. Responsive recipe

Content wrapper inside the sidebar-offset div:

```
mx-auto w-full max-w-md pb-32 md:max-w-3xl lg:max-w-6xl lg:px-8 lg:pb-16 xl:max-w-7xl
```

Dashboard chart + due list: stack until `xl`, then 2+1. Do not crush names at tablet.

## 7. Sheet / modal recipe (copy exactly)

Phone = bottom sheet. md+ = vertically centered card. Panel class (one line):

```
fixed inset-x-0 bottom-0 z-50 mx-auto hidden w-full max-w-md rounded-t-(--radius-card) bg-(--color-surface-raised) px-6 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 shadow-(--shadow-overlay) md:inset-0 md:my-auto md:h-fit md:max-h-[90vh] md:overflow-y-auto md:rounded-(--radius-card) md:pb-6
```

- Handle pill: `md:hidden`. Scrim: `fixed inset-0 z-40 hidden bg-(--color-ink)/50`.
- **Never use `md:bottom-auto`** — it pins the sheet to the top.
- Used on: 11, 13, 14, 15, 17, 18, 19, 25, 26, 29, 30, 32.

## 8. Key flows

- **Auth:** 01 ↔ 05 ↔ 06. Login (01) is mobile number + password only. OTP is required on signup (05), forgot password (06), and password change on profile (32); without OTP those cannot be confirmed. Login error is an annotated variant on 01, not the default card.
- **Onboarding:** 07 (language → property → 6 rooms + rates 7.5 / 200) → 08 → 02. Mid-month move-in rent uses the property setting, default day-wise; onboarding shows the rule, it is not a per-tenant quiz.
- **Monthly cycle:** 03 meter → 17 review → 04 print the monthly papers (and/or 21 reprint one lost slip) → during the month, 19 collection → 20 payment recorded in the ledger only. 17 still links 18. Next month, leftover due comes from the ledger; if nothing is leftover that line is absent. Print happens before collection, not after. 33 is off the happy path — 17 goes straight to 04. Keep 33 only as an optional “papers ready, print now” beat; it must not send the owner to collect.
- **Tenants:** 09 → 10 add / 11 profile → 12 edit · 13 shift · 14 move-out → 15 archive → 16 history. 09 chip প্রাক্তন ৩ → 15. Active tenant delete is blocked (must move-out).
- **Loan:** 23 list → 24 add → 25 detail. Toggle "মাসিক বিলে যোগ" default on. Cancel loan → confirm → 23.
- **Finance:** 26 list → 27 add, 28 cashflow. আরও tab, not a 5th primary.
- **Settings:** 29 hub → 30 rooms, 31 property+rates, 32 profile. Logout confirm → 01. Multi-property tile disabled.
- **Summary:** 22 landscape print ledger.

## 9. Canonical demo data (seed this)

- **Owner:** রফিকুল ইসলাম / রফিক ভাই. Phone ০১৭১১-২৩৪৫৬৭.
- **Property:** আবাসিক ভবন — মিরপুর-১০, ৪৪/২ শাহ আলী বাগ, মিরপুর-১০, ঢাকা-১২১৬.
- **Rooms:** ১০২–১০৭. ১০৬ vacant.
- **Tenants:** ১০২ রাহাত ৳৯,০০০ · ১০৩ সাব্বির ৳৯,৫০০ · ১০৪ তানভীর ৳১০,০০০ · ১০৫ মেহেদী ৳৮,৫০০ · ১০৭ নাফিসা ৳১০,৫০০.
- **Rates:** বিদ্যুৎ ৳৭.৫/unit, ওয়েস্ট ৳২০০/room/month. **Month:** আগস্ট ২০২৬.
- **Water split rule:** used units ÷ (occupied rooms + 1).
- **Loan:** নাফিসা ৳৫,০০০, 5×৳১,০০০, 2 paid, ৳৩,০০০ left, add-to-bill ON.
- **Bill engine total:** ৳৫৭,৯৯৮. **Ledger paid:** ৳৪২,২০০. **Expense:** ৳৯,৪০০. **Net:** ৳৪৮,৫৯৮.
- **নাফিসা August bill:** ৳১৩,২৭৫ (includes ৳১,০০০ loan). 04 নাফিসা receipt total ৳১৩,৮০০ (utility differs — see debts).
- **Dashboard home snapshot** (approved, do not "fix" without Tutul): বকেয়া ৳৫২,৮০০ / আদায় ৳৪২,২০০ / ব্যয় ৳৯,৪০০ / খালি ১/৬. Due-list preview rows রাহাত ৪,২০০ / সাব্বির ২,৫০০ / মেহেদী ৪,৯০০ are indicative.

## 10. Calc engine notes (for Salim)

HTML JS on 03/18/24/25 is demo only. The real engine must:

- Per-room elec: current − previous, reject negative.
- Water: building current − previous; share = units ÷ (occupied + 1). Occupied rooms only — vacant rooms are excluded from the water split.
- Bill line: rent + (elec + waterShare) × 7.5 + waste 200 + adjustments + prev due + optional loan installment.
- Vacant rooms (demo: ১০৬) get no waste bill, no water share, and no auto electricity. Manual adjustment only if someone used a vacant room.
- After papers are calculated, shift previous ← current readings.
- A wrong month entry is corrected in place. Update the ledger wherever the numbers break. Do not regenerate bills as the correction path. Extra paper is a manual print of 04 or 21, not a regenerate.
- Print-first: at month start the owner calculates last month, prints one set of papers, and gives them to every occupied-room tenant. Tenants pay from that paper. The owner may tick “পেয়েছি” by hand on the paper. In the app he only records what came in. The ledger stores that. Next month leftover due is added; if nothing is leftover that line is absent.
- No new receipt on every payment. Screen 20 must not offer a payment receipt. Screen 21 is a reprint of one tenant’s monthly paper (lost slip), not payment proof. Loan installments have no separate receipt — track in the app, or fold into the monthly paper when “মাসিক বিলে যোগ” is on.
- Each monthly paper has a unique reference number.
- Rent for a mid-month move-in uses the property setting, default day-wise.
- Move-out: due vs advance → refund / hold / adjust; archive 2 years.
- Do not invent a different water-split rule without Tutul.
- Do not silently “fix” the known demo number debts in §13.

## 11. Print

- **04:** Monthly papers for tenants, printed **before** collection. A4 portrait, margin 0, 2×3 = 6 slips, dashed `#bbb` cut, `.no-print` toolbar. Unique reference on each slip. Blank hand-collection fields (signature). Property name/address/phone in **each** slip header. Signature: আদায়কারী only (right). Do not change 6 slips to 8.
- **21:** Reprint of one tenant’s monthly paper (lost slip), not a payment receipt. Thermal-ish single slip, A4 print view. Entry from 17, not from 20.
- **22:** A4 landscape, margin 10mm, hide chrome, sticky first column on screen.
- Browser design tools cannot reliably preview `@media print` — test in a real browser.

## 12. Accessibility / i18n

- `lang="bn"`. Visible labels.
- Sheets: `role=dialog`, `aria-modal`, scrim click + cancel.
- Switches: `role=switch` + `aria-checked`.
- Focus-visible ring from tokens.
- Safe-area on bottom nav and sheets.
- Windows `<select>` option hover may stay OS-blue — documented limit.

## 13. Known debts (do not silently "correct")

1. **04 receipt # on room ১০৬ shows শামীম** (approved print sample). Product story: ১০৬ is vacant; শামীম is in archive (15).
2. **17 room ১০২ utility ৳১,৬৭৩ (223×7.5) vs 04/21 ৳২,২০০.** Keep both until Tutul picks a source of truth.
3. **Dashboard বকেয়া ৳৫২,৮০০ ≠ engine ৳৫৭,৯৯৮.** Intentional snapshot vs cycle total.
4. **Annotated empty/loading/error blocks** on several screens are design variants on the SAME page, not live states. Implement as real states; don't ship the annotation labels ("— লোডিং / loading —") to production.
5. **Native select styling on Windows is imperfect.**

## 14. What developers should watch

- Monthly click order is print-then-collect: 03 → 17 → 04 (print) → later 19 → 20. Do not implement 17 → 33 → 19 → 20 → 21 as the happy path.
- Do not add a payment-receipt button on 20. Do not treat 21 as proof of payment.
- Do not regenerate all bills as the correction path; 18 updates the ledger in place.
- Vacant rooms get no waste, no water share, and no auto electricity.
- Do not add a second typeface, or a cool-gray / terracotta restyle.
- Do not build separate mobile/desktop apps from duplicated HTML.
- Do not put বিল tab on 03, or আরও tab on 26.
- Auth implementation, authorization, D1 schema, meter persistence, print PDF vs browser print, and stack choice = engineering decisions — flag for Salim.
- Tenant portal is future. Multi-property is future (keep the settings slot).

## 15. Screen index

Grouped by flow (number = filename `NN-*.html`):

- **Auth:** 01 login (password only) · 05 signup (OTP) · 06 forgot password (OTP)
- **Onboarding:** 07 setup (language → property → rooms/rates) · 08 success
- **Home:** 02 dashboard
- **Monthly cycle:** 03 meter entry · 17 bill preview · 04 monthly paper grid (print, before collection) · 21 reprint one paper · 19 collection due · 20 payment success (ledger only) · 18 manual adjustment · 33 papers ready (optional, not on the happy path)
- **Tenants:** 09 list · 10 add · 11 profile · 12 edit · 13 shift room · 14 move out · 15 vacated archive · 16 history
- **Loan:** 23 list · 24 add · 25 detail
- **Finance:** 26 income/expense list · 27 add · 28 cashflow summary
- **Summary:** 22 monthly ledger (landscape print)
- **Settings:** 29 hub · 30 rooms · 31 property · 32 profile (password change requires OTP)
