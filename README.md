# RentFlow

Bangla-first rent & bill admin for a single Bangladesh property — meter-based
utility splitting, tenant & lease management, a loan sub-module, and
income/expense tracking. Built from the approved "Paper & Ink" design system.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 (design tokens mapped into `@theme` — `src/theme/tokens.css`)
- Supabase (Postgres + Auth with real email OTP)
- Vitest for the calculation engine's unit tests

## Run

```bash
npm install
copy .env.example .env   # then fill in your Supabase values
npm run dev
```

`.env` needs:

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — anon/publishable key (safe for the browser)

Never put the `service_role` key in a `VITE_*` variable — it is server-side
only (`.env` is gitignored).

## Test & build

```bash
npm test          # calc engine + repository unit tests
npm run build     # type-check + production build
npm run preview   # serve the production build locally
```

## Supabase setup

One-time, from the repo:

```bash
node --env-file=.env scripts/apply-schema.mjs        # tables + RLS (idempotent)
node --env-file=.env scripts/create-owner.mjs        # owner account + profile
npx tsx --env-file=.env scripts/seed-demo.mts        # §9 demo data (idempotent)
```

- Schema + policies: `supabase/schema.sql` (RLS: every table is locked to the
  signed-in owner via `owner_id = auth.uid()`).
- Auth: email + password login; email OTP for signup, forgot-password, and
  password change (real emails via Supabase Auth's built-in SMTP).
- `scripts/seed-demo.mts` writes the canonical §9 dataset (property, rooms
  ১০২–১০৭, tenants incl. the archived শামীম, the July opening cycle + August
  papers, meters, loan, expenses). It uses the `service_role` key server-side
  and skips when the owner already has a property — it never duplicates data.

Read-only live check (signs in with the anon key and asserts the August
figures through the repository):

```bash
npx tsx --env-file=.env scripts/smoke-live.mts
```

## Demo data

Persistence is live: with `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` set and
the owner signed in, the app reads and writes Supabase through the anon-key
client (`src/lib/repository/supabase.ts`), with RLS scoping every row to the
owner. Without env (or when no property exists) it falls back to the in-memory
repository seeded with the canonical demo dataset (মিরপুর-১০ property, rooms
১০২–১০৭, আগস্ট ২০২৬ cycle) — `src/lib/seed/demo.ts`. All displayed numbers are
computed by the engine (`src/lib/engine`), never hardcoded.

## Print screens

বিল প্রিন্ট (04), রিপ্রিন্ট (21), and the monthly ledger (22) use real
`@media print` rules. Preview them in a real browser (Ctrl+P, Margins: None)
— browser design tools cannot reliably emulate print.

## Repository layout

```
src/
├── app/            # router, shells, auth guard
├── components/     # design-system components (button, sheet, chips…)
├── lib/
│   ├── engine/     # pure calc functions + unit tests (source of truth)
│   ├── repository/ # RentFlowRepository interface + memory + Supabase impl
│   ├── seed/       # §9 canonical demo dataset
│   └── supabase.ts # Supabase client
├── screens/        # one component per screen (01…33, design numbering)
└── theme/          # tokens.css (@theme port) + print CSS
supabase/           # schema.sql
scripts/            # apply-schema.mjs, create-owner.mjs, seed-demo.mts,
                    # smoke-live.mts, verify-fks.mjs
```
