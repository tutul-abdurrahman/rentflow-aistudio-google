import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/cn';

/**
 * RentFlow bottom navigation — port of design-output/components/bottom-nav.html.
 * Order: বিল · রেন্টি · হোম · সারাংশ · আরও. Visible below lg only, centered at
 * max-w-md (md:max-w-3xl so it matches the tablet column). হোম is the raised
 * 56px circle: saffron + tint ring when active, paper + strong border otherwise.
 */
export type BottomNavVariant = 'default' | 'no-bills' | 'no-more';

export interface BottomNavProps {
  /**
   * 'no-bills' drops the বিল tab, 'no-more' drops the আরও tab (handoff §14).
   * NOTE: the approved screen HTML keeps all five tabs on 03 and 26 and the
   * raised হোম tab relies on a 5-slot grid, so every current route uses
   * 'default'. Kept as an opt-in for shells that need the narrower bar.
   */
  variant?: BottomNavVariant;
}

type TabKey = 'bills' | 'tenants' | 'home' | 'summary' | 'more';

interface Tab {
  key: TabKey;
  label: string;
  to: string;
  icon: ReactNode;
}

function StrokeIcon({ size = 24, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const TABS: Tab[] = [
  {
    key: 'bills',
    label: 'বিল',
    to: '/bills/preview',
    icon: (
      <StrokeIcon>
        <path d="M6 2h12v20l-2-1.5L14 22l-2-1.5L10 22l-2-1.5L6 22V2z" />
        <path d="M9 7h6M9 11h6M9 15h4" />
      </StrokeIcon>
    ),
  },
  {
    key: 'tenants',
    label: 'রেন্টি',
    to: '/tenants',
    icon: (
      <StrokeIcon>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </StrokeIcon>
    ),
  },
  {
    key: 'home',
    label: 'হোম',
    to: '/',
    icon: (
      <StrokeIcon size={28}>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </StrokeIcon>
    ),
  },
  {
    key: 'summary',
    label: 'সারাংশ',
    to: '/summary',
    icon: (
      <StrokeIcon>
        <path d="M3 3v18h18" />
        <path d="M8 17v-5" />
        <path d="M13 17V7" />
        <path d="M18 17v-8" />
      </StrokeIcon>
    ),
  },
  {
    key: 'more',
    label: 'আরও',
    to: '/more',
    icon: (
      <StrokeIcon>
        <circle cx="5" cy="12" r="1.4" />
        <circle cx="12" cy="12" r="1.4" />
        <circle cx="19" cy="12" r="1.4" />
      </StrokeIcon>
    ),
  },
];

/** which tab is the current page for */
function activeKey(pathname: string): TabKey | null {
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/tenants')) return 'tenants';
  if (pathname.startsWith('/summary')) return 'summary';
  if (pathname.startsWith('/bills')) return 'bills';
  if (
    pathname === '/more' ||
    pathname === '/profile' ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/loans') ||
    pathname.startsWith('/finance')
  ) {
    return 'more';
  }
  return null;
}

export default function BottomNav({ variant = 'default' }: BottomNavProps) {
  const { pathname } = useLocation();
  const current = activeKey(pathname);

  const tabs = TABS.filter((tab) => {
    if (variant === 'no-bills' && tab.key === 'bills') return false;
    if (variant === 'no-more' && tab.key === 'more') return false;
    return true;
  });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[28rem] border-t border-border bg-surface-raised px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:max-w-[48rem] lg:hidden"
      aria-label="প্রধান নেভিগেশন"
    >
      <div className={tabs.length === 4 ? 'grid grid-cols-4' : 'grid grid-cols-5'}>
        {tabs.map((tab) => {
          const isCurrent = current === tab.key;

          if (tab.key === 'home') {
            return (
              <Link
                key={tab.key}
                to={tab.to}
                className={cn(
                  'flex flex-col items-center pt-1',
                  isCurrent
                    ? 'text-ink'
                    : 'text-ink-faint transition-colors hover:text-ink-muted',
                )}
                aria-label={tab.label}
                aria-current={isCurrent ? 'page' : undefined}
              >
                <span
                  className={cn(
                    '-mt-6 flex h-14 w-14 items-center justify-center rounded-full shadow-float',
                    isCurrent
                      ? 'bg-primary text-on-primary ring-4 ring-primary-tint'
                      : 'border-2 border-border-strong bg-surface-raised text-ink',
                  )}
                >
                  {tab.icon}
                </span>
                <span className={cn('mt-1 text-xs', isCurrent && 'font-semibold')}>
                  {tab.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={tab.key}
              to={tab.to}
              className={cn(
                'flex flex-col items-center gap-1 py-1',
                isCurrent
                  ? 'text-primary'
                  : 'text-ink-faint transition-colors hover:text-ink-muted',
              )}
              aria-label={tab.label}
              aria-current={isCurrent ? 'page' : undefined}
            >
              <span
                className={cn(
                  'flex h-9 w-14 items-center justify-center rounded-pill',
                  isCurrent ? 'bg-primary-tint' : 'bg-transparent',
                )}
              >
                {tab.icon}
              </span>
              <span className={cn('text-xs', isCurrent && 'font-semibold')}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
