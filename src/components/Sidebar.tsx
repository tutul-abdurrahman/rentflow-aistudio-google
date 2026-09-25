import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../lib/cn';

/**
 * RentFlow desktop sidebar — port of design-output/components/sidebar.html.
 * lg+ only, fixed 264px. Active row = saffron tint pill. Bottom chip shows the
 * current property; pass real values from the repository when wired.
 */
export interface SidebarProps {
  ownerName?: string;
  propertyName?: string;
}

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  isActive: (pathname: string) => boolean;
}

function StrokeIcon({ size = 20, children }: { size?: number; children: ReactNode }) {
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

const ITEMS: NavItem[] = [
  {
    label: 'ড্যাশবোর্ড',
    to: '/',
    isActive: (p) => p === '/',
    icon: (
      <StrokeIcon>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </StrokeIcon>
    ),
  },
  {
    label: 'বিল ও মিটার',
    to: '/bills/meters',
    isActive: (p) => p.startsWith('/bills'),
    icon: (
      <StrokeIcon>
        <path d="M6 2h12v20l-2-1.5L14 22l-2-1.5L10 22l-2-1.5L6 22V2z" />
        <path d="M9 7h6M9 11h6M9 15h4" />
      </StrokeIcon>
    ),
  },
  {
    label: 'রেন্টি',
    to: '/tenants',
    isActive: (p) => p.startsWith('/tenants'),
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
    label: 'সারাংশ',
    to: '/summary',
    isActive: (p) => p.startsWith('/summary'),
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
    label: 'লোন',
    to: '/loans',
    isActive: (p) => p.startsWith('/loans'),
    icon: (
      <StrokeIcon>
        <path d="M3 21h18" />
        <path d="M4 10h16" />
        <path d="M12 3 4 8h16z" />
        <path d="M6 10v7M10 10v7M14 10v7M18 10v7" />
      </StrokeIcon>
    ),
  },
  {
    label: 'ফিনান্স',
    to: '/finance',
    isActive: (p) => p.startsWith('/finance'),
    icon: (
      <StrokeIcon>
        <path d="M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
        <path d="M16 13h4" />
        <path d="M16 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2" />
      </StrokeIcon>
    ),
  },
  {
    label: 'সেটিংস',
    to: '/more',
    isActive: (p) => p === '/more' || p.startsWith('/settings') || p === '/profile',
    icon: (
      <StrokeIcon>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </StrokeIcon>
    ),
  },
];

export default function Sidebar({
  ownerName = 'রফিক ভাই',
  propertyName = 'আবাসিক ভবন — মিরপুর-১০',
}: SidebarProps) {
  const { pathname } = useLocation();

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-border bg-surface-raised lg:flex"
      aria-label="সাইডবার"
    >
      <div className="flex items-center gap-3 border-b border-border px-5 py-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
          <StrokeIcon size={22}>
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V21h14V9.5" />
          </StrokeIcon>
        </span>
        <div className="min-w-0">
          <p className="truncate text-base font-bold tracking-tight text-ink">RentFlow</p>
          <p className="truncate text-xs text-ink-faint">ভাড়া ও বিল ব্যবস্থাপনা</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {ITEMS.map((item) => {
          const active = item.isActive(pathname);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm',
                active
                  ? 'bg-primary-tint font-semibold text-primary'
                  : 'text-ink-muted transition-colors hover:bg-surface-soft',
              )}
              aria-current={active ? 'page' : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-sm font-semibold text-primary">
            {ownerName.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{ownerName}</p>
            <p className="truncate text-xs text-ink-faint">{propertyName}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
