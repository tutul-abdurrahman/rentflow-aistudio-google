import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRepository } from '../app/repository';
import EmptyState from '../components/EmptyState';
import Sheet from '../components/Sheet';
import { bnDate, bnDigits, bnMonth, bnTaka } from '../lib/format';
import type { CashflowRow, FinanceEntry } from '../lib/types';

/**
 * Screen 26 — আয়-ব্যয় list (design-output/screens/26-income-expense-list.html).
 *
 * Data rule (handoff §16 brief): entries come from listFinance(activeMonth);
 * the month header numbers come from getCashflow([activeMonth]) so the income
 * figure is the month's billed total, matching 28. Nothing is hardcoded.
 */

type KindFilter = 'all' | 'income' | 'expense';

const BACK_CLASS =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-soft';

/** '2026-08-05' → '৫ আগস্ট' (the list groups by day, not full date). */
function dayMonth(iso: string): string {
  return bnDate(iso).split(' ').slice(0, 2).join(' ');
}

function CalendarIcon() {
  return (
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
      <path d="M6 3v2M18 3v2M3 8h18" />
      <rect x="3" y="5" width="18" height="16" rx="2" />
    </svg>
  );
}

function PlusIcon() {
  return (
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
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ArrowUpIcon() {
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
      <path d="M19 5 5 19M19 13v6h-6" />
    </svg>
  );
}

function ArrowDownIcon() {
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
      <path d="M5 19 19 5M5 11h6v6" />
    </svg>
  );
}

function TrashIcon({ size = 18 }: { size?: number }) {
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
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 7H5a2 2 0 0 1-2-2 2 2 0 0 1 2-2h13v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15v-4" />
      <path d="M21 12h-4a2 2 0 0 0 0 4h4z" />
    </svg>
  );
}

/** one skeleton row of the annotated loading variant */
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-4" aria-hidden="true">
      <span className="h-9 w-9 shrink-0 rounded-full bg-surface-soft" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-32 rounded bg-surface-soft" />
        <div className="h-3 w-24 rounded bg-surface-soft" />
      </div>
      <div className="h-4 w-16 rounded bg-surface-soft" />
    </div>
  );
}

export default function IncomeExpenseList() {
  const repo = useRepository();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [cash, setCash] = useState<CashflowRow | null>(null);
  const [filter, setFilter] = useState<KindFilter>('all');
  const [reloadKey, setReloadKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<FinanceEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const activeMonth = await repo.getActiveMonth();
      const [rows, cashRows, property] = await Promise.all([
        repo.listFinance(activeMonth),
        repo.getCashflow([activeMonth]),
        repo.getProperty(),
      ]);
      if (!alive) return;
      setMonth(activeMonth);
      setEntries(rows);
      setCash(cashRows[0] ?? null);
      setPropertyName(property.name);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [repo, reloadKey]);

  const filtered = useMemo(
    () => (filter === 'all' ? entries : entries.filter((entry) => entry.kind === filter)),
    [entries, filter],
  );

  const groups = useMemo(() => {
    const map = new Map<string, FinanceEntry[]>();
    for (const entry of filtered) {
      const bucket = map.get(entry.date);
      if (bucket) bucket.push(entry);
      else map.set(entry.date, [entry]);
    }
    return [...map.entries()];
  }, [filtered]);

  const income = cash?.billed ?? 0;
  const expense = cash?.expenses ?? 0;
  const net = cash?.net ?? 0;

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await repo.deleteFinanceEntry(deleteTarget.id);
      setDeleteTarget(null);
      setReloadKey((key) => key + 1);
    } finally {
      setDeleting(false);
    }
  };

  const filters: { key: KindFilter; label: string }[] = [
    { key: 'all', label: 'সব' },
    { key: 'income', label: 'আয়' },
    { key: 'expense', label: 'ব্যয়' },
  ];

  return (
    <>
      <header className="pt-5 lg:flex lg:items-start lg:justify-between lg:pt-8">
        <div className="flex items-start gap-2.5">
          <Link to="/" className={BACK_CLASS} aria-label="পেছনে যান">
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
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-ink">আয়-ব্যয়</h1>
            <p className="mt-0.5 text-sm text-ink-muted">
              {propertyName}
              {month ? ` · ${bnMonth(month)}` : ''}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 lg:mt-0 lg:shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-raised px-3.5 py-2 text-sm font-semibold text-ink">
            <CalendarIcon />
            {month ? bnMonth(month) : '—'}
          </span>
          <Link
            to="/finance/add"
            className="inline-flex items-center justify-center gap-2 rounded-button bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active"
          >
            <PlusIcon />
            নতুন
          </Link>
        </div>
      </header>

      {/* summary chips */}
      <section
        className="mt-4 overflow-hidden rounded-card border border-border bg-surface-raised"
        aria-label={month ? `${bnMonth(month)} আয়-ব্যয় সারসংক্ষেপ` : 'আয়-ব্যয় সারসংক্ষেপ'}
      >
        <div className="grid grid-cols-3 divide-x divide-border">
          <div className="px-3 py-4 text-center sm:px-4">
            <p className="text-xs text-ink-faint">এই মাসে আয়</p>
            <p className="mt-1 text-lg font-bold leading-none text-success sm:text-xl">
              {cash ? bnTaka(income) : '—'}
            </p>
          </div>
          <div className="px-3 py-4 text-center sm:px-4">
            <p className="text-xs text-ink-faint">ব্যয়</p>
            <p className="mt-1 text-lg font-bold leading-none text-ink sm:text-xl">
              {cash ? bnTaka(expense) : '—'}
            </p>
          </div>
          <div className="px-3 py-4 text-center sm:px-4">
            <p className="text-xs text-ink-faint">নিট</p>
            <p
              className={`mt-1 text-lg font-bold leading-none sm:text-xl ${
                net < 0 ? 'text-danger' : 'text-success'
              }`}
            >
              {cash ? `${net < 0 ? '−' : '+'}${bnTaka(Math.abs(net))}` : '—'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-soft px-4 py-2 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            মোট আয় − মোট ব্যয়
          </span>
          <Link to="/finance/cashflow" className="font-semibold text-primary">
            ক্যাশফ্লো দেখুন
          </Link>
        </div>
      </section>

      {/* filter tabs */}
      <div
        className="mt-4 flex gap-1.5 rounded-pill border border-border bg-surface-raised p-1 md:inline-flex"
        role="group"
        aria-label="এন্ট্রির ধরন ফিল্টার"
      >
        {filters.map(({ key, label }) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(key)}
              className={`flex-1 rounded-pill px-4 py-1.5 text-sm transition-colors md:flex-none ${
                active
                  ? 'bg-primary font-semibold text-on-primary'
                  : 'font-medium text-ink-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* entries */}
      <section className="mt-4" aria-label="এন্ট্রির তালিকা">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">এই মাসের এন্ট্রি</h2>
          <span className="text-xs font-medium text-ink-faint">
            {bnDigits(filtered.length)}টি এন্ট্রি
          </span>
        </div>

        {loading ? (
          <div
            className="mt-2 divide-y divide-border rounded-card border border-border bg-surface-raised"
            aria-hidden="true"
          >
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            className="mt-2"
            icon={<WalletIcon />}
            title="কোনো এন্ট্রি নেই"
            caption="এই মাসে আয় বা ব্যয়ের কোনো হিসাব যোগ করা হয়নি।"
            actionLabel="নতুন এন্ট্রি যোগ করুন"
            onAction={() => navigate('/finance/add')}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            className="mt-2"
            icon={<WalletIcon />}
            title="কোনো এন্ট্রি নেই"
            caption="এই ফিল্টারে এই মাসের কোনো এন্ট্রি নেই।"
          />
        ) : (
          <div className="mt-2 divide-y divide-border rounded-card border border-border bg-surface-raised">
            {groups.map(([date, rows]) => (
              <div key={date}>
                <div className="flex items-center bg-surface-soft px-4 py-2 text-xs font-medium text-ink-faint">
                  <span>{dayMonth(date)}</span>
                </div>

                {rows.map((entry) => {
                  const isIncome = entry.kind === 'income';
                  const title = entry.note ?? entry.category;
                  return (
                    <div key={entry.id} className="flex items-start gap-3 p-4">
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          isIncome
                            ? 'bg-success-tint text-success'
                            : 'bg-danger-tint text-danger'
                        }`}
                      >
                        {isIncome ? <ArrowUpIcon /> : <ArrowDownIcon />}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-ink">{title}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          <span
                            className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium ${
                              isIncome
                                ? 'bg-success-tint text-success'
                                : 'bg-danger-tint text-danger'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isIncome ? 'bg-success' : 'bg-danger'
                              }`}
                              aria-hidden="true"
                            />
                            {isIncome ? 'আয়' : 'ব্যয়'}
                          </span>
                          <span className="ml-1.5">
                            {entry.category} · {dayMonth(entry.date)}
                          </span>
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={`text-sm font-bold ${
                            isIncome ? 'text-success' : 'text-ink'
                          }`}
                        >
                          {isIncome ? '+' : ''}
                          {bnTaka(entry.amount)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(entry)}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-danger-tint hover:text-danger"
                        aria-label={`${title} মুছুন`}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* delete confirm sheet — role=dialog via Sheet */}
      <Sheet
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        ariaLabel="খরচ মুছে ফেলার নিশ্চিতকরণ"
      >
        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-tint text-danger">
            <TrashIcon size={22} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-ink">এই খরচ মুছবেন?</h2>
            <p className="text-sm text-ink-muted">
              {deleteTarget ? `${deleteTarget.note ?? deleteTarget.category} · ${bnTaka(deleteTarget.amount)}। ` : ''}
              এই এন্ট্রি স্থায়ীভাবে মুছে যাবে।
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            className="inline-flex flex-1 items-center justify-center rounded-button border border-secondary bg-transparent px-5 py-3 text-base font-semibold text-secondary transition-colors hover:bg-secondary-hover active:bg-secondary-active"
          >
            বাতিল
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={deleting}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-button bg-danger px-5 py-3 text-base font-semibold text-surface-raised transition-opacity hover:opacity-90 active:opacity-100 disabled:opacity-60"
          >
            <TrashIcon />
            মুছে ফেলুন
          </button>
        </div>
      </Sheet>
    </>
  );
}
