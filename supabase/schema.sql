-- ============================================================
-- RentFlow — Supabase schema (single owner)
-- Applied via scripts/apply-schema.mjs (idempotent).
--
-- Rules:
-- - RLS on every table. owner_id = auth.uid() everywhere.
-- - No cross-owner access is possible (single owner product).
-- - Engine math is source of truth; this schema stores data only.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- profiles (owner settings) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  owner_name text not null default '',
  phone text not null default '',
  language text not null default 'bn',
  created_at timestamptz not null default now()
);

-- ---------- properties (settings, screen 31) ----------
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  address text not null default '',
  owner_name text not null default '',
  owner_phone text not null default '',
  electricity_rate numeric not null default 7.5,
  waste_fee numeric not null default 200,
  water_split_rule text not null default 'occupied_plus_one',
  mid_month_rule text not null default 'day_wise',
  created_at timestamptz not null default now()
);
create index if not exists properties_owner_idx on public.properties (owner_id);

-- ---------- rooms (screens 07, 30) ----------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  number text not null,
  rent numeric not null default 0,
  status text not null default 'vacant' check (status in ('occupied', 'vacant')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (property_id, number)
);
create index if not exists rooms_property_idx on public.rooms (property_id, sort_order);

-- ---------- tenants (screens 09-16) ----------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  phone text not null default '',
  room_id uuid references public.rooms (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'archived')),
  move_in_date date,
  move_out_date date,
  move_out_resolution text check (move_out_resolution in ('refund', 'hold', 'adjust')),
  move_out_note text,
  created_at timestamptz not null default now()
);
create index if not exists tenants_property_idx on public.tenants (property_id, status);

-- ---------- tenant events (screen 16 history) ----------
create table if not exists public.tenant_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  date date not null,
  label text not null,
  detail text not null default '',
  amount numeric,
  created_at timestamptz not null default now()
);
create index if not exists tenant_events_tenant_idx on public.tenant_events (tenant_id, date);

-- ---------- meter readings (screen 03) ----------
create table if not exists public.meter_readings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  month text not null,
  room_id uuid references public.rooms (id) on delete cascade,
  utility text not null check (utility in ('electricity', 'water')),
  previous numeric not null default 0,
  current numeric not null default 0,
  recorded_at timestamptz not null default now()
);
-- one reading per room/utility/month; building water uses room_id = null
create unique index if not exists meter_readings_unique
  on public.meter_readings (property_id, month, utility, coalesce(room_id::text, 'building'));
create index if not exists meter_readings_month_idx on public.meter_readings (property_id, month);

-- ---------- bills (monthly papers, screens 17/04/21/22) ----------
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  month text not null,
  room_id uuid not null references public.rooms (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  lines jsonb not null default '[]',
  utilities_total numeric not null default 0,
  total numeric not null default 0,
  paper_ref text not null unique,
  status text not null default 'due' check (status in ('due', 'partial', 'paid')),
  paid_amount numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (property_id, month, room_id)
);
create index if not exists bills_month_idx on public.bills (property_id, month);

-- ---------- ledger entries (payments; NO receipts, screen 19/20/22) ----------
create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  bill_id uuid not null references public.bills (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  month text not null,
  amount numeric not null,
  paid_at date not null,
  method text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists ledger_month_idx on public.ledger_entries (property_id, month);
create index if not exists ledger_bill_idx on public.ledger_entries (bill_id);

-- ---------- adjustments (screen 18, in-place corrections) ----------
create table if not exists public.adjustments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  month text not null,
  room_id uuid not null references public.rooms (id) on delete cascade,
  label text not null,
  amount numeric not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists adjustments_month_idx on public.adjustments (property_id, month);

-- ---------- loans (screens 23-25) ----------
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  total_amount numeric not null,
  installment_count integer not null,
  installment_amount numeric not null,
  paid_installments integer not null default 0,
  add_to_bill boolean not null default true,
  status text not null default 'active' check (status in ('active', 'cancelled', 'completed')),
  note text,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);
create index if not exists loans_tenant_idx on public.loans (tenant_id);

-- ---------- finance entries (screens 26-28) ----------
create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  category text not null default '',
  amount numeric not null,
  date date not null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists finance_date_idx on public.finance_entries (property_id, date);

-- ============================================================
-- RLS — single owner: owner_id must equal the signed-in user.
-- ============================================================
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.rooms enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_events enable row level security;
alter table public.meter_readings enable row level security;
alter table public.bills enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.adjustments enable row level security;
alter table public.loans enable row level security;
alter table public.finance_entries enable row level security;

drop policy if exists "owner_full_profiles" on public.profiles;
create policy "owner_full_profiles" on public.profiles
  for all using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "owner_full_properties" on public.properties;
create policy "owner_full_properties" on public.properties
  for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "owner_full_rooms" on public.rooms;
create policy "owner_full_rooms" on public.rooms
  for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "owner_full_tenants" on public.tenants;
create policy "owner_full_tenants" on public.tenants
  for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "owner_full_tenant_events" on public.tenant_events;
create policy "owner_full_tenant_events" on public.tenant_events
  for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "owner_full_meter_readings" on public.meter_readings;
create policy "owner_full_meter_readings" on public.meter_readings
  for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "owner_full_bills" on public.bills;
create policy "owner_full_bills" on public.bills
  for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "owner_full_ledger" on public.ledger_entries;
create policy "owner_full_ledger" on public.ledger_entries
  for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "owner_full_adjustments" on public.adjustments;
create policy "owner_full_adjustments" on public.adjustments
  for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "owner_full_loans" on public.loans;
create policy "owner_full_loans" on public.loans
  for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

drop policy if exists "owner_full_finance" on public.finance_entries;
create policy "owner_full_finance" on public.finance_entries
  for all using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
