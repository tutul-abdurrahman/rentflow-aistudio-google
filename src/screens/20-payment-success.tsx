import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useRepository } from '../app/repository';
import { bnDigits, bnMonth, bnTaka } from '../lib/format';
import { isMonthKey } from '../lib/screen-month';
import type { Bill, Property, Room, Tenant } from '../lib/types';
import { takaInWords } from './04-receipt-grid-print';

/**
 * 20 — আদায় সফল. Confirms the ledger entry that 19 just wrote. It must NOT
 * offer a payment receipt (handoff §14): the paper was printed before
 * collection, so there is nothing new to hand out.
 *
 * The bill's own month is the natural display source; `?month=` only steers
 * the onward navigation so a refresh keeps the owner on the same cycle.
 */

interface PaymentState {
  billId?: string;
  amount?: number;
  method?: string;
}

function BanknoteIcon() {
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
      <path d="M2 7h20v10H2V7z" />
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M6 10h.01M18 14h.01" />
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

export default function PaymentSuccess() {
  const repo = useRepository();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = (location.state ?? {}) as PaymentState;

  const [loading, setLoading] = useState(true);
  const [bill, setBill] = useState<Bill | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);

  const billId = state.billId;

  const requestedMonth = searchParams.get('month');
  const monthParam = isMonthKey(requestedMonth) ? requestedMonth : '';
  /** No valid ?month= → the collection screen falls back to its own resolution. */
  const collectionBack = monthParam ? `/collection?month=${monthParam}` : '/collection';

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!billId) {
        setLoading(false);
        return;
      }
      const [found, prop, roomList, tenantList] = await Promise.all([
        repo.getBill(billId),
        repo.getProperty(),
        repo.listRooms(),
        repo.listTenants(),
      ]);
      if (!alive) return;
      setBill(found);
      setProperty(prop);
      setRooms(roomList);
      setTenants(tenantList);
      setLoading(false);
    })().catch(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [repo, billId]);

  if (!billId) {
    return <Navigate to={collectionBack} replace />;
  }

  if (loading || !property) {
    return (
      <div className="flex min-h-dvh flex-col bg-surface text-ink" aria-busy="true" aria-label="লোড হচ্ছে">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-10" aria-hidden="true">
          <div className="skeleton mx-auto h-12 w-12 rounded-full" />
          <div className="skeleton mt-4 mx-auto h-6 w-56 max-w-full" />
          <div className="mt-6 rounded-card border border-border bg-surface-raised px-5 py-5">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton mt-3 h-6 w-32" />
            <div className="mt-4 flex justify-between">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-3 w-16" />
            </div>
          </div>
          <div className="skeleton mx-auto mt-8 h-10 w-36 rounded-button" />
        </div>
      </div>
    );
  }

  if (!bill) {
    return <Navigate to={collectionBack} replace />;
  }

  const roomNumber = rooms.find((room) => room.id === bill.roomId)?.number ?? '';
  const tenantName = tenants.find((tenant) => tenant.id === bill.tenantId)?.name ?? '';
  const amount = state.amount ?? 0;
  const dueLeft = Math.max(0, bill.total - bill.paidAmount);
  const methodLabel = state.method ? `${state.method}ে` : '';

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

        <h1 className="mt-6 text-2xl font-bold text-ink">লেজারে আদায় লেখা হয়েছে</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          রুম {bnDigits(roomNumber)} · {tenantName}
          {methodLabel ? ` · ${methodLabel}` : ''}
        </p>

        <p className="mt-5 text-4xl leading-none font-bold tracking-tight text-ink">
          {bnTaka(amount)}
        </p>
        <p className="mt-2 text-xs text-ink-faint">
          {bnMonth(bill.month)} · {takaInWords(amount)} টাকা মাত্র
        </p>

        <div className="mt-6 w-full rounded-card border border-border bg-surface-raised px-4 py-3">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-ink-muted">এই মাসের মোট</span>
            <span className="font-semibold text-ink">{bnTaka(bill.total)}</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between text-sm">
            <span className="text-ink-muted">এই আদায়</span>
            <span className="font-semibold text-ink">{bnTaka(bill.paidAmount)}</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2 text-sm">
            <span className="text-ink-muted">বাকি</span>
            <span className="font-bold text-success">{bnTaka(dueLeft)}</span>
          </div>
          <p className="mt-2 text-xs text-ink-faint">কাগজ আগেই প্রিন্ট হয়ে গেছে। নতুন রিসিট লাগবে না।</p>
        </div>

        <div className="mt-5 w-full space-y-2.5">
          <Link
            to={`/collection?month=${monthParam || bill.month}`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-button bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active"
          >
            <BanknoteIcon />
            আরেকটি আদায়
          </Link>
          <Link
            to="/"
            className="inline-flex w-full items-center justify-center gap-2 rounded-button border border-secondary bg-surface-raised px-5 py-3 text-base font-semibold text-secondary transition-colors hover:bg-secondary-hover active:bg-secondary-active"
          >
            <HomeIcon />
            হোম
          </Link>
        </div>
      </main>
    </div>
  );
}
