/**
 * RentFlow — repository factory.
 *
 * Supabase (production): when the anon env pair resolves, the repository is
 * built over the SAME Supabase client the auth layer signs in with, so every
 * query carries the owner JWT and RLS returns only that owner's rows.
 * In-memory (build/test): when env is absent the memory repository seeded with
 * §9 demo data is used instead.
 *
 * `supabaseConfigured` is computed from a runtime-safe env read in
 * src/lib/supabase.ts, so this module loads cleanly under Vite, vitest, and
 * tsx (where import.meta.env is absent).
 */

import type { RentFlowRepository } from './types';
import { createMemoryRepository } from './memory';
import { createSupabaseRepository } from './supabase';
import { supabase, supabaseConfigured } from '../supabase';

let repository: RentFlowRepository | null = null;

export function getRepository(): RentFlowRepository {
  if (!repository) {
    repository = supabaseConfigured
      ? createSupabaseRepository(supabase)
      : createMemoryRepository();
  }
  return repository;
}
