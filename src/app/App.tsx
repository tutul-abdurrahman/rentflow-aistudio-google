import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell, BareShell } from '../components/AppShell';
import { routes } from './routes';
import { RepositoryProvider } from './repository';

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

const appRoutes = routes.filter((route) => route.shell === 'app');
const bareRoutes = routes.filter((route) => route.shell === 'bare');

export default function App() {
  return (
    <RepositoryProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            {appRoutes.map(({ path, Component }) => (
              <Route key={path} path={path} element={<Component />} />
            ))}
          </Route>

          <Route element={<BareLayout />}>
            {bareRoutes.map(({ path, Component }) => (
              <Route key={path} path={path} element={<Component />} />
            ))}
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </RepositoryProvider>
  );
}

