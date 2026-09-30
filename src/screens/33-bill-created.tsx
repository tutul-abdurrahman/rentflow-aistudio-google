import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useRepository } from '../app/repository';
import { cycleTotal } from '../lib/engine';
import { bnDigits, bnMonth, bnTaka } from '../lib/format';
import { resolveScreenMonth } from '../lib/screen-month';
import { addMonths, currentMonth } from '../lib/view';
import type { Bill, Property, Room, Tenant } from '../lib/types';
import { takaInWords } from './04-receipt-grid-print';

/**
 * 33 — কাগজ প্রস্তুত. Optional "papers are ready, print now" beat (handoff §8).
 * Reachable only by its own route (/bills/ready) — 17 goes straight to 04. It
 * must NOT send the owner to collection.
 *
 * The month is the one that was just calculated: ?month= → latest billed →
 * active. After the papers are done it offers the next month's draft so the
 * forward cycle never dies (bug 2).
 */

function PrintIcon() {
  return (
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
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a1 1 0 0 1-1-1v-5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v5a1 1 0 0 1-1 1h-2" />
      <path d="M6 14h12v8H6z" />
    </svg>
  );
}

function PlusIcon() {
  return (
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
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function HomeIcon() {
  return (
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
  );
}

function ViewIcon() {
  return (
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
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function GaugeIcon() {
  return (
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
      <path d="M3.5 18a8.5 8.5 0 1 1 17 0" />
      <path d="m12 14 3-3" />
      <circle cx="12" cy="14" r="1.4" />
    </svg>
  );
}

export default function BillCreated() {
  const repo = useRepository();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState('');
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const resolvedMonth = await resolveScreenMonth(repo, searchParams.get('month'));
      const [prop, roomList, tenantList, billList] = await Promise.all([
        repo.getProperty(),
        repo.listRooms(),
        repo.listTenants(),
        repo.listBills(resolvedMonth),
      ]);
      if (!alive) return;
      setMonth(resolvedMonth);
      setProperty(prop);
      setRooms(roomList);
      setTenants(tenantList);
      setBills(billList);
      setLoading(false);
    })().catch(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  const total = useMemo(() => cycleTotal(bills), [bills]);

  /** The next month's draft, only while it is not in the future (bug 2). */
  const nextMonth = month ? addMonths(month, 1) : '';
  const canStartNextMonth = nextMonth !== '' && nextMonth <= currentMonth();

  const vacantNumbers = useMemo(
    () => rooms.filter((room) => room.status === 'vacant').map((room) => bnDigits(room.number)),
    [rooms],
  );

  const loanBills = useMemo(
    () =>
      bills
        .map((bill) => ({
          bill,
          amount: bill.lines
            .filter((line) => line.kind === 'loan')
            .reduce((sum, line) => sum + line.amount, 0),
        }))
        .filter((entry) => entry.amount !== 0),
    [bills],
  );

  const tenantName = (tenantId: string): string =>
    tenants.find((tenant) => tenant.id === tenantId)?.name ?? '';

  if (loading || !property) {
    return (
      <div className="flex min-h-dvh flex-col bg-surface text-ink" aria-busy="true" aria-label="লোড হচ্ছে">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-10" aria-hidden="true">
          <div className="skeleton mx-auto h-12 w-12 rounded-full" />
          <div className="skeleton mt-4 mx-auto h-6 w-48 max-w-full" />
          <div className="mt-6 rounded-card border border-border bg-surface-raised px-5 py-5">
            <div className="skeleton h-3 w-28" />
            <div className="skeleton mt-3 h-7 w-36" />
            <div className="skeleton mt-2 h-3 w-32" />
          </div>
          <div className="skeleton mx-auto mt-8 h-10 w-36 rounded-button" />
        </div>
      </div>
    );
  }

  const subtitleParts = [bnMonth(month), `${bnDigits(bills.length)}টি কাগজ`];
  if (vacantNumbers.length > 0) subtitleParts.push(`${vacantNumbers.join('/')} খালি`);

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-ink">
      <main className="mx-auto flex w-full max-w-[28rem] flex-1 flex-col items-center justify-center px-5 py-12">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-tint">
          <svg
            className="text-primary"
            width="52"
            height="52"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m4.5 12.5 5 5L20 6.5" />
          </svg>
        </span>

        <h1 className="mt-6 text-2xl font-bold text-ink">বিল প্রস্তুত</h1>
        <p className="mt-1.5 text-sm text-ink-muted">{subtitleParts.join(' · ')}</p>

        <p className="mt-5 text-4xl leading-none font-bold tracking-tight text-ink">
          {bnTaka(total)}
        </p>
        <p className="mt-2 text-xs text-ink-faint">{takaInWords(total)} টাকা মাত্র</p>

        <div className="mt-5 flex w-full items-start gap-2.5 rounded-card border border-border bg-surface-raised px-4 py-3">
          <svg
            className="mt-0.5 shrink-0 text-primary"
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
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01M12 11v5" />
          </svg>
          <p className="text-xs leading-relaxed text-ink-muted">
            এই কাগজগুলো এখন ভাড়াটদের হাতে দিন। টাকা এলে লেজারে লিখবেন — এখান থেকে কালেকশন
            শুরু নয়।{' '}
            {loanBills.map((entry) => (
              <span key={entry.bill.id}>
                {tenantName(entry.bill.tenantId)}-এর কাগজে লোন কিস্তি{' '}
                <span className="font-semibold text-ink">{bnTaka(entry.amount)}</span> আছে।{' '}
              </span>
            ))}
          </p>
        </div>

        <div className="mt-5 w-full space-y-2.5">
          <Link
            to={`/bills/print?month=${month}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-button bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active"
          >
            <PrintIcon />
            প্রিন্ট করুন
          </Link>
          <Link
            to={`/bills/preview?month=${month}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-button border border-secondary bg-surface-raised px-5 py-3 text-base font-semibold text-secondary transition-colors hover:bg-secondary-hover active:bg-secondary-active"
          >
            <ViewIcon />
            বিল দেখুন
          </Link>
          <Link
            to={`/bills/adjustments?month=${month}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-button border border-secondary bg-surface-raised px-5 py-3 text-base font-semibold text-secondary transition-colors hover:bg-secondary-hover active:bg-secondary-active"
          >
            <PlusIcon />
            অ্যাডজাস্টমেন্ট
          </Link>
          {canStartNextMonth ? (
            <Link
              to={`/bills/meters?month=${nextMonth}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-button border border-secondary bg-surface-raised px-5 py-3 text-base font-semibold text-secondary transition-colors hover:bg-secondary-hover active:bg-secondary-active"
            >
              <GaugeIcon />
              পরের মাসের খসড়া শুরু করুন
            </Link>
          ) : null}
          <Link
            to="/"
            className="inline-flex w-full items-center justify-center gap-2 rounded-button px-5 py-3 text-base font-semibold text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
          >
            <HomeIcon />
            হোম
          </Link>
        </div>
      </main>
    </div>
  );
}
