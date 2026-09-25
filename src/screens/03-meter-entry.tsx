import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/Button';
import PageHeader from '../components/PageHeader';
import { useRepository } from '../app/repository';
import { cn } from '../lib/cn';
import { bnDigits, bnMonth, bnNumber } from '../lib/format';
import type { MeterEntry, Property, Room, Tenant } from '../lib/types';

/**
 * 03 — মিটার রিডিং. Monthly cycle step 1: per-room electricity + one building
 * water meter for repository.getActiveMonth(). Negative readings are rejected
 * inline BEFORE save (handoff §10). Papers are calculated only when the month
 * has none yet — never a regenerate.
 */

interface RoomDraft {
  previous: number;
  current: string;
  touched: boolean;
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

export default function MeterEntry() {
  const repo = useRepository();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [month, setMonth] = useState<string>('');
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [hasPapers, setHasPapers] = useState(false);

  const [drafts, setDrafts] = useState<Record<string, RoomDraft>>({});
  const [waterPrevious, setWaterPrevious] = useState(0);
  const [waterCurrent, setWaterCurrent] = useState('');
  const [waterTouched, setWaterTouched] = useState(false);
  const [rate, setRate] = useState('');
  const [waste, setWaste] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const activeMonth = await repo.getActiveMonth();
      const [prop, roomList, tenantList, entry, bills] = await Promise.all([
        repo.getProperty(),
        repo.listRooms(),
        repo.listTenants('active'),
        repo.getMeterEntry(activeMonth),
        repo.listBills(activeMonth),
      ]);
      if (!alive) return;

      const occupied = roomList.filter((room) => room.status === 'occupied');
      const nextDrafts: Record<string, RoomDraft> = {};
      for (const room of occupied) {
        const row = entry?.rooms.find((item) => item.roomId === room.id);
        nextDrafts[room.id] = {
          previous: row?.previous ?? 0,
          current: row ? String(row.current) : '',
          touched: false,
        };
      }

      setMonth(activeMonth);
      setProperty(prop);
      setRooms(roomList);
      setTenants(tenantList);
      setHasPapers(bills.length > 0);
      setDrafts(nextDrafts);
      setWaterPrevious(entry?.water.previous ?? 0);
      setWaterCurrent(entry ? String(entry.water.current) : '');
      setRate(String(prop.electricityRate));
      setWaste(String(prop.wasteFee));
      setLoading(false);
    })().catch(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [repo]);

  const occupiedRooms = useMemo(
    () => rooms.filter((room) => room.status === 'occupied'),
    [rooms],
  );

  const tenantByRoom = useMemo(() => {
    const map = new Map<string, Tenant>();
    for (const tenant of tenants) {
      if (tenant.roomId) map.set(tenant.roomId, tenant);
    }
    return map;
  }, [tenants]);

  const vacantNumbers = useMemo(
    () => rooms.filter((room) => room.status === 'vacant').map((room) => bnDigits(room.number)),
    [rooms],
  );

  const electricityRows = useMemo(
    () =>
      occupiedRooms.map((room) => {
        const draft = drafts[room.id] ?? { previous: 0, current: '', touched: false };
        const parsed = draft.current === '' ? Number.NaN : Number(draft.current);
        const valid = draft.current !== '' && !Number.isNaN(parsed) && parsed >= draft.previous;
        return {
          room,
          tenant: tenantByRoom.get(room.id),
          draft,
          valid,
          showError: !valid && draft.touched,
          used: valid ? parsed - draft.previous : null,
        };
      }),
    [occupiedRooms, drafts, tenantByRoom],
  );

  const waterParsed = waterCurrent === '' ? Number.NaN : Number(waterCurrent);
  const waterValid =
    waterCurrent !== '' && !Number.isNaN(waterParsed) && waterParsed >= waterPrevious;
  const waterShowError = !waterValid && waterTouched;

  const rateValue = Number(rate);
  const wasteValue = Number(waste);
  const rateValid = rate !== '' && !Number.isNaN(rateValue) && rateValue > 0;
  const wasteValid = waste !== '' && !Number.isNaN(wasteValue) && wasteValue >= 0;

  const allValid =
    rateValid && wasteValid && waterValid && electricityRows.every((row) => row.valid);

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
        tenantName: tenantByRoom.get(room.id)?.name,
        previous: draft?.previous ?? 0,
        current: Number(draft?.current || 0),
      };
    }),
    water: { previous: waterPrevious, current: Number(waterCurrent || 0) },
  });

  const persistDraft = async () => {
    await repo.updateProperty({ electricityRate: rateValue, wasteFee: wasteValue });
    await repo.saveMeterEntry(month, buildEntry());
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
      setFormError(error instanceof Error ? error.message : 'সংরক্ষণ করা যায়নি');
    } finally {
      setBusy(false);
    }
  };

  const onPrimary = async () => {
    setFormError(null);
    if (!allValid) {
      markAllTouched();
      return;
    }
    if (hasPapers) {
      navigate('/bills/preview');
      return;
    }
    setBusy(true);
    try {
      await persistDraft();
      await repo.calculatePapers(month);
      navigate('/bills/ready');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'বিল হিসাব করা যায়নি');
      setBusy(false);
    }
  };

  if (loading || !property) {
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
        subtitle={`${property.name} · খসড়া ${bnMonth(month)}`}
        backTo="/"
      />

      <section
        className="mt-4 overflow-hidden rounded-card border border-border bg-surface-raised"
        aria-label="বিদ্যুৎ সাব-মিটার"
      >
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-base font-semibold text-ink">বিদ্যুৎ সাব-মিটার</h2>
          <span className="text-xs text-ink-faint">পূর্ববর্তী আপনি লিখবেন না</span>
        </div>

        <div className="hidden border-t border-border bg-surface-soft px-5 py-2.5 lg:grid lg:grid-cols-[4.5rem_minmax(0,1fr)_7rem_8rem_5rem] lg:gap-3">
          <p className="text-xs font-semibold text-ink">রুম</p>
          <p className="text-xs font-semibold text-ink">নাম</p>
          <p className="text-right text-xs font-semibold text-ink-muted">পূর্ববর্তী</p>
          <p className="text-right text-xs font-semibold text-ink-muted">বর্তমান</p>
          <p className="text-right text-xs font-semibold text-ink">ব্যবহৃত</p>
        </div>

        <div className="divide-y divide-border">
          {electricityRows.map(({ room, tenant, draft, valid, showError, used }) => (
            <div key={room.id} className="px-5 py-3.5">
              <div className="flex items-center justify-between gap-3 lg:grid lg:grid-cols-[4.5rem_minmax(0,1fr)_7rem_8rem_5rem] lg:gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{bnDigits(room.number)}</p>
                  <p className="mt-0.5 text-xs text-ink-faint lg:hidden">
                    {tenant ? tenant.name.split(' ')[0] : 'খালি'} · পূর্ববর্তী{' '}
                    {bnNumber(draft.previous)}
                  </p>
                </div>
                <p className="hidden truncate text-sm text-ink lg:block">
                  {tenant?.name ?? '—'}
                </p>
                <p className="hidden text-right text-sm text-ink-muted lg:block">
                  {bnNumber(draft.previous)}
                </p>
                <div className="flex items-center gap-3 lg:contents">
                  <label className="sr-only" htmlFor={`curr-${room.id}`}>
                    বর্তমান রিডিং — রুম {bnDigits(room.number)}
                  </label>
                  <input
                    id={`curr-${room.id}`}
                    type="number"
                    inputMode="numeric"
                    value={draft.current}
                    onChange={(event) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [room.id]: { ...prev[room.id], current: event.target.value, touched: true },
                      }))
                    }
                    className={cn(
                      'w-24 rounded-input border bg-surface-raised px-3 py-2 text-right text-md font-medium text-ink outline-none focus:border-border-focus lg:w-full',
                      showError ? 'border-danger' : 'border-border',
                    )}
                  />
                  <div className="w-14 text-right lg:w-auto">
                    <p className="text-xs text-ink-faint lg:hidden">ব্যবহৃত</p>
                    <p
                      className={cn(
                        'text-sm font-semibold',
                        valid ? 'text-ink' : 'text-danger',
                      )}
                    >
                      {used === null ? '—' : bnNumber(used)}
                    </p>
                  </div>
                </div>
              </div>
              {showError ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-danger">
                  <WarnIcon />
                  বর্তমান রিডিং পূর্ববর্তীর চেয়ে কম
                </p>
              ) : null}
            </div>
          ))}
        </div>

        <p className="border-t border-border px-5 py-3 text-xs text-ink-faint">
          রুম {vacantNumbers.join(', ') || '—'} খালি — সাব-মিটার নেই, অটো বিদ্যুৎও নেই।
        </p>
      </section>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 md:items-stretch">
        <section
          className="flex flex-col rounded-card border border-border bg-surface-raised px-5 py-4"
          aria-label="পানি মেইন মিটার"
        >
          <h2 className="text-base font-semibold text-ink">পানি · মেইন মিটার</h2>
          <p className="mt-0.5 text-xs text-ink-muted">সক্রিয় রুমে ভাগ। খালি রুম বাদ।</p>
          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
            <div>
              <p className="text-xs text-ink-faint">পূর্ববর্তী</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
                {bnNumber(waterPrevious)}
              </p>
            </div>
            <div>
              <label htmlFor="water-curr" className="block text-xs font-medium text-ink-muted">
                বর্তমান
              </label>
              <input
                id="water-curr"
                type="number"
                inputMode="numeric"
                value={waterCurrent}
                onChange={(event) => {
                  setWaterCurrent(event.target.value);
                  setWaterTouched(true);
                }}
                className={cn(
                  'mt-1 w-28 rounded-input border bg-surface-raised px-3 py-2 text-right text-md font-medium text-ink outline-none focus:border-border-focus',
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
                {waterValid ? bnNumber(waterParsed - waterPrevious) : '—'}
              </p>
            </div>
            {waterShowError ? (
              <p className="flex basis-full items-center gap-1.5 text-xs text-danger">
                <WarnIcon />
                বর্তমান রিডিং পূর্ববর্তীর চেয়ে কম
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
            {hasPapers
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
                  value={rate}
                  onChange={(event) => setRate(event.target.value)}
                  className={cn(
                    'w-full rounded-input border bg-surface-raised py-2 pl-8 pr-3 text-md font-medium text-ink outline-none focus:border-border-focus',
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
                  value={waste}
                  onChange={(event) => setWaste(event.target.value)}
                  className={cn(
                    'w-full rounded-input border bg-surface-raised py-2 pl-8 pr-3 text-md font-medium text-ink outline-none focus:border-border-focus',
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
        <Button
          variant="secondary"
          onClick={onSaveDraft}
          disabled={busy}
          className="w-full sm:w-auto"
        >
          খসড়া রাখুন
        </Button>
        <Button onClick={onPrimary} disabled={busy} className="w-full sm:w-auto">
          {hasPapers ? 'বিল দেখুন' : 'বিল হিসাব করুন'}
        </Button>
      </div>
      <p className="mt-2 text-xs text-ink-faint sm:text-right">
        বিল দেখার পর কাগজ ছাপাবেন। টাকা পরে লেজারে লেখা হবে।
      </p>
      {saved ? (
        <p className="mt-1 text-xs text-success sm:text-right">খসড়া সংরক্ষিত হয়েছে।</p>
      ) : null}
    </>
  );
}
