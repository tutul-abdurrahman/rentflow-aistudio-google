import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/**
 * AuthGuard — wraps the app-shell routes (inserted once in App.tsx).
 * While the session is being read it renders a quiet centered spinner;
 * with no session it redirects to /login. Supabase keeps the session in
 * sync, so a later signOut re-triggers this redirect.
 *
 * Setup gate: an authenticated user WITHOUT a property (a fresh signup)
 * cannot see the dashboard — they are sent to /onboarding first. Once the
 * onboarding saves the property, navigating back makes the guard re-run
 * (fresh mount) and pass.
 */
type GuardState = 'loading' | 'authed' | 'anon' | 'needs-setup';

export default function AuthGuard({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GuardState>('loading');

  useEffect(() => {
    let active = true;

    const evaluate = async (hasSession: boolean) => {
      if (!hasSession) {
        if (active) setState('anon');
        return;
      }
      // Setup gate: does this owner have a property yet? (RLS-scoped query)
      // head:true returns count only — data is null, the number is in `count`.
      const { count, error } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true });
      if (!active) return;
      if (error) {
        // A stale-token hiccup should not lock a working session out — the
        // auth state change listener re-evaluates with a fresh token.
        return;
      }
      setState((count ?? 0) > 0 ? 'authed' : 'needs-setup');
    };

    supabase.auth.getSession().then(({ data }) => evaluate(Boolean(data.session)));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      void evaluate(Boolean(session));
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  if (state === 'loading') {
    return (
      <div
        className="flex min-h-dvh items-center justify-center"
        role="status"
        aria-label="লোড হচ্ছে"
      >
        <span
          className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary"
          aria-hidden="true"
        />
      </div>
    );
  }

  if (state === 'anon') {
    return <Navigate to="/login" replace />;
  }

  if (state === 'needs-setup') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
