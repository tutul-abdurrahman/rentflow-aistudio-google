import { useEffect, useState } from 'react';

/**
 * Minimal async loader hook for screens that read the repository.
 *
 * The repository is async (memory impl resolves immediately today, Supabase
 * later), so every screen needs loading / error / data plus a way to re-run
 * after a mutation. `loader` is intentionally not a dependency: callers pass
 * the values it closes over via `deps`.
 */
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useAsync<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loader()
      .then((value) => {
        if (!alive) return;
        setData(value);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!alive) return;
        setError(cause instanceof Error ? cause.message : 'UNKNOWN_ERROR');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, reload: () => setNonce((value) => value + 1) };
}
