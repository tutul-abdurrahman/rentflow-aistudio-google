import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useRepository } from '../app/repository';
import Button from '../components/Button';
import { CalendarIcon, CardIcon, CheckIcon, TrashIcon } from '../components/Icons';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';
import StatusChip from '../components/StatusChip';
import { cn } from '../lib/cn';
import { bnDate, bnDigits, bnMonth, bnNumber } from '../lib/format';
import { LOAN_STATUS_LABELS, addMonths, initials } from '../lib/view';
import { useAsync } from '../lib/useAsync';
import type { Loan, MonthKey, Property, Room, Tenant } from '../lib/types';

interface LoanDetailData {
  loan: Loan;
  tenant: Tenant | null;
  room: Room | null;
  property: Property;
  activeMonth: MonthKey;
}

export default function LoanDetail() {
  const repository = useRepository();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data, loading, error, reload } = useAsync<LoanDetailData | null>(async () => {
    if (!id) return null;
    const loan = await repository.getLoan(id);
    if (!loan) return null;
    const [tenants, rooms, property, activeMonth] = await Promise.all([
      repository.listTenants('active'),
      repository.listRooms(),
      repository.getProperty(),
      repository.getActiveMonth(),
    ]);
    const tenant = tenants.find((candidate) => candidate.id === loan.tenantId) ?? null;
    const room = tenant?.roomId ? (rooms.find((candidate) => candidate.id === tenant.roomId) ?? null) : null;
    return { loan, tenant, room, property, activeMonth };
  }, [repository, id]);

  const [collectOpen, setCollectOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (loading && !data) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="mt-6 h-48 animate-pulse rounded-card bg-surface-soft" aria-hidden="true" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader title="লোন" backTo="/loans" />
        <p className="mt-4 rounded-card border border-border bg-surface-raised px-4 py-6 text-center text-sm text-ink-muted">
          লোন খুঁজে পাওয়া যায়নি।
        </p>
      </div>
    );
  }

  const { loan, tenant, room, property, activeMonth } = data;
  const paid = Math.min(loan.paidInstallments * loan.installmentAmount, loan.totalAmount);
  const balance = Math.max(0, loan.totalAmount - paid);
  // Progress tracks installments paid (matches the '২/৫ কিস্তি' label).
  const percent =
    loan.installmentCount > 0
      ? Math.round((loan.paidInstallments / loan.installmentCount) * 100)
      : 0;
  const isActive = loan.status === 'active';
  const remaining = Math.max(0, loan.installmentCount - loan.paidInstallments);
  const nextIndex = Math.min(loan.paidInstallments + 1, loan.installmentCount);
  const installmentMonth = (index: number) => bnMonth(addMonths(activeMonth, index - loan.paidInstallments));
  const roomLabel = bnDigits(room?.number ?? '—');
  const nextMonthLabel = installmentMonth(nextIndex);

  const collectInstallment = async () => {
    setApplying(true);
    setFormError(null);
    try {
      await repository.payLoanInstallment(loan.id);
      setCollectOpen(false);
      reload();
    } catch {
      setCollectOpen(false);
      setFormError('কিস্তি আদায় করা যায়নি। আবার চেষ্টা করুন।');
    } finally {
      setApplying(false);
    }
  };

  const cancelLoan = async () => {
    setApplying(true);
    setFormError(null);
    try {
      await repository.cancelLoan(loan.id);
      navigate('/loans');
    } catch {
      setCancelOpen(false);
      setFormError('লোন বাতিল করা যায়নি। আবার চেষ্টা করুন।');
      setApplying(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="লোন"
        subtitle={property.name}
        backTo="/loans"
        action={
          <span className="ml-auto shrink-0 rounded-pill border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink-faint">
            {bnMonth(activeMonth)}
          </span>
        }
      />

      <section className="mt-4 rounded-card border border-border bg-surface-raised p-5" aria-label="লোন পরিচিতি">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-tint text-lg font-bold text-ink">
            {tenant ? initials(tenant.name) : '—'}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-ink">{tenant?.name ?? 'অজানা রেন্টি'}</h2>
            <p className="mt-0.5 text-sm text-ink-muted">রুম {roomLabel}</p>
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
        <div className="mt-4 flex items-center justify-between gap-3 rounded-md bg-surface-sunken px-4 py-3">
          <div>
            <p className="text-xs text-ink-faint">পরিমাণ</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">৳{bnNumber(loan.totalAmount)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-faint">লোনের তারিখ</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">{bnDate(loan.createdAt.slice(0, 10))}</p>
          </div>
        </div>
      </section>

      <div className="lg:mt-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
        <div>
          <section className="mt-3 rounded-card border border-border bg-surface-raised p-5 lg:mt-0" aria-label="লোন অগ্রগতি">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-ink">অগ্রগতি</h2>
              <span className="text-xs font-medium text-ink-faint">
                {bnDigits(loan.paidInstallments)}/{bnDigits(loan.installmentCount)} কিস্তি
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-pill bg-info-tint">
              <div className="h-full rounded-pill bg-info" style={{ width: `${percent}%` }} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-md bg-surface-sunken px-4 py-3">
                <p className="text-xs text-ink-faint">পরিশোধিত</p>
                <p className="mt-0.5 text-lg font-bold text-ink">৳{bnNumber(paid)}</p>
              </div>
              <div className="rounded-md bg-surface-sunken px-4 py-3">
                <p className="text-xs text-ink-faint">মোট</p>
                <p className="mt-0.5 text-lg font-bold text-ink">৳{bnNumber(loan.totalAmount)}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-md bg-primary-tint px-4 py-3">
              <span className="text-sm font-medium text-ink">ব্যালেন্স</span>
              <span className="text-xl font-bold text-ink">৳{bnNumber(balance)}</span>
            </div>
          </section>

          <section className="mt-3 rounded-card border border-border bg-surface-raised p-5" aria-label="বিলে যোগ করুন">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info-tint text-info">
                <CardIcon size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug text-ink">মাসিক বিলে যোগ</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  চালু থাকলে কিস্তি প্রতি মাসের ভাড়া বিলে যোগ হয়। বন্ধ থাকলে আলাদা হিসাব।
                </p>
              </div>
              {loan.addToBill ? (
                <StatusChip variant="loan" label="চালু" />
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-surface-soft px-3 py-1 text-xs font-medium text-ink-faint">
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" aria-hidden="true" />
                  বন্ধ
                </span>
              )}
            </div>
          </section>

          {formError ? (
            <p role="alert" className="mt-3 rounded-card border border-danger bg-danger-tint px-4 py-3 text-sm text-danger">
              {formError}
            </p>
          ) : null}

          {isActive ? (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={() => setCancelOpen(true)}
                className="inline-flex items-center gap-2 rounded-button px-3 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-tint"
              >
                <TrashIcon size={16} />
                লোন বাতিল করুন
              </button>
            </div>
          ) : null}
        </div>

        <section className="mt-3 rounded-card border border-border bg-surface-raised lg:mt-0" aria-label="কিস্তি সময়সূচী">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
              <CalendarIcon className="shrink-0 text-primary" />
              কিস্তি সময়সূচী
            </h2>
            {isActive && remaining > 0 ? (
              <button
                type="button"
                onClick={() => setCollectOpen(true)}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-button bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active"
              >
                <CardIcon size={16} />
                কিস্তি আদায়
              </button>
            ) : null}
          </div>

          <div className="divide-y divide-border">
            {Array.from({ length: loan.installmentCount }, (_, index) => index + 1).map((number) => {
              const done = number <= loan.paidInstallments;
              return (
                <div key={number} className="flex items-center gap-3 px-5 py-3.5">
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                      done ? 'bg-success-tint text-success' : 'bg-warning-tint text-warning',
                    )}
                  >
                    {bnDigits(number)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">কিস্তি {bnDigits(number)}</p>
                    <p className="text-xs text-ink-muted">{installmentMonth(number)}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-ink">৳{bnNumber(loan.installmentAmount)}</span>
                  {done ? (
                    <StatusChip variant="paid" label="পরিশোধিত" />
                  ) : (
                    <StatusChip variant="due" />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <Sheet open={collectOpen} onClose={() => setCollectOpen(false)} ariaLabel="কিস্তি আদায় নিশ্চিত করুন">
        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-info-tint text-info">
            <CardIcon size={22} />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink">কিস্তি আদায়</h2>
            <p className="text-sm text-ink-muted">
              {tenant?.name ?? 'রেন্টি'} · রুম {roomLabel} · {nextMonthLabel}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-input border border-border bg-surface-sunken px-4 py-3">
          <span className="text-sm text-ink-muted">আদায়ের পরিমাণ</span>
          <span className="text-md font-semibold text-ink">৳{bnNumber(loan.installmentAmount)}</span>
        </div>
        <div className="mt-4 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setCollectOpen(false)}>
            বাতিল
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={applying}
            onClick={collectInstallment}
            leadingIcon={<CheckIcon size={18} />}
          >
            {applying ? 'আদায় হচ্ছে…' : 'আদায় নিশ্চিত করুন'}
          </Button>
        </div>
      </Sheet>

      <Sheet open={cancelOpen} onClose={() => setCancelOpen(false)} ariaLabel="লোন বাতিল নিশ্চিত করুন">
        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-tint text-danger">
            <TrashIcon size={22} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-ink">লোন বাতিল করবেন?</h2>
            <p className="text-sm text-ink-muted">
              {tenant?.name ?? 'রেন্টি'} · বাকি ৳{bnNumber(balance)}। বাতিল করলে কিস্তি আর বিলে উঠবে না।
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setCancelOpen(false)}>
            বাতিল
          </Button>
          <button
            type="button"
            disabled={applying}
            onClick={cancelLoan}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-button bg-danger px-5 py-3 text-base font-semibold text-surface-raised transition-opacity hover:opacity-90 active:opacity-100 disabled:opacity-60"
          >
            <TrashIcon size={18} />
            {applying ? 'বাতিল হচ্ছে…' : 'লোন বাতিল করুন'}
          </button>
        </div>
      </Sheet>

      <p className="mt-6 text-center text-xs text-ink-faint">
        <Link to="/loans" className="text-primary">
          লোন তালিকায় ফিরে যান
        </Link>
      </p>
    </div>
  );
}
