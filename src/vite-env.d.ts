/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL — public, safe to expose */
  readonly VITE_SUPABASE_URL: string;
  /** Supabase anon public key — public, safe to expose */
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
