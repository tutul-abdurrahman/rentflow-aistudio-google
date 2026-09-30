import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/Button';
import MonthSelect from '../components/MonthSelect';
import PageHeader from '../components/PageHeader';
import { useRepository } from '../app/repository';
import { cn } from '../lib/cn';
import { monthTenantByRoom, occupiedRoomsInMonth, type Tenancy } from '../lib/engine';
import { bnDigits, bnMonth, bnNumber } from '../lib/format';
import { isMonthKey, monthPickerOptions } from '../lib/screen-month';
import { addMonths, currentMonth } from '../lib/view';
import type { MeterEntry, Property, Room, Tenant } from '../lib/types';

/**
 * 03 — মিটার রিডিং. Monthly cycle step 1: per-room electricity + one building
 * water meter for the cycle month the owner picks.
 *
 * - The picker offers every month with data plus the trailing 12 months; the
 *   opening month is repository.getActiveMonth() (the draft month) unless
 *   ?month= asks for another one.
 * - previous readings auto-fill from the earlier month's saved `current` and
 *   stay editable (move-in reading, or a chain gap after a vacant month).
 * - A month that already has papers is READ-ONLY: nothing is recalculated and
 *   calculatePapers is never called for it.
 * - Rows are the rooms occupied DURING the month (tenancy intervals); a room
 *   vacant that month gets no meter and no bill. Negative readings are rejected
 *   inline BEFORE save (handoff §10).
 */

interface RoomDraft {
  previous: string;
  current: string;
  touched: boolean;
}

const EMPTY_DRAFT: RoomDraft = { previous: '', current: '', touched: false };

/** Tenancies the engine uses to decide the month's rooms and tenants. */
function toTenancies(tenants: Tenant[]): Tenancy[] {
  return tenants
    .filter((tenant) => tenant.roomId !== null)
    .map((tenant) => {
      const tenancy: Tenancy = {
        id: tenant.id,
        name: tenant.name,
        roomId: tenant.roomId as string,
        moveInDate: tenant.moveInDate,
      };
      if (tenant.moveOutDate) tenancy.moveOutDate = tenant.moveOutDate;
      return tenancy;
    });
}

function WarnIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 1 21h22L12 3z" />
      <path d="M12 10v5" />
      <path d="M12 18h.01" />
    </svg>
  );
}

function LockIcon() {
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
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export default function MeterEntry() {
  const repo = useRepository();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [month, setMonth] = useState('');
  const [monthOptions, setMonthOptions] = useState<string[]>([]);
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [hasPapers, setHasPapers] = useState(false);

  const [drafts, setDrafts] = useState<Record<string, RoomDraft>>({});
  const [waterPrevious, setWaterPrevious] = useState('');
  const [waterCurrent, setWaterCurrent] = useState('');
  const [waterTouched, setWaterTouched] = useState(false);
  const [rate, setRate] = useState('');
  const [waste, setWaste] = useState('');

  // Opening month + picker options + property/rooms/tenancies (once).
  useEffect(() => {
    let alive = true;
    (async () => {
      const requested = searchParams.get('month');
      const [activeMonth, prop, roomList, tenantList, dataMonths] = await Promise.all([
        repo.getActiveMonth(),
        repo.getProperty(),
        repo.listRooms(),
        repo.listTenants(),
        repo.listDataMonths(),
      ]);
      if (!alive) return;
      setProperty(prop);
      setRooms(roomList);
      setTenancies(toTenancies(tenantList));
      setMonthOptions(monthPickerOptions(dataMonths, currentMonth()));
      setMonth(isMonthKey(requested) ? requested : activeMonth);
    })().catch(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repo]);

  // Selected month: load its saved draft (or open an empty one) + its papers.
  useEffect(() => {
    if (!month) return;
    let alive = true;
    setLoading(true);
    setSaved(false);
    setFormError(null);
    (async () => {
      const [entry, bills, lastKnown] = await Promise.all([
        repo.getMeterEntry(month),
        repo.listBills(month),
        repo.getLastKnownReadings(month),
      ]);
      if (!alive) return;

      const nextDrafts: Record<string, RoomDraft> = {};
      for (const room of occupiedRoomsInMonth(rooms, tenancies, month)) {
        const row = entry?.rooms.find((item) => item.roomId === room.id);
        nextDrafts[room.id] = {
          previous: row ? String(row.previous) : String(lastKnown.rooms.get(room.id) ?? 0),
          current: row ? String(row.current) : '',
          touched: false,
        };
      }

      setDrafts(nextDrafts);
      setWaterPrevious(entry ? String(entry.water.previous) : String(lastKnown.water));
      setWaterCurrent(entry ? String(entry.water.current) : '');
      setWaterTouched(false);
      setHasPapers(bills.length > 0);
      setRate(String(property?.electricityRate ?? 0));
      setWaste(String(property?.wasteFee ?? 0));
      setLoading(false);
    })().catch((error: unknown) => {
      if (!alive) return;
      setFormError(error instanceof Error ? error.message : 'তথ্য লোড করা যায়নি');
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [repo, month, rooms, tenancies, property]);

  /** Papers exist → the month is a finished preview, never a draft again. */
  const readOnly = hasPapers;

  const monthTenants = useMemo(() => monthTenantByRoom(tenancies, month), [tenancies, month]);
  const occupiedRooms = useMemo(
    () => occupiedRoomsInMonth(rooms, tenancies, month),
    [rooms, tenancies, month],
  );

  const vacantNumbers = useMemo(() => {
    const occupied = new Set(occupiedRooms.map((room) => room.id));
    return rooms.filter((room) => !occupied.has(room.id)).map((room) => bnDigits(room.number));
  }, [rooms, occupiedRooms]);

  const electricityRows = useMemo(
    () =>
      occupiedRooms.map((room) => {
        const draft = drafts[room.id] ?? EMPTY_DRAFT;
        const previous = draft.previous === '' ? Number.NaN : Number(draft.previous);
        const current = draft.current === '' ? Number.NaN : Number(draft.current);
        const previousValid = draft.previous !== '' && !Number.isNaN(previous) && previous >= 0;
        const valid =
          previousValid && draft.current !== '' && !Number.isNaN(current) && current >= previous;

        let error: string | null = null;
        if (!previousValid) error = 'পূর্বের রিডিং ০ বা তার বেশি হতে হবে';
        else if (draft.current === '') error = 'বর্তমান রিডিং লিখুন';
        else if (Number.isNaN(current) || current < previous) error = 'বর্তমান রিডিং পূর্বের চেয়ে কম';

        return {
          room,
          tenant: monthTenants.get(room.id),
          draft,
          valid,
          error,
          showError: !valid && draft.touched,
          used: valid ? current - previous : null,
        };
      }),
    [occupiedRooms, drafts, monthTenants],
  );

  const waterPreviousNumber = waterPrevious === '' ? Number.NaN : Number(waterPrevious);
  const waterCurrentNumber = waterCurrent === '' ? Number.NaN : Number(waterCurrent);
  const waterPreviousValid =
    waterPrevious !== '' && !Number.isNaN(waterPreviousNumber) && waterPreviousNumber >= 0;
  const waterValid =
    waterPreviousValid &&
    waterCurrent !== '' &&
    !Number.isNaN(waterCurrentNumber) &&
    waterCurrentNumber >= waterPreviousNumber;
  const waterError = !waterPreviousValid
    ? 'পূর্বের রিডিং ০ বা তার বেশি হতে হবে'
    : waterCurrent === ''
      ? 'বর্তমান রিডিং লিখুন'
      : 'বর্তমান রিডিং পূর্বের চেয়ে কম';
  const waterShowError = !waterValid && waterTouched;

  const rateValue = Number(rate);
  const wasteValue = Number(waste);
  const rateValid = rate !== '' && !Number.isNaN(rateValue) && rateValue > 0;
  const wasteValid = waste !== '' && !Number.isNaN(wasteValue) && wasteValue >= 0;

  const allValid =
    rateValid && wasteValid && waterValid && electricityRows.every((row) => row.valid);

  const nextMonth = month ? addMonths(month, 1) : '';
  const canStartNextMonth = readOnly && nextMonth !== '' && nextMonth <= currentMonth();

  const markAllTouched = () => {
    setDrafts((prev) => {
      const next: Record<string, RoomDraft> = {};
      for (const [id, draft] of Object.entries(prev)) next[id] = { ...draft, touched: true };
      return next;
    });
    setWaterTouched(true);
  };

  const buildEntry = (): MeterEntry => ({
    month,
    rooms: occupiedRooms.map((room) => {
      const draft = drafts[room.id];
      return {
        roomId: room.id,
        roomNumber: room.number,
        tenantName: monthTenants.get(room.id)?.name,
        previous: Number(draft?.previous || 0),
        current: Number(draft?.current || 0),
      };
    }),
    water: { previous: Number(waterPrevious || 0), current: Number(waterCurrent || 0) },
  });

  const persistDraft = async () => {
    await repo.updateProperty({ electricityRate: rateValue, wasteFee: wasteValue });
    await repo.saveMeterEntry(month, buildEntry());
  };

  const selectMonth = (next: string) => {
    if (!next || next === month) return;
    setSearchParams({ month: next }, { replace: true });
    setMonth(next);
  };

  const onSaveDraft = async () => {
    setFormError(null);
    if (!allValid) {
      markAllTouched();
      return;
    }
    setBusy(true);
    try {
      await persistDraft();
      setSaved(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'সেভ করা যায়নি');
    } finally {
      setBusy(false);
    }
  };

  const onPrimary = async () => {
    setFormError(null);
    // A month that already has papers is a preview: never recalculate it.
    if (readOnly) {
      navigate(`/bills/preview?month=${month}`);
      return;
    }
    if (!allValid) {
      markAllTouched();
      return;
    }
    setBusy(true);
    try {
      await persistDraft();
      await repo.calculatePapers(month);
      navigate(`/bills/ready?month=${month}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'বিল হিসাব করা যায়নি');
      setBusy(false);
    }
  };

  if (loading || !property || !month) {
    return (
      <>
        <PageHeader title="মিটার রিডিং" subtitle="লোড হচ্ছে…" backTo="/" />
        <div aria-busy="true" aria-label="লোড হচ্ছে">
          <div
            className="mt-4 overflow-hidden rounded-card border border-border bg-surface-raised"
            aria-hidden="true"
          >
            <div className="flex items-center justify-between px-5 py-4">
              <div className="skeleton h-4 w-32" />
              <div className="skeleton h-3 w-24" />
            </div>
            {[0, 1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className="flex items-center gap-3 border-t border-border px-5 py-3.5"
                aria-hidden="true"
              >
                <div className="skeleton h-4 w-12" />
                <div className="skeleton h-4 w-28 max-w-[40%] flex-1" />
                <div className="skeleton h-4 w-4 flex-1" />
                <div className="skeleton h-9 w-24" />
                <div className="skeleton h-4 w-12" />
              </div>
            ))}
          </div>
          <div
            className="mt-4 rounded-card border border-border bg-surface-raised px-5 py-4"
            aria-hidden="true"
          >
            <div className="skeleton h-4 w-48" />
            <div className="skeleton mt-3 h-3 w-64 max-w-full" />
          </div>
          <div className="mt-5 flex gap-3" aria-hidden="true">
            <div className="skeleton h-10 w-28" />
            <div className="skeleton h-10 w-32" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="মিটার রিডিং"
        subtitle={`${property.name} · ${readOnly ? 'হিসাব হয়েছে' : 'খসড়া'} ${bnMonth(month)}`}
        backTo="/"
        action={
          <MonthSelect
            className="ml-auto"
            value={month}
            months={monthOptions}
            onChange={selectMonth}
            align="right"
          />
        }
      />

      {readOnly ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-card border border-border bg-surface-soft px-4 py-3">
          <LockIcon />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              এই মাসের বিল ইতিমধ্যে হিসাব হয়েছে — বদলানো যাবে না
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
              রিডিং শুধু দেখার জন্য। নতুন মাসের রিডিং দিতে পরের মাসের খসড়া শুরু করুন।
            </p>
          </div>
        </div>
      ) : null}

      <section
        className="mt-4 overflow-hidden rounded-card border border-border bg-surface-raised"
        aria-label="বিদ্যুৎ সাব-মিটার"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <h2 className="text-base font-semibold text-ink">বিদ্যুৎ সাব-মিটার</h2>
          <span className="text-right text-xs text-ink-faint">
            {readOnly
              ? 'হিসাব হয়ে যাওয়া মাস'
              : 'পূর্বের রিডিং আগের মাস থেকে বসেছে — দরকার হলে বদলাতে পারবেন'}
          </span>
        </div>

        <div className="hidden border-t border-border bg-surface-soft px-5 py-2.5 lg:grid lg:grid-cols-[4.5rem_minmax(0,1fr)_7rem_8rem_5rem] lg:gap-3">
          <p className="text-xs font-semibold text-ink">রুম</p>
          <p className="text-xs font-semibold text-ink">নাম</p>
          <p className="text-right text-xs font-semibold text-ink-muted">পূর্ববর্তী</p>
          <p className="text-right text-xs font-semibold text-ink-muted">বর্তমান</p>
          <p className="text-right text-xs font-semibold text-ink">ব্যবহৃত</p>
        </div>

        <div className="divide-y divide-border">
          {electricityRows.map(({ room, tenant, draft, valid, error, showError, used }) => (
            <div key={room.id} className="px-5 py-3.5">
              <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_5rem_3rem] items-center gap-3 lg:grid-cols-[4.5rem_minmax(0,1fr)_7rem_8rem_5rem]">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{bnDigits(room.number)}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-faint lg:hidden">
                    {tenant?.name ?? 'খালি'}
                  </p>
                </div>
                <p className="hidden truncate text-sm text-ink lg:block">{tenant?.name ?? '—'}</p>
                <div>
                  <label
                    htmlFor={`prev-${room.id}`}
                    className="block text-[10px] text-ink-faint lg:hidden"
                  >
                    পূর্ববর্তী
                  </label>
                  <input
                    id={`prev-${room.id}`}
                    type="number"
                    inputMode="numeric"
                    disabled={readOnly}
                    value={draft.previous}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [room.id]: { ...prev[room.id], previous: event.target.value, touched: true },
                      }))
                    }
                    className={cn(
                      'w-full min-w-0 rounded-input border bg-surface-raised px-2 py-2 text-right text-md font-medium text-ink outline-none focus:border-border-focus disabled:bg-surface-soft disabled:text-ink-muted lg:px-3',
                      showError && !valid ? 'border-danger' : 'border-border',
                    )}
                  />
                </div>
                <div>
                  <label
                    htmlFor={`curr-${room.id}`}
                    className="block text-[10px] text-ink-faint lg:hidden"
                  >
                    বর্তমান
                  </label>
                  <input
                    id={`curr-${room.id}`}
                    type="number"
                    inputMode="numeric"
                    disabled={readOnly}
                    value={draft.current}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [room.id]: { ...prev[room.id], current: event.target.value, touched: true },
                      }))
                    }
                    className={cn(
                      'w-full min-w-0 rounded-input border bg-surface-raised px-2 py-2 text-right text-md font-medium text-ink outline-none focus:border-border-focus disabled:bg-surface-soft disabled:text-ink-muted lg:px-3',
                      showError ? 'border-danger' : 'border-border',
                    )}
                  />
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-ink-faint lg:hidden">ব্যবহৃত</p>
                  <p className={cn('text-sm font-semibold', valid ? 'text-ink' : 'text-danger')}>
                    {used === null ? '—' : bnNumber(used)}
                  </p>
                </div>
              </div>
              {showError && error ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-danger">
                  <WarnIcon />
                  {error}
                </p>
              ) : null}
            </div>
          ))}
          {electricityRows.length === 0 ? (
            <p className="px-5 py-4 text-sm text-ink-muted">
              এই মাসে কোনো রুম ভাড়া ছিল না — কারও সাব-মিটার নেই।
            </p>
          ) : null}
        </div>

        <p className="border-t border-border px-5 py-3 text-xs text-ink-faint">
          রুম {vacantNumbers.join(', ') || '—'} এই মাসে খালি — সাব-মিটার নেই, বিদ্যুৎ বিলও নেই।
        </p>
      </section>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 md:items-stretch">
        <section
          className="flex flex-col rounded-card border border-border bg-surface-raised px-5 py-4"
          aria-label="পানি মেইন মিটার"
        >
          <h2 className="text-base font-semibold text-ink">পানি · মেইন মিটার</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {bnDigits(electricityRows.length)}টি ভাড়া থাকা রুম + ১ দিয়ে ভাগ হয়। খালি রুম বাদ।
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <label htmlFor="water-prev" className="block text-xs font-medium text-ink-muted">
                পূর্ববর্তী
              </label>
              <input
                id="water-prev"
                type="number"
                inputMode="numeric"
                disabled={readOnly}
                value={waterPrevious}
                onChange={(event) => {
                  setWaterPrevious(event.target.value);
                  setWaterTouched(true);
                }}
                className={cn(
                  'mt-1 w-28 rounded-input border bg-surface-raised px-3 py-2 text-right text-md font-medium text-ink outline-none focus:border-border-focus disabled:bg-surface-soft disabled:text-ink-muted',
                  waterShowError && !waterPreviousValid ? 'border-danger' : 'border-border',
                )}
              />
            </div>
            <div>
              <label htmlFor="water-curr" className="block text-xs font-medium text-ink-muted">
                বর্তমান
              </label>
              <input
                id="water-curr"
                type="number"
                inputMode="numeric"
                disabled={readOnly}
                value={waterCurrent}
                onChange={(event) => {
                  setWaterCurrent(event.target.value);
                  setWaterTouched(true);
                }}
                className={cn(
                  'mt-1 w-28 rounded-input border bg-surface-raised px-3 py-2 text-right text-md font-medium text-ink outline-none focus:border-border-focus disabled:bg-surface-soft disabled:text-ink-muted',
                  waterShowError ? 'border-danger' : 'border-border',
                )}
              />
            </div>
            <div>
              <p className="text-xs text-ink-faint">ব্যবহৃত</p>
              <p
                className={cn(
                  'mt-1 text-lg font-semibold tabular-nums',
                  waterValid ? 'text-ink' : 'text-danger',
                )}
              >
                {waterValid ? bnNumber(waterCurrentNumber - waterPreviousNumber) : '—'}
              </p>
            </div>
            {waterShowError ? (
              <p className="flex basis-full items-center gap-1.5 text-xs text-danger">
                <WarnIcon />
                {waterError}
              </p>
            ) : null}
          </div>
        </section>

        <section
          className="flex flex-col rounded-card border border-border bg-surface-raised px-5 py-4"
          aria-label="রেট ও ফি"
        >
          <h2 className="text-base font-semibold text-ink">রেট ও ফি</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {readOnly
              ? 'এই মাসের কাগজ তৈরি হয়ে গেছে — রেট বদলালে পরের মাসের হিসাবে বসবে।'
              : 'বদলালে এই মাসের বিল হিসাবের সময় এই রেট বসবে।'}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="prop-rate" className="mb-1 block text-xs font-medium text-ink-muted">
                বিদ্যুৎ (৳/ইউনিট)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-ink-faint">
                  ৳
                </span>
                <input
                  id="prop-rate"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  disabled={readOnly}
                  value={rate}
                  onChange={(event) => setRate(event.target.value)}
                  className={cn(
                    'w-full rounded-input border bg-surface-raised py-2 pl-8 pr-3 text-md font-medium text-ink outline-none focus:border-border-focus disabled:bg-surface-soft disabled:text-ink-muted',
                    rateValid ? 'border-border' : 'border-danger',
                  )}
                />
              </div>
            </div>
            <div>
              <label htmlFor="prop-waste" className="mb-1 block text-xs font-medium text-ink-muted">
                ওয়েস্ট (৳/রুম)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-ink-faint">
                  ৳
                </span>
                <input
                  id="prop-waste"
                  type="number"
                  inputMode="numeric"
                  disabled={readOnly}
                  value={waste}
                  onChange={(event) => setWaste(event.target.value)}
                  className={cn(
                    'w-full rounded-input border bg-surface-raised py-2 pl-8 pr-3 text-md font-medium text-ink outline-none focus:border-border-focus disabled:bg-surface-soft disabled:text-ink-muted',
                    wasteValid ? 'border-border' : 'border-danger',
                  )}
                />
              </div>
            </div>
          </div>
        </section>
      </div>

      {formError ? <p className="mt-3 text-sm text-danger">{formError}</p> : null}

      <div className="mt-5 flex flex-col-reverse gap-2 pb-1 sm:flex-row sm:items-center sm:justify-end">
        {readOnly ? (
          canStartNextMonth ? (
            <Button
              variant="secondary"
              onClick={() => selectMonth(nextMonth)}
              disabled={busy}
              className="w-full sm:w-auto"
            >
              পরের মাসের খসড়া শুরু করুন
            </Button>
          ) : null
        ) : (
          <Button
            variant="secondary"
            onClick={onSaveDraft}
            disabled={busy}
            className="w-full sm:w-auto"
          >
            খসড়া সেভ করুন
          </Button>
        )}
        <Button onClick={onPrimary} disabled={busy} className="w-full sm:w-auto">
          {readOnly ? 'বিল দেখুন' : 'বিল হিসাব করুন'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-ink-faint sm:text-right">
        {readOnly
          ? 'প্রিন্ট করতে বিল প্রিভিউতে যান। টাকা পরে লেজারে লেখা হবে।'
          : 'বিল হিসাব করার পর প্রিন্ট করবেন। টাকা পরে লেজারে লেখা হবে।'}
      </p>
      {saved ? (
        <p className="mt-1 text-xs text-success sm:text-right">খসড়া সেভ হয়েছে।</p>
      ) : null}
    </>
  );
}
