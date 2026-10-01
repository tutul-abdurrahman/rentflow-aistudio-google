import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useRepository } from '../app/repository';
import EmptyState from '../components/EmptyState';
import KpiCard, { type KpiTrend } from '../components/KpiCard';
import MonthSelect from '../components/MonthSelect';
import Sheet from '../components/Sheet';
import StatusChip from '../components/StatusChip';
import { bnDate, bnDigits, bnMonth, bnNumber, bnTaka } from '../lib/format';
import { isMonthKey } from '../lib/screen-month';
import type {
  Bill,
  CashflowRow,
  DashboardSnapshot,
  LedgerEntry,
  Loan,
  MeterEntry,
  Property,
  Room,
} from '../lib/types';

/**
 * 02 — হোম / ড্যাশবোর্ড. Every number is recomputed from the repository:
 * the viewed month (?month= → latest billed → active) → getDashboard(month) +
 * getCashflow(...) + listBills/rooms/loans/ledger. No canvas figures are
 * hardcoded. Loading and first-month empty are real states (§13 debt 4), not
 * the annotated design previews.
 */

/* ---------- date / axis helpers ---------- */

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function lastMonths(month: string, count: number): string[] {
  const months: string[] = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    months.push(shiftMonth(month, -index));
  }
  return months;
}

function niceStep(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const normalized = value / power;
  const factor =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return factor * power;
}

function shortMonth(month: string): string {
  return bnMonth(month).split(' ')[0];
}

/* ---------- icons (inline stroke SVG, no emoji) ---------- */

function StrokeIcon({
  size = 20,
  children,
}: {
  size?: number;
  children: ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const SunIcon = () => (
  <StrokeIcon size={26}>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" />
  </StrokeIcon>
);

const BellIcon = () => (
  <StrokeIcon size={22}>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </StrokeIcon>
);

const GaugeIcon = () => (
  <StrokeIcon size={22}>
    <path d="M3.5 18a8.5 8.5 0 1 1 17 0" />
    <path d="m12 14 3-3" />
    <circle cx="12" cy="14" r="1.4" />
  </StrokeIcon>
);

const BillIcon = () => (
  <StrokeIcon size={22}>
    <path d="M6 2h12v20l-2-1.5L14 22l-2-1.5L10 22l-2-1.5L6 22V2z" />
    <path d="M9 7h6M9 11h6M9 15h4" />
  </StrokeIcon>
);

const PrinterIcon = () => (
  <StrokeIcon size={22}>
    <path d="M6 9V3h12v6" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" rx="1" />
  </StrokeIcon>
);

const WalletIcon = () => (
  <StrokeIcon size={22}>
    <path d="M20 7H5a2 2 0 0 1-2-2 2 2 0 0 1 2-2h13v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h15v-4" />
    <path d="M21 12h-4a2 2 0 0 0 0 4h4z" />
  </StrokeIcon>
);

const CashIcon = ({ size = 16 }: { size?: number }) => (
  <StrokeIcon size={size}>
    <path d="M2 7h20v10H2V7z" />
    <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
    <path d="M6 10h.01M18 14h.01" />
  </StrokeIcon>
);

const BoltIcon = ({ size = 18 }: { size?: number }) => (
  <StrokeIcon size={size}>
    <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
  </StrokeIcon>
);

const CreditCardIcon = ({ size = 18 }: { size?: number }) => (
  <StrokeIcon size={size}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
  </StrokeIcon>
);

/* ---------- data shape ---------- */

interface DashboardData {
  month: string;
  property: Property;
  dashboard: DashboardSnapshot;
  previous: DashboardSnapshot;
  cashflow: CashflowRow[];
  bills: Bill[];
  rooms: Room[];
  loans: Loan[];
  ledger: LedgerEntry[];
  meter: MeterEntry | null;
}

const CONTENT_CLASS = 'mt-3 rounded-card border border-border bg-surface-raised p-4';
const ICON_BUTTON_CLASS =
  'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-button bg-primary px-3 py-2 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active';

/* ---------- header ---------- */

function DashboardHeader({
  property,
  month,
  anchorMonth,
  onPickMonth,
  onOpenNotifications,
}: {
  property: Property;
  month: string;
  /** latest cycle month — the month dropdown window anchors here */
  anchorMonth: string;
  onPickMonth: (month: string) => void;
  onOpenNotifications: () => void;
}) {
  const cycleLabel = `${bnDigits(month.slice(5, 7))}/${bnDigits(month.slice(0, 4))}`;
  return (
    <header className="pt-5 lg:flex lg:items-center lg:justify-between lg:pt-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="shrink-0 text-primary">
            <SunIcon />
          </span>
          <div>
            <h1 className="text-lg font-bold leading-tight text-ink">
              শুভ সকাল, {property.ownerName}
            </h1>
            <p className="text-sm text-ink-muted">{property.name}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenNotifications}
          className="relative flex h-10 w-10 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-soft"
          aria-label="নোটিফিকেশন"
        >
          <BellIcon />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-danger" />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between lg:mt-0 lg:gap-3">
        <MonthSelect
          value={month}
          months={lastMonths(anchorMonth, 12)}
          onChange={onPickMonth}
          align="left"
        />
        <span className="text-xs font-medium text-ink-faint">
          মাস {cycleLabel}
        </span>
      </div>
    </header>
  );
}

/* ---------- cycle tile ---------- */

function CycleTile({
  to,
  done,
  step,
  title,
  caption,
  icon,
}: {
  to: string;
  done: boolean;
  step: string;
  title: string;
  caption: string;
  icon: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="rounded-card border border-border bg-surface-raised p-4 transition-colors hover:bg-surface-soft"
    >
      <div className="flex items-start justify-between">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            done ? 'bg-primary-tint text-primary' : 'bg-surface-soft text-ink-muted'
          }`}
        >
          {step}
        </span>
        <span className={done ? 'shrink-0 text-primary' : 'shrink-0 text-ink-faint'}>
          {icon}
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold text-ink">{title}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{caption}</p>
    </Link>
  );
}

/* ---------- skeleton (real loading state) ---------- */

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="লোড হচ্ছে">
      <div className="pt-5 lg:pt-8" aria-hidden="true">
        <div className="skeleton h-5 w-40" />
        <div className="skeleton mt-2 h-3 w-28" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className={CONTENT_CLASS}>
            <div className="skeleton h-3 w-20" />
            <div className="skeleton mt-3 h-6 w-24" />
            <div className="skeleton mt-3 h-3 w-16" />
          </div>
        ))}
      </div>
      <div
        className="mt-3 divide-y divide-border rounded-card border border-border bg-surface-raised"
        aria-hidden="true"
      >
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="skeleton h-3 w-32" />
              <div className="skeleton h-3 w-24" />
            </div>
            <div className="skeleton h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- screen ---------- */

export default function Dashboard() {
  const repo = useRepository();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * anchor = the latest billed month (the picker window anchors here);
   * chosen = the month the owner picked to view, null → anchor.
   */
  const [months, setMonths] = useState<{ anchor: string | null; chosen: string | null }>({
    anchor: null,
    chosen: isMonthKey(searchParams.get('month')) ? searchParams.get('month') : null,
  });
  const [notifyOpen, setNotifyOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const now = new Date();
      const deviceMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const anchor = months.anchor ?? deviceMonth;
      const month = months.chosen ?? anchor;
      if (!alive) return;
      if (!months.anchor) setMonths((current) => ({ ...current, anchor }));
      const window = lastMonths(month, 6);
      const [property, dashboard, previous, cashflow, bills, rooms, loans, ledger, meter] =
        await Promise.all([
          repo.getProperty(),
          repo.getDashboard(month),
          repo.getDashboard(shiftMonth(month, -1)),
          repo.getCashflow(window),
          repo.listBills(month),
          repo.listRooms(),
          repo.listLoans(),
          repo.listLedger(month),
          repo.getMeterEntry(month),
        ]);
      if (!alive) return;
      setData({
        month,
        property,
        dashboard,
        previous,
        cashflow,
        bills,
        rooms,
        loans,
        ledger,
        meter,
      });
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [repo, months]);

  const pickMonth = (month: string) => {
    if (!data || month === data.month) return;
    setSearchParams({ month }, { replace: true });
    setMonths((current) => ({ ...current, chosen: month }));
    setData(null);
    setLoading(true);
  };

  if (loading || !data) {
    return <DashboardSkeleton />;
  }

  const { month, property, dashboard, previous, cashflow, bills, rooms, loans, ledger, meter } =
    data;

  if (bills.length === 0) {
    return (
      <>
        <DashboardHeader
          property={property}
          month={month}
          anchorMonth={months.anchor ?? month}
          onPickMonth={pickMonth}
          onOpenNotifications={() => setNotifyOpen(true)}
        />
        <EmptyState
          className="mt-4"
          title="এখনও কোনো বিল নেই"
          caption="প্রথম মাসের মিটার রিডিং দিয়ে বিল তৈরি শুরু করুন।"
          actionLabel="প্রথম বিল তৈরি করুন"
          onAction={() => navigate('/bills/meters')}
        />
      </>
    );
  }

  /* ---- KPI numbers ---- */
  /** Below this base a Δ% is noise (৳1 base → +2,58,200%); show taka instead. */
  const MIN_TREND_BASE = 1000;
  let dueTrend: KpiTrend;
  if (previous.dueTotal <= 0) {
    dueTrend = { text: 'গত মাসে বকেয়া ছিল না', tone: 'muted' };
  } else if (previous.dueTotal < MIN_TREND_BASE) {
    const delta = dashboard.dueTotal - previous.dueTotal;
    dueTrend = {
      text: `গত মাসের চেয়ে ${delta >= 0 ? '+' : '−'}${bnTaka(Math.abs(delta))}`,
      tone: delta >= 0 ? 'warning' : 'success',
    };
  } else {
    const change = Math.round(
      ((dashboard.dueTotal - previous.dueTotal) / previous.dueTotal) * 100,
    );
    const up = change >= 0;
    dueTrend = {
      text: `গত মাসের চেয়ে ${up ? '+' : '−'}${bnNumber(Math.abs(change))}%`,
      tone: up ? 'warning' : 'success',
    };
  }

  const monthCashflow = cashflow.find((row) => row.month === month);
  const billed = monthCashflow?.billed ?? 0;
  const collectionPct =
    billed > 0 ? Math.round((dashboard.collectedTotal / billed) * 100) : 0;

  /* ---- chart geometry (viewBox 0 0 560 232, same as canvas) ---- */
  const BASE_Y = 206;
  const TOP_Y = 15.5;
  const PLOT_H = BASE_Y - TOP_Y;
  const rawMax = Math.max(1, ...cashflow.flatMap((row) => [row.billed, row.expenses]));
  const axisMax = niceStep(rawMax / 3) * 3;
  const guideRows = [3, 2, 1, 0].map((step) => ({
    y: BASE_Y - (PLOT_H * step) / 3,
    value: (axisMax * step) / 3,
  }));

  /* ---- due list ---- */
  const billByTenant = new Map(bills.map((bill) => [bill.tenantId, bill]));
  const roomById = new Map(rooms.map((room) => [room.id, room]));

  /* ---- monthly cycle ---- */
  const tile1Done = meter !== null;
  const tile2Done = bills.length > 0;
  const tile3Done = false;
  const tile4Done = bills.length > 0 && dashboard.dueList.length === 0;
  const doneCount = [tile1Done, tile2Done, tile3Done, tile4Done].filter(Boolean).length;

  /* ---- loans ---- */
  const activeLoans = loans.filter((loan) => loan.status === 'active');
  const loanRemaining = activeLoans.reduce(
    (sum, loan) =>
      sum + Math.max(0, loan.totalAmount - loan.paidInstallments * loan.installmentAmount),
    0,
  );
  const loanCaption =
    activeLoans.length > 0
      ? `${bnNumber(activeLoans.length)}টি চলমান · বাকি ${bnTaka(loanRemaining)}`
      : 'কোনো চলমান লোন নেই';

  /* ---- finance ---- */
  const net = monthCashflow?.net ?? 0;
  const netText = net >= 0 ? `+${bnTaka(net)}` : `−${bnTaka(Math.abs(net))}`;

  /* ---- recent activity ---- */
  type Activity = {
    key: string;
    date: string;
    tone: 'success' | 'primary' | 'info';
    icon: ReactNode;
    title: string;
    detail: string;
    time: string;
  };
  const billById = new Map(bills.map((bill) => [bill.id, bill]));
  const activities: Activity[] = [];
  if (meter) {
    activities.push({
      key: 'meter',
      date: `${month}-01`,
      tone: 'primary',
      icon: <BoltIcon />,
      title: 'মিটার এন্ট্রি',
      detail: `${bnMonth(month)} · খসড়া সেভ হয়েছে`,
      time: bnDate(`${month}-01`),
    });
  }
  for (const bill of bills) {
    const date = bill.createdAt.slice(0, 10);
    activities.push({
      key: `bill-${bill.id}`,
      date,
      tone: 'info',
      icon: <BillIcon />,
      title: `বিল তৈরি — রুম ${bnDigits(roomById.get(bill.roomId)?.number ?? '')}`,
      detail: `${bnTaka(bill.total)} · প্রিন্টের জন্য প্রস্তুত`,
      time: bnDate(date),
    });
  }
  for (const entry of ledger) {
    const bill = billById.get(entry.billId);
    const roomNumber = bill ? (roomById.get(bill.roomId)?.number ?? '') : '';
    activities.push({
      key: `ledger-${entry.id}`,
      date: entry.paidAt,
      tone: 'success',
      icon: <CashIcon />,
      title: `কালেকশন — রুম ${bnDigits(roomNumber)}`,
      detail: `${bnTaka(entry.amount)} আদায় হয়েছে`,
      time: bnDate(entry.paidAt),
    });
  }
  activities.sort((a, b) => b.date.localeCompare(a.date) || a.key.localeCompare(b.key));
  const recent = activities.slice(0, 3);

  const activityTone: Record<Activity['tone'], string> = {
    success: 'bg-success-tint text-success',
    primary: 'bg-primary-tint text-primary',
    info: 'bg-info-tint text-info',
  };

  return (
    <>
      <DashboardHeader
        property={property}
        month={month}
        anchorMonth={months.anchor ?? month}
        onPickMonth={pickMonth}
        onOpenNotifications={() => setNotifyOpen(true)}
      />

      <NotificationSheet
        open={notifyOpen}
        onClose={() => setNotifyOpen(false)}
        dashboard={dashboard}
        month={month}
      />

      {/* KPI */}
      <section className="mt-4 grid grid-cols-2 gap-3 md:mt-6 md:gap-4 lg:grid-cols-4">
        <KpiCard
          label="এই মাসের বকেয়া"
          value={bnTaka(dashboard.dueTotal)}
          trend={dueTrend}
        />
        <KpiCard
          label="আদায় হয়েছে"
          value={bnTaka(dashboard.collectedTotal)}
          trend={{ text: `বিলের ${bnNumber(collectionPct)}% আদায়`, tone: 'success' }}
        />
        <KpiCard
          label="এই মাসের ব্যয়"
          value={bnTaka(dashboard.expenseTotal)}
          context="বিল + মেরামত"
        />
        <KpiCard
          label="খালি রুম"
          value={`${bnDigits(dashboard.vacantRooms)}/${bnDigits(dashboard.totalRooms)}`}
          context={`${bnNumber(dashboard.totalRooms - dashboard.vacantRooms)} রুম ভাড়া আছে`}
        />
      </section>

      {/* chart + due list */}
      <div className="xl:mt-4 xl:grid xl:grid-cols-3 xl:gap-4">
        <section
          className="mt-3 rounded-card border border-border bg-surface-raised p-4 xl:col-span-2 xl:mt-0"
          aria-label="গত ৬ মাসের আয়-ব্যয় চার্ট"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">
              আয়-ব্যয় (গত ৬ মাস)
            </h2>
            <div className="flex shrink-0 items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                আয়
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                <span className="h-2.5 w-2.5 rounded-full bg-info" />
                ব্যয়
              </span>
            </div>
          </div>

          <svg
            className="mt-3 w-full"
            viewBox="0 0 560 232"
            role="img"
            aria-label="শেষ ছয় মাসের প্রতি মাসের আয়-ব্যয়ের গ্রুপড কলাম চার্ট"
          >
            {guideRows.map((guide) => (
              <line
                key={guide.y}
                x1="44"
                y1={guide.y}
                x2="548"
                y2={guide.y}
                stroke="var(--color-border)"
                strokeDasharray="2 4"
              />
            ))}
            {guideRows.map((guide) => (
              <text
                key={`label-${guide.y}`}
                x="38"
                y={guide.y + 4}
                textAnchor="end"
                fontSize="11"
                fontWeight="500"
                fill="var(--color-ink-faint)"
              >
                {bnTaka(guide.value)}
              </text>
            ))}
            {cashflow.map((row, index) => {
              const centerX = 86 + index * 84;
              const incomeHeight = (row.billed / axisMax) * PLOT_H;
              const expenseHeight = (row.expenses / axisMax) * PLOT_H;
              return (
                <g key={row.month}>
                  <rect
                    x={centerX - 26}
                    y={BASE_Y - incomeHeight}
                    width="24"
                    height={incomeHeight}
                    rx="2.5"
                    fill="var(--color-primary)"
                  />
                  <rect
                    x={centerX + 2}
                    y={BASE_Y - expenseHeight}
                    width="24"
                    height={expenseHeight}
                    rx="2.5"
                    fill="var(--color-info)"
                  />
                </g>
              );
            })}
            {cashflow.map((row, index) => (
              <text
                key={`month-${row.month}`}
                x={86 + index * 84}
                y="224"
                textAnchor="middle"
                fontSize="11.5"
                fontWeight="500"
                fill="var(--color-ink-muted)"
              >
                {index === cashflow.length - 1 ? bnMonth(row.month) : shortMonth(row.month)}
              </text>
            ))}
          </svg>
        </section>

        <section className="mt-3 xl:col-span-1 xl:mt-0">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">বকেয়া তালিকা</h2>
            <Link to={`/collection?month=${month}`} className="text-sm font-medium text-primary">
              সব দেখুন
            </Link>
          </div>
          <div className="mt-2 divide-y divide-border rounded-card border border-border bg-surface-raised">
            {dashboard.dueList.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-muted">
                এই মাসে কোনো বকেয়া নেই।
              </p>
            ) : (
              dashboard.dueList.map((row) => {
                const bill = billByTenant.get(row.tenantId);
                const overdue =
                  bill?.lines.some(
                    (line) => line.kind === 'prev_due' && line.amount > 0,
                  ) ?? false;
                return (
                  <div key={row.tenantId} className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {row.tenantName}
                      </p>
                      <p className="text-xs text-ink-muted">
                        রুম {bnDigits(row.roomNumber)} · {bnMonth(month)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-bold ${
                          overdue ? 'text-danger' : 'text-ink'
                        }`}
                      >
                        {bnTaka(row.amount)}
                      </p>
                      <StatusChip
                        className="mt-0.5"
                        variant={overdue ? 'overdue' : 'due'}
                      />
                    </div>
                    <Link
                      to={`/collection?month=${month}`}
                      className={ICON_BUTTON_CLASS}
                      aria-label={`${row.tenantName} থেকে আদায়`}
                    >
                      <CashIcon />
                      আদায়
                    </Link>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* monthly cycle + quick access + recent activity */}
      <div className="lg:mt-4 lg:grid lg:grid-cols-2 lg:gap-4">
        <section
          className="mt-3 rounded-card border border-border bg-surface-raised p-4 lg:mt-0"
          aria-label="এই মাসের কাজ"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">এই মাসের কাজ</h2>
            <span className="text-xs font-medium text-ink-faint">
              {bnDigits(doneCount)}/৪ ধাপ সম্পন্ন
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <CycleTile
              to="/bills/meters"
              done={tile1Done}
              step="১"
              title="মিটার লিখুন"
              caption="বিদ্যুৎ ও পানি রিডিং"
              icon={<GaugeIcon />}
            />
            <CycleTile
              to={`/bills/preview?month=${month}`}
              done={tile2Done}
              step="২"
              title="বিল দেখুন"
              caption={
                bills.length > 0
                  ? `${bnNumber(bills.length)}টি বিল প্রস্তুত`
                  : 'এখনও বিল হয়নি'
              }
              icon={<BillIcon />}
            />
            <CycleTile
              to={`/bills/print?month=${month}`}
              done={tile3Done}
              step="৩"
              title="প্রিন্ট করুন"
              caption="ভাড়াটেদের মাসিক বিল"
              icon={<PrinterIcon />}
            />
            <CycleTile
              to={`/collection?month=${month}`}
              done={tile4Done}
              step="৪"
              title="কালেকশন"
              caption={
                dashboard.dueList.length > 0
                  ? `${bnNumber(dashboard.dueList.length)} জনের বাকি`
                  : 'সব আদায় হয়েছে'
              }
              icon={<WalletIcon />}
            />
          </div>
        </section>

        <section
          className="mt-4 lg:order-3 lg:col-span-2 lg:mt-0"
          aria-label="লোন ও আয়-ব্যয়"
        >
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <Link
              to="/loans"
              className="rounded-card border border-border bg-surface-raised p-4 transition-colors hover:bg-surface-soft"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-info-tint text-info">
                <CreditCardIcon />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink">লোন</p>
              <p className="mt-0.5 text-xs text-ink-muted">{loanCaption}</p>
            </Link>
            <Link
              to="/finance"
              className="rounded-card border border-border bg-surface-raised p-4 transition-colors hover:bg-surface-soft"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success-tint text-success">
                <WalletIcon />
              </span>
              <p className="mt-3 text-sm font-semibold text-ink">আয়-ব্যয়</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                এই মাসে নিট {netText}
              </p>
            </Link>
          </div>
        </section>

        <section className="mt-4 lg:mt-0">
          <h2 className="text-base font-semibold text-ink">সাম্প্রতিক কার্যক্রম</h2>
          <div className="mt-2 divide-y divide-border rounded-card border border-border bg-surface-raised">
            {recent.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-muted">
                এখনও কোনো কার্যক্রম নেই।
              </p>
            ) : (
              recent.map((event) => (
                <div key={event.key} className="flex items-start gap-3 p-4">
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                      activityTone[event.tone]
                    }`}
                  >
                    {event.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{event.title}</p>
                    <p className="text-xs text-ink-muted">{event.detail}</p>
                  </div>
                  <span className="text-xs text-ink-faint">{event.time}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
}

/* ---------- notification sheet ---------- */

function NotificationSheet({
  open,
  onClose,
  dashboard,
  month,
}: {
  open: boolean;
  onClose: () => void;
  dashboard: DashboardSnapshot;
  /** the month the dashboard is showing — the 'আদায়' link must carry it */
  month: string;
}) {
  const dues = dashboard.dueList;
  return (
    <Sheet open={open} onClose={onClose} ariaLabel="নোটিফিকেশন">
      <h2 className="px-1 text-base font-semibold text-ink">নোটিফিকেশন</h2>

      {dues.length > 0 ? (
        <>
          <p className="mt-1 px-1 text-xs text-ink-muted">
            {bnDigits(String(dues.length))} জনের বকেয়া আছে · মোট {bnTaka(dashboard.dueTotal)}
          </p>
          <ul className="mt-3 space-y-1.5 pb-1">
            {dues.map((row) => (
              <li
                key={row.tenantId}
                className="flex items-center justify-between gap-3 rounded-button border border-border bg-surface-raised px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{row.tenantName}</p>
                  <p className="text-xs text-ink-muted">রুম {bnDigits(row.roomNumber)} · বকেয়া</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-bold text-danger">{bnTaka(row.amount)}</span>
                  <Link
                    to={`/collection?month=${month}`}
                    onClick={onClose}
                    className="rounded-button bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-colors hover:bg-primary-hover"
                  >
                    আদায়
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-3 px-1 text-sm text-ink-muted">এখন কোনো বকেয়ার বার্তা নেই।</p>
      )}

      <p className="mt-3 px-1 text-xs text-ink-faint">
        মিটার ও লোনের রিমাইন্ডার — শীঘ্রই আসছে।
      </p>
    </Sheet>
  );
}
