import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepository } from '../app/repository';
import { CardIcon, ChevronRightIcon, PlusIcon } from '../components/Icons';
import PageHeader from '../components/PageHeader';
import StatusChip from '../components/StatusChip';
import { cn } from '../lib/cn';
import { bnDigits, bnNumber } from '../lib/format';
import { LOAN_STATUS_LABELS, initials, installmentFraction } from '../lib/view';
import { useAsync } from '../lib/useAsync';
import type { Loan, MonthKey, Property, Room, Tenant } from '../lib/types';

type Filter = 'all' | 'active' | 'closed';

interface LoanListData {
  loans: Loan[];
  tenants: Tenant[];
  rooms: Room[];
  property: Property;
  activeMonth: MonthKey;
}

const CHIP_BASE = 'inline-flex items-center gap-1 rounded-pill border px-3.5 py-1.5 text-sm transition-colors';
const CHIP_IDLE = 'border-border bg-surface-raised font-medium text-ink-muted hover:bg-surface-soft';
const CHIP_ACTIVE = 'border-primary bg-primary-tint font-semibold text-ink';

function SkeletonCard() {
  return (
    <div className="rounded-card border border-border bg-surface-raised p-4">
      <div className="flex items-center gap-3">
        <span className="skeleton h-11 w-11 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="skeleton h-4 w-2/3 rounded-pill" />
          <div className="skeleton h-3 w-1/3 rounded-pill" />
        </div>
        <span className="skeleton h-5 w-16 shrink-0 rounded-pill" />
      </div>
      <div className="skeleton mt-4 h-14 w-full rounded-md" />
      <div className="skeleton mt-3 h-2 w-full rounded-pill" />
    </div>
  );
}

export default function LoanList() {
  const repository = useRepository();
  const [filter, setFilter] = useState<Filter>('all');

  const { data, loading, error } = useAsync<LoanListData>(async () => {
    const [loans, tenants, rooms, property, activeMonth] = await Promise.all([
      repository.listLoans(),
      repository.listTenants('active'),
      repository.listRooms(),
      repository.getProperty(),
      repository.getActiveMonth(),
    ]);
    return { loans, tenants, rooms, property, activeMonth };
  }, [repository]);

  const loans = data?.loans ?? [];
  const tenantById = useMemo(() => new Map((data?.tenants ?? []).map((tenant) => [tenant.id, tenant])), [data?.tenants]);
  const roomById = useMemo(() => new Map((data?.rooms ?? []).map((room) => [room.id, room])), [data?.rooms]);

  const activeLoans = loans.filter((loan) => loan.status === 'active');
  const closedCount = loans.length - activeLoans.length;
  const totalDisbursed = activeLoans.reduce((sum, loan) => sum + loan.totalAmount, 0);
  const outstanding = activeLoans.reduce(
    (sum, loan) => sum + Math.max(0, loan.totalAmount - loan.paidInstallments * loan.installmentAmount),
    0,
  );

  const visible =
    filter === 'all'
      ? loans
      : filter === 'active'
        ? activeLoans
        : loans.filter((loan) => loan.status !== 'active');

  return (
    <>
      <PageHeader
        title="লোন"
        subtitle={data?.property.name}
        backTo="/"
        action={
          <Link
            to="/loans/add"
            className="ml-auto inline-flex shrink-0 items-center justify-center gap-1.5 rounded-button bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active"
          >
            <PlusIcon size={16} />
            নতুন লোন
          </Link>
        }
      />

      <section className="mt-4 grid grid-cols-3 gap-3" aria-label="লোন সারসংক্ষেপ">
        <div className="rounded-card border border-border bg-surface-raised p-4">
          <p className="text-xs text-ink-faint">চলমান</p>
          <p className="mt-1.5 text-xl font-bold leading-none text-info">{bnDigits(activeLoans.length)}</p>
        </div>
        <div className="rounded-card border border-border bg-surface-raised p-4">
          <p className="text-xs text-ink-faint">মোট বিতরণ</p>
          <p className="mt-1.5 text-xl font-bold leading-none text-ink">৳{bnNumber(totalDisbursed)}</p>
        </div>
        <div className="rounded-card border border-border bg-surface-raised p-4">
          <p className="text-xs text-ink-faint">বাকি</p>
          <p className="mt-1.5 text-xl font-bold leading-none text-warning">৳{bnNumber(outstanding)}</p>
        </div>
      </section>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={filter === 'all'}
          onClick={() => setFilter('all')}
          className={cn(CHIP_BASE, filter === 'all' ? CHIP_ACTIVE : CHIP_IDLE)}
        >
          সব {bnDigits(loans.length)}
        </button>
        <button
          type="button"
          aria-pressed={filter === 'active'}
          onClick={() => setFilter('active')}
          className={cn(CHIP_BASE, filter === 'active' ? CHIP_ACTIVE : CHIP_IDLE)}
        >
          চলমান {bnDigits(activeLoans.length)}
        </button>
        <button
          type="button"
          aria-pressed={filter === 'closed'}
          onClick={() => setFilter('closed')}
          className={cn(CHIP_BASE, filter === 'closed' ? CHIP_ACTIVE : CHIP_IDLE)}
        >
          বন্ধ {bnDigits(closedCount)}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded-card border border-danger bg-danger-tint px-4 py-3 text-sm text-danger">
          লোন তালিকা লোড করা যায়নি।
        </p>
      ) : loading && !data ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2 lg:gap-4" aria-hidden="true">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : loans.length === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-card border border-border bg-surface-raised px-6 py-12 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-tint text-primary">
            <CardIcon size={28} />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-ink">কোনো লোন নেই</h2>
          <p className="mt-1.5 max-w-60 text-sm text-ink-muted">
            রেন্টিকে টাকা ধার দিলে এখানে লোন হিসেবে রাখুন — কিস্তিতে ফেরত আদায় করুন।
          </p>
          <Link
            to="/loans/add"
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-button bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active"
          >
            <PlusIcon size={18} />
            প্রথম লোন দিন
          </Link>
        </div>
      ) : (
        <section className="mt-4 grid gap-3 lg:grid-cols-2 lg:gap-4" aria-label="লোন তালিকা">
          {visible.map((loan) => {
            const tenant = tenantById.get(loan.tenantId);
            const room = tenant?.roomId ? roomById.get(tenant.roomId) : undefined;
            const paid = Math.min(loan.paidInstallments * loan.installmentAmount, loan.totalAmount);
            const balance = Math.max(0, loan.totalAmount - paid);
            const isActive = loan.status === 'active';
            // Progress tracks installments paid (matches the '২/৫ কিস্তি' label).
            const percent =
              loan.installmentCount > 0
                ? Math.round((loan.paidInstallments / loan.installmentCount) * 100)
                : 0;

            return (
              <Link
                key={loan.id}
                to={`/loans/${loan.id}`}
                className="rounded-card border border-border bg-surface-raised p-4 transition-colors hover:bg-surface-soft"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-sm font-bold text-ink">
                    {tenant ? initials(tenant.name) : '—'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{tenant?.name ?? 'অজানা রেন্টি'}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {room ? `রুম ${bnDigits(room.number)}` : 'রুম নেই'}
                    </p>
                  </div>
                  {isActive ? (
                    <StatusChip variant="loan" label="চলমান" />
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-surface-soft px-3 py-1 text-xs font-medium text-ink-faint">
                      <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" aria-hidden="true" />
                      {LOAN_STATUS_LABELS[loan.status]}
                    </span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 rounded-md bg-surface-sunken px-3 py-2.5 text-center">
                  <div>
                    <p className="text-xs text-ink-faint">পরিমাণ</p>
                    <p className="mt-0.5 text-sm font-semibold text-ink">৳{bnNumber(loan.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-faint">পরিশোধিত</p>
                    <p className="mt-0.5 text-sm font-semibold text-ink">৳{bnNumber(paid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-ink-faint">ব্যালেন্স</p>
                    <p className={cn('mt-0.5 text-sm font-bold', balance > 0 ? 'text-warning' : 'text-ink-faint')}>
                      ৳{bnNumber(balance)}
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-ink-faint">অগ্রগতি</p>
                    <p className="text-xs font-medium text-ink-muted">
                      {installmentFraction(loan.paidInstallments, loan.installmentCount)}
                    </p>
                  </div>
                  <div className={cn('mt-1.5 h-2 w-full overflow-hidden rounded-pill', isActive ? 'bg-info-tint' : 'bg-surface-soft')}>
                    <div
                      className={cn('h-full rounded-pill', isActive ? 'bg-info' : 'bg-ink-faint')}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  {loan.addToBill ? (
                    <StatusChip variant="loan" label="মাসিক বিলে যোগ" />
                  ) : (
                    <p className="min-w-0 truncate text-xs text-ink-muted">আলাদা হিসাব</p>
                  )}
                  <ChevronRightIcon size={18} className="shrink-0 text-ink-faint" />
                </div>
              </Link>
            );
          })}
          {visible.length === 0 ? <p className="text-sm text-ink-muted lg:col-span-2">কিছু পাওয়া যায়নি।</p> : null}
        </section>
      )}
    </>
  );
}
