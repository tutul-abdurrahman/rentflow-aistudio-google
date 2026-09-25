/**
 * RentFlow — create the single owner account + profile row.
 *
 * Usage: node --env-file=.env scripts/create-owner.mjs
 * Credentials come from .env ONLY — never hardcode them here:
 *   OWNER_EMAIL / OWNER_PASSWORD (app login, server-side setup)
 * Uses the service_role key server-side ONLY (never exposed to the app).
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OWNER_EMAIL = process.env.OWNER_EMAIL;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD;

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
if (!OWNER_EMAIL || !OWNER_PASSWORD) {
  console.error('Missing OWNER_EMAIL / OWNER_PASSWORD in .env');
  process.exit(1);
}

const OWNER_NAME = 'রফিকুল ইসলাম';
const OWNER_PHONE = '01711234567';

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 });
if (listErr) throw listErr;

let user = list.users.find((u) => u.email?.toLowerCase() === OWNER_EMAIL);
if (user) {
  console.log(`owner already exists: ${user.id}`);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: OWNER_EMAIL,
    password: OWNER_PASSWORD,
    email_confirm: true,
    user_metadata: { owner_name: OWNER_NAME },
  });
  if (error) throw error;
  user = data.user;
  console.log(`owner created: ${user.id}`);
}

const { error: profErr } = await admin
  .from('profiles')
  .upsert({ id: user.id, owner_name: OWNER_NAME, phone: OWNER_PHONE, language: 'bn' });
if (profErr) throw profErr;
console.log('profile row ensured.');
