import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRepository } from '../app/repository';
import Button from '../components/Button';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';
import { cn } from '../lib/cn';
import { cycleTotal } from '../lib/engine';
import { bnDigits, bnMonth, bnTaka } from '../lib/format';
import type { Bill, Property, Room, Tenant } from '../lib/types';

/**
 * 19 — কালেকশন. The owner records what came in against the papers already
 * printed. recordPayment() writes a ledger entry only — no receipt is created
 * anywhere on this flow (handoff §10/§14).
 */

type BillStatus = 'due' | 'partial' | 'paid' | 'overdue';

interface DueView {
  bill: Bill;
  roomNumber: string;
  tenantName: string;
  total: number;
  paid: number;
  due: number;
  hasPrevDue: boolean;
  status: BillStatus;
}

const STATUS_CHIP: Record<BillStatus, { label: string; chip: string; dot: string }> = {
  due: { label: 'বাকি', chip: 'bg-warning-tint text-ink', dot: 'bg-warning' },
  partial: { label: 'আংশিক', chip: 'bg-warning-tint text-warning', dot: 'bg-warning' },
  paid: { label: 'পরিশোধিত', chip: 'bg-success-tint text-success', dot: 'bg-success' },
  overdue: {
    label: 'অতিরিক্ত বকেয়া',
    chip: 'bg-danger-tint text-danger',
    dot: 'bg-danger',
  },
};

function BanknoteIcon() {
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
      <path d="M2 7h20v10H2V7z" />
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
      <path d="M6 10h.01M18 14h.01" />
    </svg>
  );
}

function CheckIcon() {
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
      <path d="m4 12 5 5L20 7" />
    </svg>
  );
}

const METHODS = ['নগদ', 'বিকাশ'] as const;

export default function CollectionDueList() {
  const repo = useRepository();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [month, setMonth] = useState('');
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [collected, setCollected] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('নগদ');
  const [note, setNote] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const activeMonth = await repo.getActiveMonth();
      const [prop, roomList, tenantList, billList, snapshot] = await Promise.all([
        repo.getProperty(),
        repo.listRooms(),
        repo.listTenants(),
        repo.listBills(activeMonth),
        repo.getDashboard(activeMonth),
      ]);
      if (!alive) return;
      setMonth(activeMonth);
      setProperty(prop);
      setRooms(roomList);
      setTenants(tenantList);
      setBills(billList);
      setCollected(snapshot.collectedTotal);
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

  const views = useMemo<DueView[]>(
    () =>
      bills.map((bill) => {
        const hasPrevDue = bill.lines.some((line) => line.kind === 'prev_due');
        const due = Math.max(0, bill.total - bill.paidAmount);
        const status: BillStatus =
          due <= 0 ? 'paid' : hasPrevDue ? 'overdue' : bill.paidAmount > 0 ? 'partial' : 'due';
        return {
          bill,
          roomNumber: roomNumber(bill.roomId),
          tenantName: tenantName(bill.tenantId),
          total: bill.total,
          paid: bill.paidAmount,
          due,
          hasPrevDue,
          status,
        };
      }),
    [bills, roomNumber, tenantName],
  );

  const billed = useMemo(() => cycleTotal(bills), [bills]);
  const remaining = Math.max(0, billed - collected);
  const percent = billed > 0 ? Math.round((collected / billed) * 100) : 0;
  const openCount = views.filter((view) => view.due > 0).length;
  const paidCount = views.length - openCount;

  const selected = views.find((view) => view.bill.id === selectedId) ?? null;

  const openSheet = (view: DueView) => {
    setSelectedId(view.bill.id);
    setAmount(String(view.due));
    setMethod('নগদ');
    setNote('');
    setError(null);
  };

  const confirmPayment = async () => {
    if (!selected) return;
    const parsed = Number(amount);
    if (amount === '' || !Number.isFinite(parsed) || parsed <= 0) {
      setError('আদায়ের পরিমাণ দিন।');
      return;
    }
    setBusy(true);
    try {
      await repo.recordPayment({
        billId: selected.bill.id,
        amount: parsed,
        paidAt: new Date().toISOString().slice(0, 10),
        method,
        note: note.trim() || undefined,
      });
      navigate('/collection/success', {
        state: { billId: selected.bill.id, amount: parsed, method },
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'আদায় লেখা যায়নি');
      setBusy(false);
    }
  };

  if (loading || !property) {
    return (
      <>
        <PageHeader title="কালেকশন" subtitle="লোড হচ্ছে…" backTo="/bills/preview" />
        <div aria-busy="true" aria-label="লোড হচ্ছে">
          <div className="mt-3 rounded-card border border-border bg-surface-raised px-5 py-4" aria-hidden="true">
            <div className="grid grid-cols-3 gap-3">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-5 w-24" />
              <div className="skeleton h-5 w-24" />
              <div className="skeleton h-5 w-24" />
            </div>
          </div>
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="mt-3 flex items-center justify-between gap-3 rounded-card border border-border bg-surface-raised px-5 py-4"
              aria-hidden="true"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-3 w-24" />
              </div>
              <div className="flex items-center gap-3">
                <div className="skeleton h-5 w-20" />
                <div className="skeleton h-9 w-20 rounded-button" />
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="lg:max-w-3xl">
      <PageHeader
        title={`কালেকশন — ${bnMonth(month)}`}
        subtitle={property.name}
        backTo="/bills/preview"
      />
      <p className="mt-1 text-xs text-ink-faint">
        টাকা এলে লেজারে লিখুন। নতুন রিসিট ছাপাবেন না — কাগজ আগেই গেছে।
      </p>

      <section
        className="mt-4 overflow-hidden rounded-card border border-border bg-surface-raised"
        aria-label="কালেকশনের সারসংক্ষেপ"
      >
        <div className="grid grid-cols-3 divide-x divide-border">
          <div className="px-3 py-4 text-center sm:px-4">
            <p className="text-xs text-ink-faint">মোট বিল</p>
            <p className="mt-1 text-lg leading-none font-bold text-ink sm:text-xl">
              {bnTaka(billed)}
            </p>
          </div>
          <div className="px-3 py-4 text-center sm:px-4">
            <p className="text-xs text-ink-faint">আদায় হয়েছে</p>
            <p className="mt-1 text-lg leading-none font-bold text-success sm:text-xl">
              {bnTaka(collected)}
            </p>
          </div>
          <div className="px-3 py-4 text-center sm:px-4">
            <p className="text-xs text-ink-faint">বাকি</p>
            <p className="mt-1 text-lg leading-none font-bold text-warning sm:text-xl">
              {bnTaka(remaining)}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border bg-surface-soft px-4 py-2 text-xs text-ink-muted">
          <span>{bnDigits(percent)}% আদায়</span>
          <span>
            {bnDigits(openCount)} জনের বাকি · {bnDigits(paidCount)} জন পরিশোধিত
          </span>
        </div>
      </section>

      <section className="mt-4" aria-label="বকেয়া রেন্টিদের তালিকা">
        <div className="divide-y divide-border rounded-card border border-border bg-surface-raised">
          {views.map((view) => {
            const chip = STATUS_CHIP[view.status];
            const isPaid = view.status === 'paid';
            return (
              <div key={view.bill.id} className="flex items-center gap-3 p-4">
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                    isPaid
                      ? 'bg-success-tint text-success'
                      : view.status === 'overdue'
                        ? 'bg-danger-tint text-danger'
                        : 'bg-primary-tint text-ink',
                  )}
                >
                  {view.tenantName.trim().slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{view.tenantName}</p>
                  <p className="text-xs text-ink-muted">
                    রুম {bnDigits(view.roomNumber)} ·{' '}
                    {view.status === 'overdue'
                      ? `আগের বাকি সহ মোট ${bnTaka(view.total)}`
                      : view.status === 'partial'
                        ? `মোট ${bnTaka(view.total)} · ${bnTaka(view.paid)} আদায়`
                        : `মোট ${bnTaka(view.total)}`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      'text-sm font-bold',
                      isPaid ? 'text-success' : view.status === 'overdue' ? 'text-danger' : 'text-ink',
                    )}
                  >
                    {bnTaka(view.due)}
                  </p>
                  <span
                    className={cn(
                      'mt-0.5 inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium',
                      chip.chip,
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', chip.dot)} />
                    {chip.label}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isPaid}
                  onClick={() => openSheet(view)}
                  className={cn(
                    'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-button px-3 py-2 text-sm font-semibold',
                    isPaid
                      ? 'bg-surface-soft text-ink-faint'
                      : 'bg-primary text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active',
                  )}
                >
                  {isPaid ? <CheckIcon /> : <BanknoteIcon />}
                  আদায়
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <Sheet
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        ariaLabel="আদায় নিশ্চিত করুন"
      >
        {selected ? (
          <>
            <div className="mt-4 flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary">
                <BanknoteIcon />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-ink">
                  {bnTaka(selected.due)} আদায় নিশ্চিত করুন
                </h2>
                <p className="text-sm text-ink-muted">
                  রুম {bnDigits(selected.roomNumber)} · {selected.tenantName} · {bnMonth(month)}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label htmlFor="sheet-amount" className="mb-1.5 block text-sm font-medium text-ink">
                আদায়ের পরিমাণ
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-md font-medium text-ink-faint">
                  ৳
                </span>
                <input
                  id="sheet-amount"
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="w-full rounded-input border border-border bg-surface-raised py-3 pl-10 pr-4 text-md font-semibold text-ink transition-colors focus:border-border-focus"
                />
              </div>
            </div>

            <p className="mt-4 text-sm font-medium text-ink">আদায়ের মাধ্যম</p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              {METHODS.map((option) => {
                const isSelected = method === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMethod(option)}
                    aria-pressed={isSelected}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-card border px-4 py-3 text-sm font-semibold text-ink transition-colors',
                      isSelected
                        ? 'border-border-focus bg-primary-tint'
                        : 'border-border bg-surface-raised hover:bg-surface-soft',
                    )}
                  >
                    <span
                      className={cn(
                        'h-3 w-3 rounded-full border-[1.5px]',
                        isSelected
                          ? 'border-primary bg-primary'
                          : 'border-border-strong bg-transparent',
                      )}
                    />
                    {option}
                  </button>
                );
              })}
            </div>

            <div className="mt-4">
              <label htmlFor="sheet-note" className="mb-1.5 block text-sm font-medium text-ink">
                নোট (ঐচ্ছিক)
              </label>
              <input
                id="sheet-note"
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="যেমন: বিকাশে পাঠিয়েছে"
                className="w-full rounded-input border border-border bg-surface-raised px-4 py-3 text-md text-ink transition-colors placeholder:text-ink-faint focus:border-border-focus"
              />
            </div>

            {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}

            <div className="mt-5 flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setSelectedId(null)}
              >
                বাতিল
              </Button>
              <Button
                className="flex-1"
                onClick={confirmPayment}
                disabled={busy}
                leadingIcon={<CheckIcon />}
              >
                আদায় নিশ্চিত করুন
              </Button>
            </div>
          </>
        ) : null}
      </Sheet>
    </div>
  );
}
