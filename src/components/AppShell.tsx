import type { ReactNode } from 'react';
import { useRepository } from '../app/repository';
import { useAsync } from '../lib/useAsync';
import BottomNav, { type BottomNavVariant } from './BottomNav';
import Sidebar from './Sidebar';

/**
 * App shell — sidebar at lg+, bottom nav below lg. Content wrapper is handoff
 * §6 verbatim (gutter px-3 / sm:px-5 / lg:px-8, tablet column max-w-3xl,
 * desktop 6xl → 7xl).
 */
export interface AppShellProps {
  children: ReactNode;
  /** override the bottom nav variant for this screen (default: all five tabs) */
  navVariant?: BottomNavVariant;
}

export function AppShell({ children, navVariant }: AppShellProps) {
  const repository = useRepository();
  // Renames propagate from the repository. Until the property resolves the
  // sidebar renders skeleton bars — it has no placeholder names of its own.
  const { data: property, loading: propertyLoading } = useAsync(
    () => repository.getProperty(),
    [repository],
  );

  return (
    <>
      <Sidebar
        ownerName={property?.ownerName}
        propertyName={property?.name}
        loading={propertyLoading}
      />
      <div className="min-h-dvh lg:pl-[264px]">
        <main className="mx-auto w-full px-3 pb-32 sm:px-5 md:max-w-[48rem] lg:max-w-[72rem] lg:px-8 lg:pb-16 xl:max-w-[80rem]">
          {children}
        </main>
      </div>
      <BottomNav variant={navVariant} />
    </>
  );
}

/** No-nav shell for auth / onboarding / print / success screens. */
export function BareShell({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh">{children}</div>;
}

export default AppShell;
