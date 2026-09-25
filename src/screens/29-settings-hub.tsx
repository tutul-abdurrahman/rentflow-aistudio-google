import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRepository } from '../app/repository';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';
import { signOut } from '../lib/auth';
import { bnDigits } from '../lib/format';
import type { ReactNode } from 'react';

/**
 * Screen 29 — সেটিংস হাব (design-output/screens/29-settings-hub.html).
 *
 * The টাকা group is lg:hidden — the desktop sidebar already exposes লোন and
 * ফিনান্স. Logout is a
 * confirm sheet that clears the Supabase session through src/lib/auth.ts.
 */

const GROUP_HEADING =
  'px-4 pt-4 text-xs font-semibold uppercase tracking-wide text-ink-faint';

function bnRate(value: number): string {
  return `৳${bnDigits(String(value))}`;
}

function ChevronIcon() {
  return (
    <svg
      className="shrink-0 text-ink-faint"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

interface NavRowProps {
  to: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  trailing?: ReactNode;
}

function NavRow({ to, icon, title, subtitle, trailing }: NavRowProps) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-soft">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block truncate text-xs text-ink-muted">{subtitle}</span>
      </span>
      {trailing ?? <ChevronIcon />}
    </Link>
  );
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export default function SettingsHub() {
  const repo = useRepository();
  const navigate = useNavigate();

  const [roomsCaption, setRoomsCaption] = useState('');
  const [ratesCaption, setRatesCaption] = useState('');
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [property, rooms] = await Promise.all([repo.getProperty(), repo.listRooms()]);
      if (!alive) return;
      setRatesCaption(
        `বিদ্যুৎ ${bnRate(property.electricityRate)}/ইউনিট · ওয়েস্ট ${bnRate(property.wasteFee)}/রুম`,
      );
      if (rooms.length === 0) {
        setRoomsCaption('কোনো রুম যোগ করা হয়নি');
      } else {
        const first = rooms[0].number;
        const last = rooms[rooms.length - 1].number;
        setRoomsCaption(
          `${bnDigits(rooms.length)}টি রুম · ${bnDigits(first)}–${bnDigits(last)}`,
        );
      }
    })();
    return () => {
      alive = false;
    };
  }, [repo]);

  const confirmLogout = async () => {
    setSigningOut(true);
    try {
      await signOut(navigate);
    } finally {
      setSigningOut(false);
      setLogoutOpen(false);
    }
  };

  return (
    <>
      <PageHeader title="সেটিংস" subtitle="লোন, ফিনান্স, বাড়ি ও অ্যাকাউন্ট" />

      <div className="mt-4 grid gap-4 md:mt-6 md:grid-cols-2 md:items-start">
        {/* বাড়ি ও রুম */}
        <section
          className="rounded-card border border-border bg-surface-raised"
          aria-label="বাড়ি ও রুম"
        >
          <h2 className={GROUP_HEADING}>বাড়ি ও রুম</h2>
          <div className="mt-1 divide-y divide-border">
            <NavRow
              to="/settings/property"
              title="বাড়ির তথ্য"
              subtitle="নাম, ঠিকানা ও মোবাইল"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
                  <path d="M3 21h18" />
                  <path d="M5 21V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v16" />
                  <path d="M9 21v-4h6v4" />
                  <path d="M9 8h.01M12 8h.01M15 8h.01M9 12h.01M12 12h.01M15 12h.01" />
                </svg>
              }
            />
            <NavRow
              to="/settings/rooms"
              title="রুম ব্যবস্থাপনা"
              subtitle={roomsCaption || '—'}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
                  <path d="M4 21h16" />
                  <path d="M6 21V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16" />
                  <circle cx="14" cy="13" r="1.3" />
                </svg>
              }
            />
            <NavRow
              to="/settings/property"
              title="রেট ও ফি"
              subtitle={ratesCaption || '—'}
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
                  <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
                  <circle cx="7.5" cy="7.5" r="1.5" />
                </svg>
              }
            />
          </div>
        </section>

        {/* টাকা — phone/tablet only; desktop sidebar covers it */}
        <section
          className="rounded-card border border-border bg-surface-raised lg:hidden"
          aria-label="টাকা"
        >
          <h2 className={GROUP_HEADING}>টাকা</h2>
          <div className="mt-1 divide-y divide-border">
            <NavRow
              to="/loans"
              title="লোন"
              subtitle="কিস্তি, বকেয়া ও মাসিক বিলে যোগ"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
                  <rect x="2" y="6" width="20" height="12" rx="2" />
                  <circle cx="12" cy="12" r="2.5" />
                </svg>
              }
            />
            <NavRow
              to="/finance"
              title="আয়-ব্যয়"
              subtitle="খরচ, আয় ও ক্যাশফ্লো"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
                  <path d="M20 7H5a2 2 0 0 1-2-2 2 2 0 0 1 2-2h13v4" />
                  <path d="M3 5v14a2 2 0 0 0 2 2h15v-4" />
                  <path d="M21 12h-4a2 2 0 0 0 0 4h4z" />
                </svg>
              }
            />
          </div>
        </section>

        {/* অ্যাকাউন্ট ও অ্যাপ */}
        <section
          className="rounded-card border border-border bg-surface-raised"
          aria-label="অ্যাকাউন্ট ও অ্যাপ"
        >
          <h2 className={GROUP_HEADING}>অ্যাকাউন্ট ও অ্যাপ</h2>
          <div className="mt-1 divide-y divide-border">
            <NavRow
              to="/profile"
              title="প্রোফাইল"
              subtitle="নাম, মোবাইল ও পাসওয়ার্ড"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              }
            />

            <NavRow
              to="/profile"
              title="ভাষা"
              subtitle="অ্যাপের ভাষা"
              icon={
                <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18" />
                  <path d="M12 3a15 15 0 0 1 4 9 15 15 0 0 1-4 9 15 15 0 0 1-4-9 15 15 0 0 1 4-9z" />
                </svg>
              }
              trailing={
                <span className="shrink-0 rounded-pill bg-primary-tint px-2.5 py-1 text-xs font-medium text-primary">
                  বাংলা
                </span>
              }
            />
          </div>
        </section>
      </div>

      {/* logout */}
      <section className="mt-4">
        <div className="rounded-card border border-border bg-surface-raised">
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-danger-tint"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-tint text-danger">
              <svg width="20" height="20" viewBox="0 0 24 24" {...stroke}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-danger">লগআউট</span>
              <span className="block truncate text-xs text-ink-muted">এই অ্যাকাউন্ট থেকে বের হন</span>
            </span>
            <ChevronIcon />
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-ink-faint">RentFlow · সংস্করণ ১.০</p>
      </section>

      <Sheet
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        ariaLabel="লগআউট নিশ্চিত করুন"
      >
        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-tint text-danger">
            <svg width="22" height="22" viewBox="0 0 24 24" {...stroke}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </span>
          <div>
            <h2 className="text-lg font-semibold text-ink">সত্যিই লগআউট করবেন?</h2>
            <p className="text-sm text-ink-muted">
              সব তথ্য থেকে যাবে — আবার লগ ইন করলেই সব ফিরে পাবেন।
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => setLogoutOpen(false)}
            className="inline-flex flex-1 items-center justify-center rounded-button border border-secondary bg-transparent px-5 py-3 text-base font-semibold text-secondary transition-colors hover:bg-secondary-hover active:bg-secondary-active"
          >
            বাতিল
          </button>
          <button
            type="button"
            onClick={confirmLogout}
            disabled={signingOut}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-button bg-danger px-5 py-3 text-base font-semibold text-surface-raised transition-opacity hover:opacity-90 active:opacity-100 disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            লগআউট
          </button>
        </div>
      </Sheet>
    </>
  );
}
