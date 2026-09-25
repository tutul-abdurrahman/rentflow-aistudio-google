import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepository } from '../app/repository';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import RadioCard from '../components/RadioCard';
import { cn } from '../lib/cn';
import { bnDigits, bnMonth, bnTaka } from '../lib/format';
import type { Adjustment, Bill, Property, Room, Tenant } from '../lib/types';

/**
 * 18 — অ্যাডজাস্টমেন্ট. Manual adjustment that updates the stored bill IN
 * PLACE via repository.adjustBill(). There is no regenerate path here
 * (handoff §10/§14); a wrong entry is corrected in place and the ledger
 * follows wherever the numbers break.
 */

type AdjustmentType = 'units' | 'charge';

const TYPE_LABELS: Record<AdjustmentType, string> = {
  units: 'অতিরিক্ত ইউনিট',
  charge: 'এককালীন চার্জ',
};

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

function ChevronIcon() {
  return (
    <svg
      className="pointer-events-none absolute inset-y-0 right-4 my-auto text-ink-faint"
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      className="mt-0.5 shrink-0 text-info"
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
  );
}

const initials = (name: string): string => name.trim().slice(0, 2);

export default function ManualAdjustment() {
  const repo = useRepository();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [month, setMonth] = useState('');
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);

  const [roomId, setRoomId] = useState('');
  const [type, setType] = useState<AdjustmentType>('units');
  const [units, setUnits] = useState('');
  const [charge, setCharge] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const activeMonth = await repo.getActiveMonth();
      const [prop, roomList, tenantList, billList, adjustmentList] = await Promise.all([
        repo.getProperty(),
        repo.listRooms(),
        repo.listTenants(),
        repo.listBills(activeMonth),
        repo.listAdjustments(activeMonth),
      ]);
      if (!alive) return;
      setMonth(activeMonth);
      setProperty(prop);
      setRooms(roomList);
      setTenants(tenantList);
      setBills(billList);
      setAdjustments(adjustmentList);
      setLoading(false);
    })().catch(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [repo]);

  const roomNumber = useMemo(() => {
    const map = new Map(rooms.map((room) => [room.id, room.number]));
    return (id: string): string => map.get(id) ?? '';
  }, [rooms]);

  const tenantName = useMemo(() => {
    const map = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
    return (id: string): string => map.get(id) ?? '';
  }, [tenants]);

  /** Only rooms with a paper this month can be adjusted (vacant 106 has none). */
  const billRooms = useMemo(() => {
    const withBill = new Set(bills.map((bill) => bill.roomId));
    return rooms
      .filter((room) => withBill.has(room.id))
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || a.number.localeCompare(b.number));
  }, [rooms, bills]);

  /** roomId → active tenant name, via the month's bills. */
  const tenantNameForRoom = (id: string): string =>
    tenantName(bills.find((bill) => bill.roomId === id)?.tenantId ?? '');

  useEffect(() => {
    if (!roomId && billRooms.length > 0) setRoomId(billRooms[0].id);
  }, [roomId, billRooms]);

  const rate = property?.electricityRate ?? 0;

  const unitsNumber = units === '' ? Number.NaN : Number(units);
  const chargeNumber = charge === '' ? Number.NaN : Number(charge);
  const amount =
    type === 'units'
      ? Number.isFinite(unitsNumber)
        ? Math.round(unitsNumber * rate)
        : 0
      : Number.isFinite(chargeNumber)
        ? Math.round(chargeNumber)
        : 0;

  const resetInputs = () => {
    setUnits('');
    setCharge('');
    setNote('');
  };

  const onSubmit = async () => {
    setError(null);
    if (!roomId) {
      setError('রুম বাছাই করুন।');
      return;
    }
    if (amount === 0) {
      setError(type === 'units' ? 'ইউনিট সংখ্যা দিন।' : 'চার্জের পরিমাণ দিন।');
      return;
    }
    if (!note.trim()) {
      setError('নোট লিখুন।');
      return;
    }
    setBusy(true);
    try {
      await repo.adjustBill(month, roomId, {
        label: TYPE_LABELS[type],
        amount,
        note: note.trim(),
      });
      setAdjustments(await repo.listAdjustments(month));
      resetInputs();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'যোগ করা যায়নি');
    } finally {
      setBusy(false);
    }
  };

  const unitsHelper =
    units !== '' && Number.isFinite(unitsNumber)
      ? `${bnDigits(units)} ইউনিট × ৳${bnDigits(rate)} = ${bnTaka(amount)} — সংখ্যা বদলালে টাকা নিজে নিজে হিসাব হবে`
      : 'সংখ্যা বদলালে টাকা নিজে নিজে হিসাব হবে';

  if (loading || !property) {
    return (
      <>
        <PageHeader title="অ্যাডজাস্টমেন্ট" subtitle="লোড হচ্ছে…" backTo="/bills/preview" />
        <div
          className="mx-auto mt-4 w-full max-w-3xl space-y-4"
          aria-busy="true"
          aria-label="লোড হচ্ছে"
        >
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="rounded-card border border-border bg-surface-raised px-5 py-4"
              aria-hidden="true"
            >
              <div className="skeleton h-3 w-24" />
              <div className="skeleton mt-3 h-10 w-full rounded-input" />
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="অ্যাডজাস্টমেন্ট"
        subtitle={`${bnMonth(month)} · ${property.name}`}
        backTo="/bills/preview"
      />

      {billRooms.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="এই মাসে কোনো বিল নেই"
            caption="আগে মিটার রিডিং দিয়ে বিল হিসাব করুন।"
          />
        </div>
      ) : (
        <>
          <section className="mt-4 rounded-card border border-border bg-surface-raised px-5 py-4">
            <label htmlFor="rentee" className="mb-1.5 block text-sm font-medium text-ink">
              রেন্টি বাছাই করুন
            </label>
            <div className="relative">
              <select
                id="rentee"
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
                className="w-full appearance-none rounded-input border border-border bg-surface-raised px-4 py-3 pr-10 text-md text-ink transition-colors focus:border-border-focus"
              >
                {billRooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    রুম {bnDigits(room.number)} · {tenantNameForRoom(room.id)}
                  </option>
                ))}
              </select>
              <ChevronIcon />
            </div>
          </section>

          <section className="mt-3 rounded-card border border-border bg-surface-raised px-5 py-4">
            <p className="text-sm font-medium text-ink">অ্যাডজাস্টমেন্টের ধরন</p>

            <div className="mt-3 grid gap-3">
              <RadioCard
                name="adj-type"
                value="units"
                checked={type === 'units'}
                onChange={() => setType('units')}
                title="অতিরিক্ত ইউনিট"
                description={`বিদ্যুৎ ইউনিট যোগ হবে — ৳${bnDigits(rate)}/ইউনিট`}
              />
              <RadioCard
                name="adj-type"
                value="charge"
                checked={type === 'charge'}
                onChange={() => setType('charge')}
                title="এককালীন চার্জ"
                description="মেরামত, ফাইন বা অন্য কোনো নির্দিষ্ট টাকা"
              />
            </div>

            {type === 'units' ? (
              <div className="mt-4">
                <label htmlFor="units-input" className="mb-1.5 block text-sm font-medium text-ink">
                  ইউনিট সংখ্যা
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    id="units-input"
                    type="text"
                    inputMode="numeric"
                    value={units}
                    onChange={(event) => setUnits(event.target.value)}
                    className="w-full rounded-input border border-border bg-surface-raised px-4 py-3 text-md text-ink transition-colors focus:border-border-focus"
                  />
                  <div className="flex items-center justify-between rounded-input border border-border bg-surface-soft px-4 py-3">
                    <span className="text-sm text-ink-muted">টাকা</span>
                    <span className="text-md font-bold text-ink">{bnTaka(amount)}</span>
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-ink-faint">{unitsHelper}</p>
              </div>
            ) : (
              <div className="mt-4">
                <label htmlFor="charge-input" className="mb-1.5 block text-sm font-medium text-ink">
                  চার্জের পরিমাণ
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-md font-medium text-ink-faint">
                    ৳
                  </span>
                  <input
                    id="charge-input"
                    type="number"
                    inputMode="numeric"
                    placeholder="যেমন ৫০০"
                    value={charge}
                    onChange={(event) => setCharge(event.target.value)}
                    className="w-full rounded-input border border-border bg-surface-raised py-3 pl-10 pr-4 text-md text-ink transition-colors placeholder:text-ink-faint focus:border-border-focus"
                  />
                </div>
                <p className="mt-1.5 text-xs text-ink-faint">
                  এই টাকা লেজারে যোগ হবে — বিল আবার তৈরি করতে হবে না
                </p>
              </div>
            )}

            <div className="mt-4">
              <label htmlFor="adj-note" className="mb-1.5 block text-sm font-medium text-ink">
                নোট <span className="text-danger">*</span>
              </label>
              <textarea
                id="adj-note"
                rows={3}
                required
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="যেমন: ১০৬-এর ফাঁকা রুম থেকে ৩ দিন বিদ্যুৎ নিয়েছে"
                className="w-full resize-none rounded-input border border-border bg-surface-raised px-4 py-3 text-md text-ink transition-colors placeholder:text-ink-faint focus:border-border-focus"
              />
              <p className="mt-1.5 text-xs text-ink-faint">
                নোট লিখতে হবে — লেজারে থাকবে; কাগজ আবার প্রিন্ট করলে তখন দেখা যাবে
              </p>
            </div>

            <div className="mt-4 flex items-start gap-2.5 rounded-md bg-surface-soft px-4 py-3">
              <InfoIcon />
              <p className="text-xs leading-relaxed text-ink-muted">
                ভুল এন্ট্রি এখানেই ঠিক করুন। লেজারও সেই অনুযায়ী আপডেট হবে। এখান থেকে বিল আবার
                তৈরি হয় না। খালি রুমে কেউ বিদ্যুৎ নিলে ম্যানুয়ালি যোগ করুন।
              </p>
            </div>
          </section>

          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link
              to="/bills/preview"
              className="inline-flex w-full items-center justify-center rounded-button border border-secondary bg-surface-raised px-5 py-3 text-base font-semibold text-secondary transition-colors hover:bg-secondary-hover active:bg-secondary-active sm:w-auto"
            >
              বাতিল
            </Link>
            <Button
              onClick={onSubmit}
              disabled={busy}
              leadingIcon={<PlusIcon />}
              className="w-full sm:w-auto"
            >
              যোগ করুন
            </Button>
          </div>

          <section className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink">চলতি মাসের অ্যাডজাস্টমেন্ট</h2>
              <span className="text-xs font-medium text-ink-faint">
                {bnDigits(adjustments.length)}টি · {bnMonth(month)}
              </span>
            </div>

            {adjustments.length === 0 ? (
              <div className="mt-2 flex flex-col items-center rounded-card border border-dashed border-border bg-surface-raised px-6 py-10 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-soft text-ink-faint">
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
                    <path d="M12 9v4M12 17h.01" />
                    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                  </svg>
                </span>
                <h3 className="mt-3 text-sm font-semibold text-ink">
                  এই মাসে কোনো অ্যাডজাস্টমেন্ট নেই
                </h3>
                <p className="mt-1 max-w-60 text-xs text-ink-muted">
                  নতুন অ্যাডজাস্টমেন্ট যোগ করলে এখানে দেখা যাবে।
                </p>
              </div>
            ) : (
              <div className="mt-2 divide-y divide-border rounded-card border border-border bg-surface-raised">
                {adjustments.map((adjustment) => {
                  const isUnits = adjustment.label === TYPE_LABELS.units;
                  return (
                    <div key={adjustment.id} className="flex items-start gap-3 p-4">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-tint text-sm font-bold text-ink">
                        {initials(tenantNameForRoom(adjustment.roomId))}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-sm font-semibold text-ink">
                            {tenantNameForRoom(adjustment.roomId)}
                          </p>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium',
                              isUnits ? 'bg-primary-tint text-primary' : 'bg-info-tint text-info',
                            )}
                          >
                            <span
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                isUnits ? 'bg-primary' : 'bg-info',
                              )}
                            />
                            {adjustment.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          রুম {bnDigits(roomNumber(adjustment.roomId))} ·{' '}
                          {bnTaka(adjustment.amount)}
                        </p>
                        {adjustment.note ? (
                          <p className="mt-1 text-xs text-ink-faint">{adjustment.note}</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
