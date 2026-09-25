/**
 * RentFlow — wipe the owner's live data so a fresh onboarding can start
 * from zero (e.g. before going live).
 *
 * Usage: node --env-file=.env scripts/reset-property.mjs
 *
 * Keeps the Supabase Auth account (email/password stays). Deletes the
 * property row — every app table cascades from it (rooms, tenants,
 * tenant_events, meter_readings, bills, ledger_entries, adjustments,
 * loans, finance_entries). Prints each table's remaining count after
 * the wipe so you can see it is truly empty.
 *
 * The §9 demo dataset can be restored any time with scripts/seed-demo.mts.
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const authAdmin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const OWNER_EMAIL = process.env.OWNER_EMAIL;
if (!OWNER_EMAIL) { console.error('Missing OWNER_EMAIL in .env'); process.exit(1); }

const { data: list, error: listErr } = await authAdmin.auth.admin.listUsers({ page: 1, perPage: 50 });
if (listErr) throw listErr;
const owner = list.users.find((u) => u.email?.toLowerCase() === OWNER_EMAIL);
if (!owner) { console.error('Owner not found'); process.exit(1); }

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  db: { schema: 'public' },
});

const count = async (table) => {
  const { count } = await admin.from(table).select('*', { count: 'exact', head: true }).eq('owner_id', owner.id);
  return count ?? 0;
};

const before = {};
for (const t of ['properties', 'rooms', 'tenants', 'bills', 'ledger_entries', 'meter_readings', 'adjustments', 'loans', 'finance_entries', 'tenant_events']) {
  before[t] = await count(t);
}
console.log('before:', JSON.stringify(before));

const { data: props, error: propErr } = await admin
  .from('properties')
  .select('id')
  .eq('owner_id', owner.id);
if (propErr) throw propErr;

for (const row of props ?? []) {
  const { error } = await admin.from('properties').delete().eq('id', row.id);
  if (error) throw error;
}

const after = {};
for (const t of ['properties', 'rooms', 'tenants', 'bills', 'ledger_entries', 'meter_readings', 'adjustments', 'loans', 'finance_entries', 'tenant_events']) {
  after[t] = await count(t);
}
console.log('after:', JSON.stringify(after));

const total = Object.values(after).reduce((sum, n) => sum + n, 0);
console.log(total === 0 ? 'LIVE DATA CLEARED — lifecycle starts from onboarding.' : `WARNING: ${total} rows remain.`);
