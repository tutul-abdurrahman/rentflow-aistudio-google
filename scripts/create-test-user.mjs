/**
 * RentFlow — create a throwaway test user (no property).
 * Usage: node --env-file=.env scripts/create-test-user.mjs
 * Creates testowner+<ts>@tutulinfo.example and prints a random password.
 * Delete it afterwards with scripts/delete-test-users.mjs to keep the
 * free-tier project clean.
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) { console.error('Missing env'); process.exit(1); }

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const email = `testowner+${Date.now()}@example.invalid`;
const password = 'Test-' + Math.random().toString(36).slice(2, 10);

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (error) throw error;
console.log(`created: ${data.user.email} / ${data.user.password ?? ''} (${data.user.id})`);
console.log(`login with: ${email} / ${password}`);
