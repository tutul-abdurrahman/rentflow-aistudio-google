// Check seed state in the live project. Usage: node --env-file=.env scripts/check-seed.mjs
import { createClient } from '@supabase/supabase-js';

const admin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const ownerEmail = process.env.OWNER_EMAIL;
const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 });
const owner = users.users.find((u) => u.email?.toLowerCase() === ownerEmail);
if (!owner) { console.log('NO OWNER'); process.exit(1); }

const count = async (table, col = 'owner_id') => {
  const { count } = await admin.from(table).select('*', { count: 'exact', head: true }).eq(col, owner.id);
  return count ?? 0;
};

const props = await admin.from('properties').select('id, name').eq('owner_id', owner.id);
console.log('properties:', JSON.stringify(props.data));
for (const t of ['rooms', 'tenants', 'bills', 'ledger_entries', 'loans', 'finance_entries', 'meter_readings', 'adjustments']) {
  console.log(t + ':', await count(t));
}
