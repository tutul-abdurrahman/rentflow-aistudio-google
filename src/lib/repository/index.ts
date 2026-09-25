/**
 * RentFlow — repository factory.
 *
 * Build/demo: in-memory repository seeded with §9 demo data.
 * The Supabase implementation replaces this during integration —
 * the rest of the app only ever talks to the RentFlowRepository interface.
 */

import type { RentFlowRepository } from './types';
import { createMemoryRepository } from './memory';

let repository: RentFlowRepository | null = null;

export function getRepository(): RentFlowRepository {
  if (!repository) repository = createMemoryRepository();
  return repository;
}
