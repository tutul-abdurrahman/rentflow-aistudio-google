/**
 * RentFlow — Supabase client.
 *
 * Client-side Supabase access uses the anon key only (RLS enforces the
 * single-owner rule server-side). The service_role key lives in .env
 * WITHOUT the VITE_ prefix and is never imported here.
 *
 * Env reads are runtime-safe for both Vite (import.meta.env) and tsx
 * (process.env). This module never throws at import: when the env pair is
 * missing it exports `supabaseConfigured = false`, and the repository factory
 * selects the in-memory implementation instead. That keeps a single signing-in
 * client instance for the app while still allowing an env-less process (tsx,
 * unit tests) to load the module graph.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function viteEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string | undefined {
  try {
    // Direct member reads so Vite statically inlines the values in the build.
    return name === 'VITE_SUPABASE_URL'
      ? import.meta.env.VITE_SUPABASE_URL
      : import.meta.env.VITE_SUPABASE_ANON_KEY;
  } catch {
    // import.meta.env is absent outside the bundler (tsx): fall back to process.env.
    return undefined;
  }
}

const nodeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
  .process?.env;

const supabaseUrl = viteEnv('VITE_SUPABASE_URL') ?? nodeEnv?.VITE_SUPABASE_URL;
const supabaseAnonKey = viteEnv('VITE_SUPABASE_ANON_KEY') ?? nodeEnv?.VITE_SUPABASE_ANON_KEY;

/** True when both the URL and anon key resolved; the app then persists for real. */
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!supabaseConfigured) {
  console.warn(
    'RentFlow: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — using the in-memory demo repository.',
  );
}

/**
 * The one client the whole app shares (auth + repository must be the same
 * instance so RLS requests carry the owner JWT). When unconfigured this is a
 * placeholder that is never used for data.
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'anon-key-not-configured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
