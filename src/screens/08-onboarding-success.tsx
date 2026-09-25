import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useRepository } from '../app/repository';
import { bnDigits, bnTaka } from '../lib/format';
import type { Property, Room } from '../lib/types';

/**
 * 08 — সেটআপ সম্পন্ন (bare shell). Card from 08-onboarding-success.html.
 * The setup summary is read back from the repository so it reflects what the
 * owner actually entered (property name, room count, electricity rate, waste).
 */

function BrandLockup() {
  return (
    <div className="flex flex-col items-center text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-on-primary">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
        </svg>
      </span>
      <p className="mt-3 text-xl font-bold tracking-tight text-ink">RentFlow</p>
      <p className="mt-0.5 text-sm text-ink-faint">ভাড়া ও বিল ব্যবস্থাপনা</p>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  divided,
  truncateValue,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  divided?: boolean;
  truncateValue?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-3 ${
        divided ? 'border-t border-border' : ''
      }`}
    >
      <span className="flex min-w-0 items-center gap-2 text-sm text-ink-muted">
        <span className="shrink-0 text-primary">{icon}</span>
        {label}
      </span>
      <span
        className={`min-w-0 text-right text-sm font-semibold text-ink ${
          truncateValue ? 'truncate' : ''
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function OnboardingSuccess() {
  const repo = useRepository();
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const [loadedProperty, loadedRooms] = await Promise.all([
        repo.getProperty(),
        repo.listRooms(),
      ]);
      if (!active) return;
      setProperty(loadedProperty);
      setRooms(loadedRooms);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [repo]);

  if (loading || !property) {
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

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-12">
      <div className="mx-auto w-full max-w-md">
        <BrandLockup />

        <div className="mt-8 rounded-card border border-border bg-surface-raised p-5">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-tint text-primary">
              <svg
                width="36"
                height="36"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <h1 className="mt-5 text-xl font-bold text-ink">
              সব ঠিক আছে, রফিক ভাই!
            </h1>
            <p className="mt-1.5 text-sm text-ink-muted">
              বাড়ি সেটআপ শেষ। এবার থেকে বিল আর আদায় সব এক জায়গায়।
            </p>

            <div className="mt-6 w-full overflow-hidden rounded-md border border-border">
              <SummaryRow
                icon={
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 10.5 12 3l9 7.5" />
                    <path d="M5 9.5V21h14V9.5" />
                  </svg>
                }
                label="বাড়ি"
                value={property.name}
                truncateValue
              />
              <SummaryRow
                divided
                icon={
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 12h18M12 3v18" />
                  </svg>
                }
                label="রুম"
                value={`${bnDigits(rooms.length)}টি রুম`}
              />
              <SummaryRow
                divided
                icon={
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
                  </svg>
                }
                label="বিদ্যুৎ রেট"
                value={`৳${bnDigits(String(property.electricityRate))}/ইউনিট`}
              />
              <SummaryRow
                divided
                icon={
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M6 7h12l-1 13H7L6 7z" />
                    <path d="M4 4h16v3H4z" />
                    <path d="M9 4a3 3 0 0 1 6 0" />
                  </svg>
                }
                label="ওয়েস্ট ফি"
                value={`${bnTaka(property.wasteFee)}/রুম/মাস`}
              />
            </div>

            <Link
              to="/"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-button border border-transparent bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active"
            >
              <svg
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
                <path d="M3 10.5 12 3l9 7.5" />
                <path d="M5 9.5V21h14V9.5" />
              </svg>
              ড্যাশবোর্ডে যান
            </Link>

            <Link
              to="/more"
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-button border border-secondary bg-surface-raised px-5 py-3 text-base font-semibold text-secondary transition-colors hover:bg-secondary-hover active:bg-secondary-active"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              সেটিংস দেখুন
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
