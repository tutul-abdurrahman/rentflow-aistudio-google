import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRepository } from '../app/repository';
import Button from '../components/Button';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import Sheet from '../components/Sheet';
import { cn } from '../lib/cn';
import { cycleTotal } from '../lib/engine';
import { bnDigits, bnMonth, bnNumber, bnTaka } from '../lib/format';
import type { Bill, BillLine, Loan, Property, Room, Tenant } from '../lib/types';

/**
 * 17 — বিল প্রিভিউ. Monthly cycle step 2: review the papers listBills() built,
 * then print (04). Do NOT collect here (handoff §8/§14). Adjustments (18) are
 * linked; a per-room reprint (21) is available for lost slips.
 */

interface BillView {
  bill: Bill;
  roomNumber: string;
  tenantName: string;
  rent: number;
  utilities: number;
  waste: number;
  adjustments: number;
  adjustmentLines: BillLine[];
  prevDue: number;
  loan: number;
  utilityUnits: number;
  loanRecord?: Loan;
}

const sumKind = (bill: Bill, kind: BillLine['kind']): number =>
  bill.lines.filter((line) => line.kind === kind).reduce((sum, line) => sum + line.amount, 0);

/**
 * Unit truth for a bill is the engine line detail ('123 unit × 7.5',
 * '83.33 unit × 7.5'), not the current property rate. Dividing the stored
 * ৳ utilities by today's rate breaks as soon as the rate changes.
 */
const lineUnits = (line?: BillLine): number => {
  const match = line?.detail ? /^(-?\d+(?:\.\d+)?)\s*unit/.exec(line.detail.trim()) : null;
  return match ? Number(match[1]) : 0;
};

/** '123 unit × 7.5' → '১২৩ ইউনিট × ৭.৫' */
const detailBn = (detail?: string): string =>
  detail ? bnDigits(detail).replace(' unit × ', ' ইউনিট × ') : '';

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

function PrintIcon() {
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
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a1 1 0 0 1-1-1v-5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v5a1 1 0 0 1-1 1h-2" />
      <path d="M6 14h12v8H6z" />
    </svg>
  );
}

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

export default function BillPreview() {
  const repo = useRepository();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState('');
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const activeMonth = await repo.getActiveMonth();
      const [prop, roomList, tenantList, loanList, billList] = await Promise.all([
        repo.getProperty(),
        repo.listRooms(),
        repo.listTenants(),
        repo.listLoans(),
        repo.listBills(activeMonth),
      ]);
      if (!alive) return;
      setMonth(activeMonth);
      setProperty(prop);
      setRooms(roomList);
      setTenants(tenantList);
      setLoans(loanList);
      setBills(billList);
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
    return (roomId: string): string => map.get(roomId) ?? '';
  }, [rooms]);

  const tenantName = useMemo(() => {
    const map = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
    return (tenantId: string): string => map.get(tenantId) ?? '';
  }, [tenants]);

  const views = useMemo<BillView[]>(
    () =>
      bills.map((bill) => {
        const loan = loans.find((item) => item.tenantId === bill.tenantId && item.status === 'active');
        const utilities = bill.utilitiesTotal;
        const electricity = bill.lines.find((line) => line.kind === 'electricity');
        const water = bill.lines.find((line) => line.kind === 'water');
        return {
          bill,
          roomNumber: roomNumber(bill.roomId),
          tenantName: tenantName(bill.tenantId),
          rent: sumKind(bill, 'rent'),
          utilities,
          waste: sumKind(bill, 'waste'),
          adjustments: sumKind(bill, 'adjustment'),
          adjustmentLines: bill.lines.filter((line) => line.kind === 'adjustment'),
          prevDue: sumKind(bill, 'prev_due'),
          loan: sumKind(bill, 'loan'),
          utilityUnits: lineUnits(electricity) + lineUnits(water),
          loanRecord: loan,
        };
      }),
    [bills, loans, roomNumber, tenantName],
  );

  const selected = views.find((view) => view.bill.id === selectedId) ?? null;

  const totals = useMemo(() => {
    const billed = cycleTotal(bills);
    const paid = bills.reduce((sum, bill) => sum + bill.paidAmount, 0);
    return { billed, paid, due: billed - paid };
  }, [bills]);

  const vacantNumbers = useMemo(
    () => rooms.filter((room) => room.status === 'vacant').map((room) => bnDigits(room.number)),
    [rooms],
  );

  const rateLabel = property ? bnDigits(property.electricityRate) : '';
  const wasteLabel = property ? bnDigits(property.wasteFee) : '';

  const utilityNote = (view: BillView): string => {
    const parts: string[] = [];
    const electricity = view.bill.lines.find((line) => line.kind === 'electricity');
    const water = view.bill.lines.find((line) => line.kind === 'water');
    if (electricity?.detail) parts.push(`বিদ্যুৎ ${detailBn(electricity.detail)}`);
    if (water?.detail) parts.push(`পানি ভাগ ${detailBn(water.detail)}`);
    return parts.join(' + ');
  };

  if (loading || !property) {
    return (
      <>
        <PageHeader title="বিল" subtitle="লোড হচ্ছে…" backTo="/bills/meters" />
        <div aria-busy="true" aria-label="লোড হচ্ছে">
          <div className="mt-3 flex flex-wrap items-center gap-2 md:justify-end" aria-hidden="true">
            <div className="skeleton h-10 w-28" />
            <div className="skeleton h-10 w-20" />
            <div className="skeleton h-10 w-24" />
          </div>
          <div
            className="mt-3 overflow-hidden rounded-card border border-border bg-surface-raised"
            aria-hidden="true"
          >
            <div className="flex items-center justify-between px-5 py-4">
              <div className="skeleton h-4 w-36" />
              <div className="skeleton h-4 w-20" />
            </div>
            {[0, 1, 2, 3, 4].map((index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-3 border-t border-border px-5 py-3.5"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="skeleton h-4 w-28" />
                  <div className="skeleton h-3 w-40 max-w-[60%]" />
                </div>
                <div className="skeleton h-5 w-20" />
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-card border border-border bg-surface-raised px-5 py-4" aria-hidden="true">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton mt-3 h-5 w-32" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`বিল — ${bnMonth(month)}`}
        subtitle={property.name}
        backTo="/bills/meters"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2 md:justify-end">
        <span className="inline-flex h-10 items-center gap-1.5 rounded-pill border border-border bg-surface-raised px-3.5 text-sm font-semibold text-ink">
          <CalendarIcon />
          {bnMonth(month)}
        </span>
        {bills.length > 0 ? (
          <Link
            to="/bills/print"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-button bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active"
          >
            <PrintIcon />
            কাগজ ছাপুন
          </Link>
        ) : null}
      </div>

      {bills.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="এই মাসের কাগজ তৈরি হয়নি"
            caption="মিটার রিডিং দিয়ে বিল হিসাব করুন।"
            actionLabel="মিটার রিডিং দিন"
            onAction={() => navigate('/bills/meters')}
          />
        </div>
      ) : (
        <>
          <section
            className="mt-4 overflow-hidden rounded-card border border-border bg-surface-raised"
            aria-label={`${bnMonth(month)} বিলের সারসংক্ষেপ`}
          >
            <div className="grid grid-cols-3 divide-x divide-border">
              <div className="px-3 py-4 text-center sm:px-4">
                <p className="text-xs text-ink-faint">মোট বিল</p>
                <p className="mt-1 text-lg font-bold leading-none text-ink sm:text-xl">
                  {bnTaka(totals.billed)}
                </p>
              </div>
              <div className="px-3 py-4 text-center sm:px-4">
                <p className="text-xs text-ink-faint">আদায় হয়েছে</p>
                <p className="mt-1 text-lg font-bold leading-none text-ink sm:text-xl">
                  {bnTaka(totals.paid)}
                </p>
              </div>
              <div className="px-3 py-4 text-center sm:px-4">
                <p className="text-xs text-ink-faint">নিট অনাদায়ী</p>
                <p className="mt-1 text-lg font-bold leading-none text-ink sm:text-xl">
                  {bnTaka(totals.due)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-border bg-surface-soft px-4 py-2 text-xs text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {bnDigits(bills.length)}টি কাগজ প্রস্তুত
                {vacantNumbers.length > 0 ? ` · ${vacantNumbers.join(', ')} খালি` : ''}
              </span>
              <span>
                বর্তমান রেট: বিদ্যুৎ ৳{rateLabel}/ইউনিট · ওয়েস্ট ৳{wasteLabel}/রুম
              </span>
            </div>
          </section>

          <section className="mt-4 md:hidden" aria-label="রেন্টি অনুযায়ী বিল">
            <div className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface-raised">
              {views.map((view) => (
                <button
                  key={view.bill.id}
                  type="button"
                  onClick={() => setSelectedId(view.bill.id)}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-soft"
                >
                  <span className="w-10 shrink-0 text-sm font-bold text-ink">
                    {bnDigits(view.roomNumber)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">
                    {view.tenantName}
                  </span>
                  <span className="shrink-0 text-base font-bold text-ink">
                    {bnTaka(view.bill.total)}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-4 hidden md:block" aria-label="রেন্টি অনুযায়ী বিল টেবিল">
            <div className="overflow-x-auto rounded-card border border-border bg-surface-raised">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr>
                    {['রুম', 'নাম'].map((head) => (
                      <th
                        key={head}
                        className="border-b-2 border-border-strong bg-surface-soft px-3 py-2.5 text-xs font-semibold whitespace-nowrap text-ink"
                      >
                        {head}
                      </th>
                    ))}
                    {['ভাড়া', 'ইউটিলিটি', 'ওয়েস্ট', 'আগের বাকি', 'লোন'].map((head) => (
                      <th
                        key={head}
                        className="border-b-2 border-border-strong bg-surface-soft px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap text-ink-muted"
                      >
                        {head}
                      </th>
                    ))}
                    <th className="border-b-2 border-border-strong bg-surface-soft px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap text-ink">
                      মোট
                    </th>
                    <th className="border-b-2 border-border-strong bg-surface-soft px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap text-ink-muted">
                      রিপ্রিন্ট
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {views.map((view) => (
                    <tr key={view.bill.id}>
                      <td className="border-b border-border px-3 py-2.5 font-bold whitespace-nowrap text-ink">
                        {bnDigits(view.roomNumber)}
                      </td>
                      <td className="border-b border-border px-3 py-2.5 whitespace-nowrap text-ink">
                        {view.tenantName}
                      </td>
                      <td className="border-b border-border px-3 py-2.5 text-right whitespace-nowrap text-ink">
                        {bnTaka(view.rent)}
                      </td>
                      <td className="border-b border-border px-3 py-2.5 text-right whitespace-nowrap">
                        <span className="block text-ink">{bnTaka(view.utilities)}</span>
                        <span className="block text-[10px] text-ink-faint">
                          {bnNumber(view.utilityUnits)} ইউনিট
                        </span>
                      </td>
                      <td className="border-b border-border px-3 py-2.5 text-right whitespace-nowrap text-ink-muted">
                        {bnTaka(view.waste)}
                      </td>
                      <td
                        className={cn(
                          'border-b border-border px-3 py-2.5 text-right whitespace-nowrap',
                          view.prevDue > 0 ? 'font-semibold text-danger' : 'text-ink-faint',
                        )}
                      >
                        {bnTaka(view.prevDue)}
                      </td>
                      <td className="border-b border-border px-3 py-2.5 text-right whitespace-nowrap">
                        {view.loan > 0 ? (
                          <>
                            <span className="block font-semibold text-ink">{bnTaka(view.loan)}</span>
                            {view.loanRecord ? (
                              <span className="block text-[10px] text-ink-faint">
                                কিস্তি {bnDigits(view.loanRecord.paidInstallments)}/
                                {bnDigits(view.loanRecord.installmentCount)}
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="border-b border-border px-3 py-2.5 text-right whitespace-nowrap">
                        <span className="block font-bold text-ink">{bnTaka(view.bill.total)}</span>
                        {view.adjustments !== 0 ? (
                          <span className="block text-[10px] text-ink-faint">
                            {bnTaka(view.adjustments)} সমন্বয়
                          </span>
                        ) : null}
                      </td>
                      <td className="border-b border-border px-3 py-2.5 text-right whitespace-nowrap">
                        <Link
                          to={`/bills/reprint/${view.bill.tenantId}`}
                          className="text-xs font-semibold text-ink-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
                        >
                          রিপ্রিন্ট
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="mt-2 text-xs text-ink-faint">
            রুম {vacantNumbers.join(', ') || '—'} খালি — এই মাসে কাগজ নেই। ওয়েস্ট, পানির ভাগ বা
            অটো বিদ্যুৎ যোগ হয়নি।
          </p>

          <div className="mt-4 pb-1 md:mt-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-stretch">
              <Link
                to="/bills/print"
                className="inline-flex w-full items-center justify-center gap-2 rounded-button bg-primary px-5 py-3 text-base font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active md:flex-1"
              >
                <PrintIcon />
                কাগজ ছাপুন
              </Link>
              <Link
                to="/bills/adjustments"
                className="inline-flex w-full items-center justify-center gap-2 rounded-button border border-secondary bg-surface-raised px-5 py-3 text-base font-semibold text-secondary transition-colors hover:bg-secondary-hover active:bg-secondary-active md:flex-1"
              >
                <PlusIcon />
                অ্যাডজাস্টমেন্ট
              </Link>
            </div>
            <p className="mt-2 text-center text-xs text-ink-faint">
              এই কাগজগুলো এখন ভাড়াটেদের হাতে দিন। টাকা এলে কালেকশনে লেজারে লেখা হবে — নতুন
              রিসিট ছাপতে হবে না।
            </p>
          </div>
        </>
      )}

      <Sheet
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        ariaLabel="বিলের বিবরণ"
      >
        {selected ? (
          <>
            <div className="mt-4">
              <h2 className="text-lg font-semibold text-ink">
                রুম {bnDigits(selected.roomNumber)} · {selected.tenantName}
              </h2>
              <p className="text-sm text-ink-muted">{bnMonth(month)}</p>
            </div>

            <div className="mt-4 space-y-2.5">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-ink-muted">ভাড়া</span>
                <span className="font-semibold text-ink">{bnTaka(selected.rent)}</span>
              </div>
              <div>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-ink-muted">বিদ্যুৎ ও পানি</span>
                  <span className="font-semibold text-ink">{bnTaka(selected.utilities)}</span>
                </div>
                {utilityNote(selected) ? (
                  <p className="mt-1 text-xs text-ink-faint">{utilityNote(selected)}</p>
                ) : null}
              </div>
              <div className="flex items-baseline justify-between border-t border-border pt-2.5 text-sm">
                <span className="text-ink-muted">ওয়েস্ট</span>
                <span className="font-semibold text-ink">{bnTaka(selected.waste)}</span>
              </div>
              {selected.adjustmentLines.map((line) => (
                <div
                  key={`${line.detail ?? 'adj'}-${line.amount}`}
                  className="flex items-baseline justify-between text-sm"
                >
                  <span className="text-ink-muted">{line.detail ?? line.label}</span>
                  <span className="font-semibold text-ink">{bnTaka(line.amount)}</span>
                </div>
              ))}
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-ink-muted">আগের বাকি</span>
                <span
                  className={cn(
                    'font-semibold',
                    selected.prevDue > 0 ? 'text-danger' : 'text-ink',
                  )}
                >
                  {bnTaka(selected.prevDue)}
                </span>
              </div>
              {selected.loan > 0 ? (
                <div>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-ink-muted">লোন কিস্তি</span>
                    <span className="font-semibold text-ink">{bnTaka(selected.loan)}</span>
                  </div>
                  {selected.loanRecord?.note ? (
                    <p className="mt-1 text-xs text-ink-faint">{selected.loanRecord.note}</p>
                  ) : null}
                </div>
              ) : null}
              <div className="flex items-baseline justify-between border-t-2 border-border-strong pt-2.5 text-sm font-bold text-ink">
                <span>মোট</span>
                <span className="text-base">{bnTaka(selected.bill.total)}</span>
              </div>
            </div>

            <Link
              to={`/bills/reprint/${selected.bill.tenantId}`}
              className="mt-5 inline-flex w-full items-center justify-center rounded-button border border-secondary bg-surface-raised px-5 py-3 text-base font-semibold text-secondary transition-colors hover:bg-secondary-hover active:bg-secondary-active"
            >
              রিপ্রিন্ট কাগজ
            </Link>
            <Button
              variant="ghost"
              fullWidth
              className="mt-2"
              onClick={() => setSelectedId(null)}
            >
              বন্ধ করুন
            </Button>
          </>
        ) : null}
      </Sheet>
    </>
  );
}
