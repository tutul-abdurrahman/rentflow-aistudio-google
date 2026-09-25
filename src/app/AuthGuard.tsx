import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/**
 * AuthGuard — wraps the app-shell routes (inserted once in App.tsx).
 * While the session is being read it renders a quiet centered spinner;
 * with no session it redirects to /login. Supabase keeps the session in
 * sync, so a later signOut re-triggers this redirect.
 */
type GuardState = 'loading' | 'authed' | 'anon';

export default function AuthGuard({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GuardState>('loading');

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) setState(data.session ? 'authed' : 'anon');
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (active) setState(session ? 'authed' : 'anon');
      },
    );

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

  return <>{children}</>;
}
