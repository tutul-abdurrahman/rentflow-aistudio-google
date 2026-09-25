import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { RentFlowRepository } from '../lib/repository/types';
import { getRepository } from '../lib/repository';

/**
 * Repository access for screens.
 *
 * `getRepository()` is called exactly once per provider, lazily. It returns the
 * memory-backed repository today; a Supabase implementation lands during
 * integration. The lazy getter keeps that swap from becoming an eager
 * dependency of the shell before any screen renders.
 */
type RepositoryGetter = () => RentFlowRepository;

const RepositoryContext = createContext<RepositoryGetter | null>(null);

export function RepositoryProvider({ children }: { children: ReactNode }) {
  const getRepo = useMemo<RepositoryGetter>(() => {
    let cached: RentFlowRepository | null = null;
    return () => {
      cached ??= getRepository();
      return cached;
    };
  }, []);

  return (
    <RepositoryContext.Provider value={getRepo}>
      {children}
    </RepositoryContext.Provider>
  );
}

export function useRepository(): RentFlowRepository {
  const getRepo = useContext(RepositoryContext);
  if (!getRepo) {
    throw new Error('useRepository must be used inside <RepositoryProvider>');
  }
  return useMemo(() => getRepo(), [getRepo]);
}
