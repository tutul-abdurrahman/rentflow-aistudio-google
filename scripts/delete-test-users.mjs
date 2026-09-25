/**
 * RentFlow — remove throwaway test users (email contains 'testowner+').
 * Usage: node --env-file=.env scripts/delete-test-users.mjs
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) { console.error('Missing env'); process.exit(1); }

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 100 });
for (const user of list.users) {
  if (user.email?.includes('testowner+')) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    console.log(error ? `failed: ${user.email} — ${error.message}` : `deleted: ${user.email}`);
  }
}
console.log('cleanup done.');
