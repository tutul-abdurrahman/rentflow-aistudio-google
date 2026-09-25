import { useEffect, useMemo, useState } from 'react';
import { useRepository } from '../app/repository';
import Sheet from '../components/Sheet';
import StatusChip from '../components/StatusChip';
import { bnDigits, bnMonth, bnTaka } from '../lib/format';
import type { MonthlyLedgerRow, Property, Room } from '../lib/types';

/**
 * Screen 22 — মাসিক সারাংশ / লেজার (design-output/screens/22-*.html).
 *
 * One row per room from getMonthlyLedger(activeMonth). Sticky first column on
 * screen; A4-landscape print via src/theme/print-summary.css. The ইউনিট column
 * of the canvas is omitted: MonthlyLedgerRow carries the ৳ utilities total, not
 * raw units, and inventing a unit figure would be a fake number.
 */

const TH_CLASS =
  'border-b-2 border-border-strong bg-surface-soft px-3 py-2.5 text-xs font-semibold whitespace-nowrap';
const TD_CLASS = 'border-b border-border px-3 py-2.5 text-right whitespace-nowrap';

/** 7.5 → '৳৭.৫' (bnNumber rounds, so rates need their own formatter) */
function bnRate(value: number): string {
  return `৳${bnDigits(String(value))}`;
}

const STATUS_VARIANT = { paid: 'paid', partial: 'partial', due: 'due' } as const;

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

function HomeFilterIcon() {
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
      <path d="M3 9 12 3l9 6v12a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9z" />
    </svg>
  );
}

function PrinterIcon() {
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
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </svg>
  );
}

export default function MonthlySummaryLedger() {
  const repo = useRepository();

  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState('');
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [rows, setRows] = useState<MonthlyLedgerRow[]>([]);
  const [roomFilter, setRoomFilter] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);

  // Scopes print-summary.css to this screen only (see the file header).
  useEffect(() => {
    document.body.classList.add('print-summary');
    return () => document.body.classList.remove('print-summary');
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const activeMonth = await repo.getActiveMonth();
      const [ledgerRows, roomRows, propertyRow] = await Promise.all([
        repo.getMonthlyLedger(activeMonth),
        repo.listRooms(),
        repo.getProperty(),
      ]);
      if (!alive) return;
      setMonth(activeMonth);
      setRows(ledgerRows);
      setRooms(roomRows);
      setProperty(propertyRow);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [repo]);

  const roomOptions = useMemo(
    () => [...new Set(rows.map((row) => row.roomNumber))],
    [rows],
  );

  const visibleRows = useMemo(
    () => (roomFilter ? rows.filter((row) => row.roomNumber === roomFilter) : rows),
    [rows, roomFilter],
  );

  const totals = useMemo(
    () =>
      visibleRows.reduce(
        (acc, row) => ({
          rent: acc.rent + row.rent,
          utilities: acc.utilities + row.utilitiesTotal,
          waste: acc.waste + row.wasteFee,
          adjustments: acc.adjustments + row.adjustments,
          prevDue: acc.prevDue + row.prevDue,
          loan: acc.loan + row.loan,
          total: acc.total + row.total,
          paid: acc.paid + row.paid,
        }),
        {
          rent: 0,
          utilities: 0,
          waste: 0,
          adjustments: 0,
          prevDue: 0,
          loan: 0,
          total: 0,
          paid: 0,
        },
      ),
    [visibleRows],
  );

  const dueTotal = totals.total - totals.paid;
  const vacantRooms = rooms.filter((room) => room.status === 'vacant');
  const occupiedCount = rooms.length - vacantRooms.length;

  return (
    <>
      <header className="no-print pt-5 lg:flex lg:items-start lg:justify-between lg:pt-8">
        <div>
          <h1 className="text-xl font-bold text-ink">মাসিক সারাংশ</h1>
          <p className="mt-0.5 text-sm text-ink-muted">{property?.name ?? ''}</p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 lg:mt-0 lg:shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-raised px-3.5 py-2 text-sm font-semibold text-ink">
            <CalendarIcon />
            {month ? bnMonth(month) : '—'}
          </span>

          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-raised px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-surface-soft"
            aria-label="রুম ফিল্টার"
          >
            <HomeFilterIcon />
            {roomFilter ? `রুম ${bnDigits(roomFilter)}` : 'সব রুম'}
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
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 rounded-button bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active"
          >
            <PrinterIcon />
            প্রিন্ট
          </button>
        </div>
      </header>

      {/* print-only title */}
      <div className="print-only">
        <p className="text-lg font-bold text-ink">
          মাসিক সারাংশ লেজার — {month ? bnMonth(month) : ''}
        </p>
        <p className="text-sm text-ink-muted">
          {property ? `${property.name} · ${property.address} · ${bnDigits(property.ownerPhone)}` : ''}
        </p>
        <p className="mt-1 text-xs text-ink-faint">
          স্বাক্ষর কলাম ক্যাশ কালেকশনের সময় হাতে নেওয়ার জন্য খালি রাখা হয়েছে।
        </p>
      </div>

      {/* summary chips */}
      <section
        className="no-print mt-4 overflow-hidden rounded-card border border-border bg-surface-raised"
        aria-label={month ? `${bnMonth(month)} লেজারের সারসংক্ষেপ` : 'লেজারের সারসংক্ষেপ'}
      >
        <div className="grid grid-cols-3 divide-x divide-border">
          <div className="px-3 py-4 text-center sm:px-4">
            <p className="text-xs text-ink-faint">মোট বিল</p>
            <p className="mt-1 text-lg font-bold leading-none text-ink sm:text-xl">
              {loading ? '—' : bnTaka(totals.total)}
            </p>
          </div>
          <div className="px-3 py-4 text-center sm:px-4">
            <p className="text-xs text-ink-faint">আদায়</p>
            <p className="mt-1 text-lg font-bold leading-none text-success sm:text-xl">
              {loading ? '—' : bnTaka(totals.paid)}
            </p>
          </div>
          <div className="px-3 py-4 text-center sm:px-4">
            <p className="text-xs text-ink-faint">বাকি</p>
            <p className="mt-1 text-lg font-bold leading-none text-warning sm:text-xl">
              {loading ? '—' : bnTaka(dueTotal)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-soft px-4 py-2 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            {bnDigits(occupiedCount)}টি সক্রিয় রুম
            {vacantRooms.length > 0
              ? ` · ${vacantRooms.map((room) => bnDigits(room.number)).join(', ')} খালি`
              : ''}
          </span>
          <span>
            বিদ্যুৎ {bnRate(property?.electricityRate ?? 0)}/ইউনিট · ওয়েস্ট{' '}
            {bnRate(property?.wasteFee ?? 0)}/রুম
          </span>
        </div>
      </section>

      {/* ledger table */}
      <section
        className="ledger-card mt-4 overflow-hidden rounded-card border border-border bg-surface-raised"
        aria-label="মাসিক লেজার — রুম অনুযায়ী"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-ink">মাসিক লেজার</h2>
          <span className="text-xs font-medium text-ink-faint">
            {month ? bnMonth(month) : ''} · {bnDigits(visibleRows.length)}টি এন্ট্রি
          </span>
        </div>

        <p className="no-print flex items-center gap-1.5 px-4 pt-2.5 text-xs text-ink-faint xl:hidden">
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
            <path d="M4 12h16M14 6l6 6-6 6" />
          </svg>
          ডানে স্ক্রল করুন — সব কলাম দেখতে
        </p>

        <div className="ledger-scroll overflow-x-auto">
          <table className="ledger-table w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className={`${TH_CLASS} sticky left-0 z-10 text-ink`}>রুম · রেন্টি</th>
                <th className={`${TH_CLASS} text-right text-ink-muted`}>
                  ইউটিলিটি
                  <span className="block text-[10px] font-medium">বিদ্যুৎ+পানি</span>
                </th>
                <th className={`${TH_CLASS} text-right text-ink-muted`}>ওয়েস্ট</th>
                <th className={`${TH_CLASS} text-right text-ink-muted`}>ভাড়া</th>
                <th className={`${TH_CLASS} text-right text-ink-muted`}>অ্যাডজাস্ট</th>
                <th className={`${TH_CLASS} text-right text-ink-muted`}>আগের বাকি</th>
                <th className={`${TH_CLASS} text-right text-ink-muted`}>লোন</th>
                <th className={`${TH_CLASS} text-right text-ink`}>মোট</th>
                <th className={`${TH_CLASS} text-right text-ink`}>পরিশোধিত</th>
                <th className={`${TH_CLASS} text-ink-muted`}>স্ট্যাটাস</th>
                <th className={`${TH_CLASS} text-ink-muted`}>স্বাক্ষর</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td className={`${TD_CLASS} text-left text-ink-faint`} colSpan={11}>
                    লোড হচ্ছে…
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td className={`${TD_CLASS} text-left text-ink-faint`} colSpan={11}>
                    এই মাসে কোনো বিল নেই।
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr key={row.paperRef || row.roomNumber}>
                    <td
                      className="sticky left-0 z-10 border-b border-border bg-surface-raised px-3 py-2.5 whitespace-nowrap"
                    >
                      <span className="block text-sm font-bold text-ink">
                        {bnDigits(row.roomNumber)}
                      </span>
                      <span className="block max-w-28 truncate text-xs text-ink-muted">
                        {row.tenantName}
                      </span>
                      <span className="block text-[10px] text-ink-faint">{row.paperRef}</span>
                    </td>
                    <td className={`${TD_CLASS} text-ink`}>{bnTaka(row.utilitiesTotal)}</td>
                    <td className={`${TD_CLASS} text-ink-muted`}>{bnTaka(row.wasteFee)}</td>
                    <td className={`${TD_CLASS} text-ink`}>{bnTaka(row.rent)}</td>
                    <td className={`${TD_CLASS} ${row.adjustments === 0 ? 'text-ink-faint' : 'text-ink'}`}>
                      {bnTaka(row.adjustments)}
                    </td>
                    <td className={`${TD_CLASS} ${row.prevDue === 0 ? 'text-ink-muted' : 'text-danger'}`}>
                      {bnTaka(row.prevDue)}
                    </td>
                    <td className={`${TD_CLASS} ${row.loan === 0 ? 'text-ink-faint' : 'text-ink'}`}>
                      {bnTaka(row.loan)}
                    </td>
                    <td className={`${TD_CLASS} font-bold text-ink`}>{bnTaka(row.total)}</td>
                    <td
                      className={`${TD_CLASS} font-semibold ${
                        row.paid >= row.total ? 'text-success' : 'text-ink'
                      }`}
                    >
                      {bnTaka(row.paid)}
                    </td>
                    <td className={`${TD_CLASS} text-right`}>
                      <StatusChip variant={STATUS_VARIANT[row.status]} />
                    </td>
                    <td className="border-b border-border px-3 py-2.5 text-center whitespace-nowrap text-ink-faint">
                      —
                    </td>
                  </tr>
                ))
              )}

              {!loading && visibleRows.length > 0 ? (
                <tr className="bg-surface-soft">
                  <td className="sticky left-0 z-10 border-t-2 border-border-strong bg-surface-soft px-3 py-3 text-sm font-bold whitespace-nowrap text-ink">
                    মোট
                  </td>
                  <td className="border-t-2 border-border-strong px-3 py-3 text-right text-sm font-bold whitespace-nowrap text-ink">
                    {bnTaka(totals.utilities)}
                  </td>
                  <td className="border-t-2 border-border-strong px-3 py-3 text-right text-sm font-bold whitespace-nowrap text-ink">
                    {bnTaka(totals.waste)}
                  </td>
                  <td className="border-t-2 border-border-strong px-3 py-3 text-right text-sm font-bold whitespace-nowrap text-ink">
                    {bnTaka(totals.rent)}
                  </td>
                  <td className="border-t-2 border-border-strong px-3 py-3 text-right text-sm font-bold whitespace-nowrap text-ink-faint">
                    {bnTaka(totals.adjustments)}
                  </td>
                  <td className="border-t-2 border-border-strong px-3 py-3 text-right text-sm font-bold whitespace-nowrap text-ink">
                    {bnTaka(totals.prevDue)}
                  </td>
                  <td className="border-t-2 border-border-strong px-3 py-3 text-right text-sm font-bold whitespace-nowrap text-ink">
                    {bnTaka(totals.loan)}
                  </td>
                  <td className="border-t-2 border-border-strong px-3 py-3 text-right text-base font-bold whitespace-nowrap text-ink">
                    {bnTaka(totals.total)}
                  </td>
                  <td className="border-t-2 border-border-strong px-3 py-3 text-right text-base font-bold whitespace-nowrap text-success">
                    {bnTaka(totals.paid)}
                  </td>
                  <td className="border-t-2 border-border-strong px-3 py-3 text-sm font-bold whitespace-nowrap text-warning">
                    বাকি {bnTaka(dueTotal)}
                  </td>
                  <td className="border-t-2 border-border-strong px-3 py-3 text-center text-sm whitespace-nowrap text-ink-faint">
                    —
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="no-print flex items-center justify-between gap-3 border-t border-border bg-surface-soft px-4 py-2.5 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
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
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            </svg>
            প্রিন্ট ডায়ালগে Margin: None রাখুন — কাগজের জন্য A4 ল্যান্ডস্কেপ সেট করা আছে।
          </span>
        </div>
      </section>

      {/* room filter sheet */}
      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} ariaLabel="রুম ফিল্টার">
        <div className="mt-4 space-y-1">
          <button
            type="button"
            onClick={() => {
              setRoomFilter(null);
              setFilterOpen(false);
            }}
            className={`flex w-full items-center rounded-md px-4 py-3 text-left text-sm ${
              roomFilter === null ? 'bg-primary-tint font-semibold text-primary' : 'text-ink-muted hover:bg-surface-soft'
            }`}
          >
            সব রুম
          </button>
          {roomOptions.map((roomNumber) => (
            <button
              key={roomNumber}
              type="button"
              onClick={() => {
                setRoomFilter(roomNumber);
                setFilterOpen(false);
              }}
              className={`flex w-full items-center rounded-md px-4 py-3 text-left text-sm ${
                roomFilter === roomNumber
                  ? 'bg-primary-tint font-semibold text-primary'
                  : 'text-ink-muted hover:bg-surface-soft'
              }`}
            >
              রুম {bnDigits(roomNumber)}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
