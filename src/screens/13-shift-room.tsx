import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useRepository } from '../app/repository';
import Button from '../components/Button';
import { CheckIcon, InfoIcon, ShuffleIcon, UserIcon } from '../components/Icons';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';
import { cn } from '../lib/cn';
import { bnDigits, bnMonth, bnTaka } from '../lib/format';
import { initials, tenantNameByRoom } from '../lib/view';
import { useAsync } from '../lib/useAsync';
import type { MonthKey, Property, Room, Tenant } from '../lib/types';

interface ShiftData {
  tenant: Tenant;
  rooms: Room[];
  activeTenants: Tenant[];
  property: Property;
  activeMonth: MonthKey;
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function ShiftRoom() {
  const repository = useRepository();
  const { id } = useParams<{ id: string }>();

  const { data, loading, error } = useAsync<ShiftData | null>(async () => {
    if (!id) return null;
    const tenant = await repository.getTenant(id);
    if (!tenant) return null;
    const [rooms, activeTenants, property, activeMonth] = await Promise.all([
      repository.listRooms(),
      repository.listTenants('active'),
      repository.getProperty(),
      repository.getActiveMonth(),
    ]);
    return { tenant, rooms, activeTenants, property, activeMonth };
  }, [repository, id]);

  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(todayIso());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ from: string; to: string } | null>(null);

  if (!loading && (error || !data)) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader title="রুম শিফট" backTo="/tenants" />
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

  const { tenant, rooms, activeTenants, property, activeMonth } = data;
  const occupantByRoom = tenantNameByRoom(activeTenants);
  const currentRoom = rooms.find((room) => room.id === tenant.roomId) ?? null;
  const options = rooms.filter((room) => room.id !== tenant.roomId);
  const vacantOptions = options.filter((room) => !occupantByRoom.has(room.id));
  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) ?? null;
  const fromLabel = bnDigits(currentRoom?.number ?? '—');
  const toLabel = bnDigits(selectedRoom?.number ?? '—');

  const applyShift = async () => {
    if (!selectedRoomId) return;
    setApplying(true);
    setFormError(null);
    try {
      await repository.shiftRoom(tenant.id, selectedRoomId, effectiveDate);
      setSheetOpen(false);
      setSuccess({ from: fromLabel, to: toLabel });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : '';
      setSheetOpen(false);
      setFormError(code === 'ROOM_OCCUPIED' ? 'এই রুমে ইতিমধ্যে একজন রেন্টি আছেন।' : 'রুম শিফট করা যায়নি। আবার চেষ্টা করুন।');
    } finally {
      setApplying(false);
    }
  };

  if (success) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader title="রুম শিফট" subtitle={property.name} backTo={`/tenants/${tenant.id}`} />
        <div className="mt-4 flex flex-col items-center rounded-card border border-border bg-surface-raised px-6 py-12 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-tint text-primary">
            <CheckIcon size={44} strokeWidth={2.2} />
          </span>
          <h2 className="mt-5 text-xl font-bold text-ink">রুম শিফট সম্পন্ন!</h2>
          <p className="mt-1.5 text-sm text-ink-muted">
            {tenant.name} · {success.from} → {success.to}
          </p>
          <div className="mt-7 w-full space-y-2.5">
            <Link
              to={`/tenants/${tenant.id}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-button bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active"
            >
              <UserIcon size={18} />
              প্রোফাইল দেখুন
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
        title="রুম শিফট"
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
            <p className="truncate text-sm font-semibold text-ink">{tenant.name}</p>
            <p className="mt-0.5 text-xs text-ink-muted">মাসিক ভাড়া {bnTaka(currentRoom?.rent ?? 0)}</p>
          </div>
          <span className="shrink-0 rounded-pill border border-border bg-surface-soft px-2.5 py-1 text-xs font-medium text-ink-muted">
            বর্তমান রুম {fromLabel}
          </span>
        </div>
      </section>

      <section className="mt-3 rounded-card border border-border bg-surface-raised" aria-label="নতুন রুম">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <ShuffleIcon className="shrink-0 text-primary" />
          <h2 className="text-base font-semibold text-ink">নতুন রুম</h2>
        </div>

        <div className="space-y-2 p-4" role="radiogroup" aria-label="নতুন রুম বেছে নিন">
          {options.map((room) => {
            const occupant = occupantByRoom.get(room.id);
            const disabled = Boolean(occupant);
            const selected = selectedRoomId === room.id;
            return (
              <button
                key={room.id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => setSelectedRoomId(room.id)}
                className={cn(
                  'relative flex w-full items-center gap-3 rounded-md border px-4 py-3 text-left transition-colors',
                  selected ? 'border-primary bg-primary-tint' : 'border-border bg-surface-raised',
                  !selected && !disabled && 'hover:bg-surface-soft',
                  disabled && 'cursor-not-allowed opacity-55',
                )}
              >
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-base font-bold text-ink',
                    selected ? 'bg-primary-tint' : 'bg-surface-soft',
                  )}
                >
                  {bnDigits(room.number)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{occupant ?? 'খালি রুম'}</span>
                  <span className={cn('block text-xs', occupant ? 'text-ink-muted' : 'text-success')}>
                    {occupant ? 'দখলকৃত' : 'খালি — উপলব্ধ'}
                  </span>
                </span>
                <CheckIcon
                  size={20}
                  strokeWidth={2.2}
                  className={cn('shrink-0 text-primary transition-opacity', selected ? 'opacity-100' : 'opacity-0')}
                />
              </button>
            );
          })}
          {options.length === 0 ? (
            <p className="px-1 py-2 text-sm text-ink-muted">শিফট করার মতো অন্য কোনো রুম নেই।</p>
          ) : null}
        </div>
      </section>

      <section className="mt-3 rounded-card border border-border bg-surface-raised" aria-label="কার্যকর তারিখ">
        <div className="p-4">
          <label htmlFor="shift-date" className="mb-1.5 block text-sm font-medium text-ink">
            কার্যকর তারিখ
          </label>
          <input
            id="shift-date"
            type="date"
            value={effectiveDate}
            onChange={(event) => setEffectiveDate(event.target.value)}
            className="w-full rounded-input border border-border bg-surface-raised px-4 py-3 text-md text-ink transition-colors focus:border-border-focus"
          />
          <p className="mt-1.5 text-xs text-ink-faint">এই তারিখ থেকে নতুন রুমে হিসাব শুরু হবে।</p>
        </div>
      </section>

      <section className="mt-3 flex items-start gap-3 rounded-card bg-surface-sunken px-5 py-4" aria-label="তথ্য স্থানান্তর নোট">
        <InfoIcon className="mt-0.5 shrink-0 text-info" />
        <p className="text-sm leading-relaxed text-ink-muted">
          বকেয়া, জমা/জামানত আর পুরনো হিস্টরি নতুন রুমে চলে যাবে — কোনো তথ্য হারাবে না।
        </p>
      </section>

      {formError ? (
        <p role="alert" className="mt-3 rounded-card border border-danger bg-danger-tint px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      ) : null}

      <div className="mt-5 pb-2">
        <Button
          fullWidth
          disabled={!selectedRoomId || vacantOptions.length === 0}
          onClick={() => setSheetOpen(true)}
          leadingIcon={<ShuffleIcon size={18} />}
        >
          শিফট নিশ্চিত করুন
        </Button>
      </div>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        ariaLabel="রুম শিফট নিশ্চিত করুন"
      >
        <div className="mt-4 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-tint text-danger">
            <ShuffleIcon size={22} />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-ink">রুম শিফট নিশ্চিত করুন</h2>
            <p className="text-sm text-ink-muted">
              {tenant.name}কে রুম {fromLabel} → {toLabel}-তে সরানো হবে
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
            onClick={applyShift}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-button bg-danger px-5 py-3 text-base font-semibold text-surface-raised transition-opacity hover:opacity-90 active:opacity-100 disabled:opacity-60"
          >
            <CheckIcon size={18} />
            {applying ? 'শিফট হচ্ছে…' : 'নিশ্চিত শিফট'}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
