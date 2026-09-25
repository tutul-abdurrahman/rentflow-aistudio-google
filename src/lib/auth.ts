import type { NavigateFunction } from 'react-router-dom';
import { supabase } from './supabase';

/**
 * RentFlow auth helpers.
 *
 * The repository is the data mock; Supabase Auth is the real session layer.
 * Logout clears the session and, when a router navigate is supplied, returns
 * the owner to the login screen. Screen 29 and screen 32 both use this.
 */
export async function signOut(navigate?: NavigateFunction): Promise<void> {
  await supabase.auth.signOut();
  navigate?.('/login', { replace: true });
}
