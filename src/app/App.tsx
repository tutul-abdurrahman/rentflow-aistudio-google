import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell, BareShell } from '../components/AppShell';
import { routes } from './routes';
import { RepositoryProvider } from './repository';
import AuthGuard from './AuthGuard';

/**
 * Shell selection: layout routes keep the sidebar / bottom nav mounted across
 * navigations instead of remounting them per screen. Unknown paths → '/'.
 */
function AppLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function BareLayout() {
  return (
    <BareShell>
      <Outlet />
    </BareShell>
  );
}

/**
 * Bare routes that require a session (print / reprint / ready / payment success)
 * — no nav chrome, but still behind AuthGuard.
 */
function GuardedBareLayout() {
  return (
    <AuthGuard>
      <BareShell>
        <Outlet />
      </BareShell>
    </AuthGuard>
  );
}

/** Bare routes reachable before sign-in (auth + onboarding only). */
const PUBLIC_BARE_PATHS = new Set([
  '/login',
  '/signup',
  '/forgot-password',
  '/onboarding',
  '/onboarding/success',
]);

const appRoutes = routes.filter((route) => route.shell === 'app');
const bareRoutes = routes.filter((route) => route.shell === 'bare');
const publicBareRoutes = bareRoutes.filter((route) => PUBLIC_BARE_PATHS.has(route.path));
const guardedBareRoutes = bareRoutes.filter((route) => !PUBLIC_BARE_PATHS.has(route.path));

export default function App() {
  return (
    <RepositoryProvider>
      <BrowserRouter>
        <Routes>
          <Route
            element={
              <AuthGuard>
                <AppLayout />
              </AuthGuard>
            }
          >
            {appRoutes.map(({ path, Component }) => (
              <Route key={path} path={path} element={<Component />} />
            ))}
          </Route>

          <Route element={<BareLayout />}>
            {publicBareRoutes.map(({ path, Component }) => (
              <Route key={path} path={path} element={<Component />} />
            ))}
          </Route>

          <Route element={<GuardedBareLayout />}>
            {guardedBareRoutes.map(({ path, Component }) => (
              <Route key={path} path={path} element={<Component />} />
            ))}
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </RepositoryProvider>
  );
}

