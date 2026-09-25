import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useRepository } from '../app/repository';
import Button from '../components/Button';
import { CheckCircleIcon, LogOutIcon, UserIcon, WalletIcon } from '../components/Icons';
import PageHeader from '../components/PageHeader';
import RadioCard from '../components/RadioCard';
import Sheet from '../components/Sheet';
import StatusChip from '../components/StatusChip';
import { bnDigits, bnMonth, bnTaka } from '../lib/format';
import {
  RESOLUTION_DESCRIPTIONS,
  RESOLUTION_LABELS,
  initials,
  openAmount,
} from '../lib/view';
import { useAsync } from '../lib/useAsync';
import type { Bill, MonthKey, Property, Room, Tenant } from '../lib/types';
import type { MoveOutInput } from '../lib/repository/types';

interface MoveOutData {
  tenant: Tenant;
  room: Room | null;
  property: Property;
  activeMonth: MonthKey;
  bill: Bill | null;
}

const RESOLUTIONS: MoveOutInput['resolution'][] = ['refund', 'hold', 'adjust'];

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function MoveOut() {
  const repository = useRepository();
  const { id } = useParams<{ id: string }>();

  const { data, loading, error } = useAsync<MoveOutData | null>(async () => {
    if (!id) return null;
    const tenant = await repository.getTenant(id);
    if (!tenant) return null;
    const [rooms, property, activeMonth] = await Promise.all([
      repository.listRooms(),
      repository.getProperty(),
      repository.getActiveMonth(),
    ]);
    const bills = await repository.listBills(activeMonth);
    const bill = bills.find((candidate) => candidate.tenantId === tenant.id) ?? null;
    const room = rooms.find((candidate) => candidate.id === tenant.roomId) ?? null;
    return { tenant, room, property, activeMonth, bill };
  }, [repository, id]);

  const [resolution, setResolution] = useState<MoveOutInput['resolution']>('refund');
  const [date, setDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!loading && (error || !data)) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader title="মুভ আউট" backTo="/tenants" />
        <p className="mt-4 rounded-card border border-border bg-surface-raised px-4 py-6 text-center text-sm text-ink-muted">
          রেন্টি খুঁজে পাওয়া যায়নি।
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="mt-6 h-48 animate-pulse rounded-card bg-surface-soft" aria-hidden="true" />
      </div>
    );
  }

  const { tenant, room, property, activeMonth, bill } = data;
  const outstanding = bill ? openAmount(bill.total, bill.paidAmount) : 0;

  const applyMoveOut = async () => {
    setApplying(true);
    setFormError(null);
    try {
      await repository.moveOut(tenant.id, {
        date,
        resolution,
        note: note.trim() ? note.trim() : undefined,
      });
      setSheetOpen(false);
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setSheetOpen(false);
      setFormError('মুভ আউট সম্পন্ন করা যায়নি। আবার চেষ্টা করুন।');
    } finally {
      setApplying(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader title="মুভ আউট" subtitle={property.name} backTo={`/tenants/${tenant.id}`} />
        <div className="mt-4 flex flex-col items-center rounded-card border border-border bg-surface-raised px-6 py-12 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-tint text-primary">
            <CheckCircleIcon size={44} strokeWidth={2.2} />
          </span>
          <h2 className="mt-5 text-xl font-bold text-ink">মুভ আউট সম্পন্ন!</h2>
          <p className="mt-1.5 text-sm text-ink-muted">প্রাক্তন রেন্টি আর্কাইভে সেভ হয়েছে</p>
          <div className="mt-7 w-full space-y-2.5">
            <Link
              to="/tenants/archive"
              className="inline-flex w-full items-center justify-center gap-2 rounded-button bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active"
            >
              <WalletIcon size={18} />
              আর্কাইভ দেখুন
            </Link>
            <Link
              to="/tenants"
              className="inline-flex w-full items-center justify-center gap-2 rounded-button border border-secondary bg-surface-raised px-5 py-3 text-base font-semibold text-secondary transition-colors hover:bg-secondary-hover active:bg-secondary-active"
            >
              রেন্টি তালিকা
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="মুভ আউট"
        subtitle={property.name}
        backTo={`/tenants/${tenant.id}`}
        action={
          <span className="ml-auto shrink-0 rounded-pill border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink-faint">
            {bnMonth(activeMonth)}
          </span>
        }
      />

      <section className="mt-4 rounded-card border border-border bg-surface-raised" aria-label="রেন্টি">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <UserIcon className="shrink-0 text-primary" />
          <h2 className="text-base font-semibold text-ink">রেন্টি</h2>
        </div>
        <div className="flex items-center gap-3 px-5 py-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-sm font-bold text-ink">
            {initials(tenant.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-ink">{tenant.name}</p>
              <StatusChip variant="paid" label="সক্রিয়" />
            </div>
            <p className="mt-0.5 text-xs text-ink-muted">
              রুম {bnDigits(room?.number ?? '—')} · মাসিক ভাড়া {bnTaka(room?.rent ?? 0)}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-3 rounded-card border border-border bg-surface-raised" aria-label="চূড়ান্ত হিসাব">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <WalletIcon className="shrink-0 text-primary" />
          <h2 className="text-base font-semibold text-ink">চূড়ান্ত হিসাব</h2>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-3.5">
          <span className="shrink-0 text-sm text-ink-muted">মোট বকেয়া</span>
          <span className={outstanding > 0 ? 'text-sm font-semibold text-danger' : 'text-sm font-semibold text-success'}>
            {bnTaka(outstanding)}
          </span>
        </div>
      </section>

      <section className="mt-3 rounded-card border border-border bg-surface-raised" aria-label="জামানত কী করবেন">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <CheckCircleIcon className="shrink-0 text-primary" />
          <h2 className="text-base font-semibold text-ink">জামানত কী করবেন</h2>
        </div>
        <div className="space-y-2 p-4" role="radiogroup" aria-label="জামানতের ব্যবস্থা">
          {RESOLUTIONS.map((option) => (
            <RadioCard
              key={option}
              name="move-out-resolution"
              value={option}
              checked={resolution === option}
              onChange={(value) => setResolution(value as MoveOutInput['resolution'])}
              title={RESOLUTION_LABELS[option]}
              description={RESOLUTION_DESCRIPTIONS[option]}
            />
          ))}
        </div>
      </section>

      <section className="mt-3 rounded-card border border-border bg-surface-raised" aria-label="মুভ আউটের তথ্য">
        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <div>
            <label htmlFor="mo-date" className="mb-1.5 block text-sm font-medium text-ink">
              মুভ আউটের তারিখ <span className="text-danger">*</span>
            </label>
            <input
              id="mo-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-input border border-border bg-surface-raised px-4 py-3 text-md text-ink transition-colors focus:border-border-focus"
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="mo-note" className="mb-1.5 block text-sm font-medium text-ink">
              নোট (ইচ্ছা হলে)
            </label>
            <textarea
              id="mo-note"
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="যেকোনো নোট লিখুন…"
              className="w-full resize-none rounded-input border border-border bg-surface-raised px-4 py-3 text-md text-ink transition-colors placeholder:text-ink-faint focus:border-border-focus"
            />
          </div>
        </div>
      </section>

      {formError ? (
        <p role="alert" className="mt-3 rounded-card border border-danger bg-danger-tint px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <div className="mt-5 pb-2">
        <Button
          fullWidth
          disabled={!date}
          onClick={() => setSheetOpen(true)}
          leadingIcon={<LogOutIcon size={18} />}
        >
          মুভ আউট সম্পন্ন করুন
        </Button>
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} ariaLabel="মুভ আউট নিশ্চিত করুন">
        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-tint text-danger">
            <LogOutIcon size={22} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-ink">মুভ আউট নিশ্চিত করুন</h2>
            <p className="text-sm text-ink-muted">
              {tenant.name} প্রাক্তন রেন্টি হবেন — হিস্টরি ২ বছর থেকে যাবে
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setSheetOpen(false)}>
            বাতিল
          </Button>
          <button
            type="button"
            disabled={applying}
            onClick={applyMoveOut}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-button bg-danger px-5 py-3 text-base font-semibold text-surface-raised transition-opacity hover:opacity-90 active:opacity-100 disabled:opacity-60"
          >
            <CheckCircleIcon size={18} />
            {applying ? 'সম্পন্ন হচ্ছে…' : 'সম্পন্ন করুন'}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
