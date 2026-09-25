# RentFlow — Production Guide

Deployment, backup, maintenance, and what the AI Studio production pass should
do (stage by stage). The run guide lives in `README.md`.

## 1. Deploying

The app is a static Vite build + Supabase backend (Postgres, Auth, RLS).
Any static host works; Cloudflare Pages/Workers assets is the default choice.

1. `npm run build` — outputs `dist/`.
2. Host `dist/` and set the build-time env vars:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. In Supabase → Authentication → URL Configuration, add the production URL
   to Site URL / Redirect URLs (OTP email links point there).
4. First deploy after schema setup:

   ```bash
   node --env-file=.env scripts/apply-schema.mjs     # idempotent
   node --env-file=.env scripts/create-owner.mjs     # owner account
   npx tsx --env-file=.env scripts/seed-demo.mts     # §9 demo data (idempotent)
   node --env-file=.env scripts/verify-fks.mjs       # tenant FKs are RESTRICT
   ```

Persistence is live: the app talks to Supabase through the anon-key client in
`src/lib/supabase.ts` wrapped by `src/lib/repository/supabase.ts`. RLS scopes
every row to `owner_id = auth.uid()`, so the signed-in owner sees only their
data. The in-memory repository remains the fallback when env is absent.

`scripts/seed-demo.mts` re-seeds only when the owner has no property (it never
duplicates a live dataset). `scripts/verify-fks.mjs` confirms the tenant FKs on
bills / ledger_entries / loans are `ON DELETE RESTRICT`, so tenant deletion can
never orphan financial history.

The `service_role` key is needed only by those scripts (server-side). It must
never reach the browser bundle.

## 2. Data & backups

- Supabase free tier has no point-in-time recovery. Monthly (or after any
  heavy month-end), export the data: Supabase dashboard → Table Editor, or a
  `pg_dump` of the public schema.
- The important business data is `bills`, `ledger_entries`, `tenants`,
  `meter_readings`, `loans`, `finance_entries`, `adjustments`.
- All tables carry `owner_id` + RLS (`owner_id = auth.uid()`); no
  cross-owner access is possible.

## 3. Maintenance

- **Free tier pauses after ~1 week of inactivity.** Any login or dashboard
  visit counts as activity. A weekly login (or the owner's normal monthly
  usage) keeps the project awake. If it pauses: Supabase dashboard → Restore.
- **OTP emails**: the built-in SMTP allows ~2 emails/hour. Fine for a single
  owner. To raise the limit, configure custom SMTP (e.g. Resend) in
  Authentication → Emails.
- **Monthly routine** (the app enforces print-then-collect):
  1. ০৩ মিটার এন্ট্রি → ১৭ প্রিভিউ → ০৪ প্রিন্ট (collect later)
  2. During the month: ১৯ আদায় → ২০ লেজারে রেকর্ড
  3. Corrections: ১৮ সমন্বয় (in place — never regenerate bills)
  4. Next month's leftover due flows from the ledger automatically.

## 4. What the AI Studio pass should do (stages)

Tutul will point Google AI Studio at this repo for the production pass.
Recommended stage order — each stage is reviewable separately:

1. **Read the rules first**: `src/lib/engine/index.ts` doc comments +
   `handoff`-derived rules baked into code. Locked business rules:
   - Water split = used units ÷ (occupied rooms + 1) — owner bears one share.
   - Per-room electricity = current − previous, negative rejected.
   - Bill = rent + (elec + water share) × rate + waste 200 + adjustments +
     prev due + optional loan installment.
   - Mid-month move-in rent: day-wise by default (property setting).
   - Vacant rooms get no waste/water/electricity bill.
   - Print-then-collect; payments are ledger-only; no payment receipts;
     corrections update the ledger in place — never regenerate.
   - Engine math is the source of truth for every displayed number.
2. **Engine hardening**: edge cases, decimal safety, property-test the pure
   functions. Do NOT change locked rules.
3. **Security review**: RLS policies in `supabase/schema.sql`, auth flows in
   `src/screens/01/05/06/32`, env handling. The anon key is public by design.
4. **UX polish**: loading/empty/error states, focus order, print output.
   Keep the "Paper & Ink" tokens (`src/theme/tokens.css`) — one palette, one
   typeface (Noto Sans Bengali), Bengali numerals via `src/lib/format.ts`.
5. **Deploy polish**: PWA shell, offline meter-entry draft, CSV export.

## 5. Known resolved debts

- Canvas demo numbers (৳২,২০০ utility, ৳৫৭,৯৯৮ cycle total, ৳৫২,৮০০ dashboard
  snapshot) were superseded at build start: the engine recomputes everything
  and the dashboard derives from the ledger. Demo seed numbers follow the
  locked water rule ÷(occupied + 1).
- Login is email + password (Tutul confirmed email-only); OTP flows cover
  signup, forgot-password, and password change.
