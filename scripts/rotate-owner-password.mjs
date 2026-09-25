/**
 * RentFlow — rotate the owner account password (server-side admin op).
 *
 * Usage: node --env-file=.env scripts/rotate-owner-password.mjs
 * Reads OWNER_EMAIL + OWNER_PASSWORD from .env and sets that as the
 * account's password. Run whenever the credential needs changing.
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OWNER_EMAIL = process.env.OWNER_EMAIL;
const OWNER_PASSWORD = process.env.OWNER_PASSWORD;

if (!url || !serviceKey || !OWNER_EMAIL || !OWNER_PASSWORD) {
  console.error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / OWNER_EMAIL / OWNER_PASSWORD in .env');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 });
if (listErr) throw listErr;

const user = list.users.find((u) => u.email?.toLowerCase() === OWNER_EMAIL);
if (!user) {
  console.error('Owner not found — run scripts/create-owner.mjs first.');
  process.exit(1);
}

const { error } = await admin.auth.admin.updateUserById(user.id, { password: OWNER_PASSWORD });
if (error) throw error;
console.log(`password rotated for ${OWNER_EMAIL} (${user.id}).`);
