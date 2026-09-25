import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepository } from '../app/repository';
import { bnDigits, bnMonth, bnTaka } from '../lib/format';
import type { CashflowRow, MonthlyLedgerRow } from '../lib/types';

/**
 * Screen 28 — ক্যাশফ্লো (design-output/screens/28-cashflow-summary.html).
 *
 * Per-month rows come from getCashflow over the last six months (ending at the
 * active month); the two breakdown cards derive income from getMonthlyLedger
 * and expenses from listFinance, so no figure is hardcoded.
 */

const BACK_CLASS =
  'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-soft';

const CHART_BASELINE = 206;
const CHART_TOP = 8;
const CHART_HEIGHT = CHART_BASELINE - CHART_TOP; // 198
const BAR_WIDTH = 24;
const GROUP_STEP = 84;

function lastMonths(month: string, count: number): string[] {
  const [year, monthNumber] = month.split('-').map(Number);
  const out: string[] = [];
  for (let back = count - 1; back >= 0; back -= 1) {
    const date = new Date(year, monthNumber - 1 - back, 1);
    out.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

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

function FormulaIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9m0-18v18m-6-6v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

interface ChartProps {
  rows: CashflowRow[];
  activeMonth: string;
}

function CashflowChart({ rows, activeMonth }: ChartProps) {
  const peak = rows.reduce((max, row) => Math.max(max, row.billed, row.expenses), 0);
  const niceMax = Math.max(30000, Math.ceil(peak / 30000) * 30000);
  const scale = CHART_HEIGHT / niceMax;
  const guides = [niceMax, (niceMax * 2) / 3, niceMax / 3];
  const guideY = guides.map((value) => CHART_BASELINE - value * scale);

  return (
    <svg
      className="mt-3 w-full"
      viewBox="0 0 560 232"
      role="img"
      aria-label="গত ছয় মাসের প্রতি মাসের আয়-ব্যয়ের গ্রুপড কলাম চার্ট"
    >
      {guideY.map((y, index) => (
        <line
          key={`guide-${index}`}
          className="stroke-border"
          strokeDasharray="2 4"
          x1="44"
          y1={y}
          x2="548"
          y2={y}
        />
      ))}
      <line
        className="stroke-border-strong"
        x1="44"
        y1={CHART_BASELINE}
        x2="548"
        y2={CHART_BASELINE}
      />

      {guides.map((value, index) => (
        <text
          key={`ylab-${index}`}
          className="fill-ink-faint text-[11px] font-medium"
          x="38"
          y={guideY[index] + 12}
          textAnchor="end"
        >
          {bnTaka(Math.round(value))}
        </text>
      ))}
      <text
        className="fill-ink-faint text-[11px] font-medium"
        x="38"
        y={CHART_BASELINE + 4}
        textAnchor="end"
      >
        ৳০
      </text>

      {rows.map((row, index) => {
        const incomeX = 60 + index * GROUP_STEP;
        const expenseX = incomeX + BAR_WIDTH + 4;
        const incomeHeight = row.billed > 0 ? Math.max(3, row.billed * scale) : 0;
        const expenseHeight = row.expenses > 0 ? Math.max(3, row.expenses * scale) : 0;
        return (
          <g key={row.month}>
            {incomeHeight > 0 ? (
              <rect
                className="fill-primary"
                x={incomeX}
                y={CHART_BASELINE - incomeHeight}
                width={BAR_WIDTH}
                height={incomeHeight}
                rx="2.5"
              />
            ) : null}
            {expenseHeight > 0 ? (
              <rect
                className="fill-info"
                x={expenseX}
                y={CHART_BASELINE - expenseHeight}
                width={BAR_WIDTH}
                height={expenseHeight}
                rx="2.5"
              />
            ) : null}
            <text
              className="fill-ink-muted text-[11.5px] font-medium"
              x={incomeX + 26}
              y="224"
              textAnchor="middle"
            >
              {row.month === activeMonth
                ? bnMonth(row.month)
                : bnMonth(row.month).split(' ')[0]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function CashflowSummary() {
  const repo = useRepository();

  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState('');
  const [propertyName, setPropertyName] = useState('');
  const [rows, setRows] = useState<CashflowRow[]>([]);
  const [ledger, setLedger] = useState<MonthlyLedgerRow[]>([]);
  const [expenseByCategory, setExpenseByCategory] = useState<{ category: string; amount: number }[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const activeMonth = await repo.getActiveMonth();
      const months = lastMonths(activeMonth, 6);
      const [cashRows, ledgerRows, finance, property] = await Promise.all([
        repo.getCashflow(months),
        repo.getMonthlyLedger(activeMonth),
        repo.listFinance(activeMonth),
        repo.getProperty(),
      ]);
      if (!alive) return;

      const grouped = new Map<string, number>();
      for (const entry of finance) {
        if (entry.kind !== 'expense') continue;
        grouped.set(entry.category, (grouped.get(entry.category) ?? 0) + entry.amount);
      }

      setMonth(activeMonth);
      setRows(cashRows);
      setLedger(ledgerRows);
      setExpenseByCategory(
        [...grouped.entries()]
          .map(([category, amount]) => ({ category, amount }))
          .sort((a, b) => b.amount - a.amount),
      );
      setPropertyName(property.name);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [repo]);

  const current = rows.find((row) => row.month === month) ?? null;
  const billed = current?.billed ?? 0;
  const expenses = current?.expenses ?? 0;
  const net = current?.net ?? 0;
  const collected = current?.collected ?? 0;
  const rate = billed > 0 ? Math.round((collected / billed) * 100) : 0;

  const rentTotal = ledger.reduce((sum, row) => sum + row.rent, 0);
  const utilitiesTotal = ledger.reduce((sum, row) => sum + row.utilitiesTotal, 0);
  const wasteTotal = ledger.reduce((sum, row) => sum + row.wasteFee, 0);
  const loanTotal = ledger.reduce((sum, row) => sum + row.loan, 0);
  const prevDueTotal = ledger.reduce((sum, row) => sum + row.prevDue, 0);
  const adjustmentTotal = ledger.reduce((sum, row) => sum + row.adjustments, 0);
  const secondaryTotal = billed - rentTotal;

  const dash = (value: number) => (loading ? '—' : bnTaka(value));

  return (
    <>
      <header className="pt-5 lg:flex lg:items-start lg:justify-between lg:pt-8">
        <div className="flex items-start gap-2.5">
          <Link to="/finance" className={BACK_CLASS} aria-label="পেছনে যান">
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
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-ink">ক্যাশফ্লো</h1>
            <p className="mt-0.5 text-sm text-ink-muted">{propertyName}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 lg:mt-0 lg:shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-surface-raised px-3.5 py-2 text-sm font-semibold text-ink">
            <CalendarIcon />
            {month ? bnMonth(month) : '—'}
          </span>
          <Link
            to="/finance"
            className="inline-flex items-center justify-center gap-2 rounded-button border border-secondary bg-surface-raised px-4 py-2.5 text-sm font-semibold text-secondary transition-colors hover:bg-secondary-hover active:bg-secondary-active"
          >
            আয়-ব্যয়
          </Link>
        </div>
      </header>

      {/* KPI 2×2 / 4-across */}
      <section
        className="mt-4 grid grid-cols-2 gap-3 md:mt-6 md:grid-cols-4 md:gap-4"
        aria-label={month ? `${bnMonth(month)} ক্যাশফ্লো সারসংক্ষেপ` : 'ক্যাশফ্লো সারসংক্ষেপ'}
      >
        <div className="rounded-card border border-border bg-surface-raised p-4">
          <p className="text-sm text-ink-faint">এই মাসের আয়</p>
          <p className="mt-2 text-2xl font-bold leading-none text-ink">{dash(billed)}</p>
          <p className="mt-2 text-xs text-success">মূল ভাড়া + সেকেন্ডারি</p>
        </div>
        <div className="rounded-card border border-border bg-surface-raised p-4">
          <p className="text-sm text-ink-faint">এই মাসের ব্যয়</p>
          <p className="mt-2 text-2xl font-bold leading-none text-ink">{dash(expenses)}</p>
          <p className="mt-2 text-xs text-ink-muted">বিল + মেরামত + বেতন</p>
        </div>
        <div className="rounded-card border border-primary bg-primary-tint p-4">
          <p className="text-sm font-medium text-ink">নিট ক্যাশফ্লো</p>
          <p className="mt-2 text-2xl font-bold leading-none text-ink">
            {loading ? '—' : `${net < 0 ? '−' : '+'}${bnTaka(Math.abs(net))}`}
          </p>
          <p className="mt-2 text-xs text-success">আয় − ব্যয়</p>
        </div>
        <div className="rounded-card border border-border bg-surface-raised p-4">
          <p className="text-sm text-ink-faint">আদায়ের হার</p>
          <p className="mt-2 text-2xl font-bold leading-none text-ink">
            {loading ? '—' : `${bnDigits(rate)}%`}
          </p>
          <p className="mt-2 text-xs text-ink-muted">{bnTaka(collected)} আদায় হয়েছে</p>
        </div>
      </section>

      {/* chart + formula */}
      <div className="md:mt-4 md:grid md:grid-cols-3 md:gap-4">
        <section
          className="mt-3 rounded-card border border-border bg-surface-raised p-4 md:col-span-2 md:mt-0"
          aria-label="গত ৬ মাসের আয়-ব্যয় চার্ট"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-ink">আয়-ব্যয় (গত ৬ মাস)</h2>
            <div className="flex shrink-0 items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                আয়
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                <span className="h-2.5 w-2.5 rounded-full bg-info" aria-hidden="true" />
                ব্যয়
              </span>
            </div>
          </div>

          {loading || rows.length === 0 ? (
            <div className="mt-3 h-40 rounded-input bg-surface-soft" aria-hidden="true" />
          ) : (
            <CashflowChart rows={rows} activeMonth={month} />
          )}
        </section>

        <section
          className="mt-4 rounded-card border border-border bg-surface-raised p-4 md:mt-0"
          aria-label="নিট ক্যাশফ্লো সূত্র"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-tint text-primary">
            <FormulaIcon />
          </span>
          <h2 className="mt-3 text-base font-semibold text-ink">সূত্র</h2>
          <p className="mt-1.5 text-sm font-bold text-ink">
            নিট ক্যাশফ্লো = মোট আয় − মোট ব্যয়
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            {bnTaka(billed)} − {bnTaka(expenses)} ={' '}
            <span className="font-bold text-success">
              {net < 0 ? '−' : '+'}
              {bnTaka(Math.abs(net))}
            </span>
          </p>
          <p className="mt-3 border-t border-border pt-3 text-xs text-ink-faint">
            এক মাসে হাতে থাকা টাকার হিসাব — আয় থেকে সব ব্যয় বাদ দিলে যা থাকে।
          </p>
        </section>
      </div>

      {/* breakdown */}
      <div className="lg:mt-4 lg:grid lg:grid-cols-2 lg:gap-4">
        <section
          className="mt-4 rounded-card border border-border bg-surface-raised p-4 md:mt-0"
          aria-label="আয়ের খাত"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">আয়ের খাত</h2>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
              <span className="h-2.5 w-2.5 rounded-full bg-success" aria-hidden="true" />
              আয়
            </span>
          </div>
          <div className="mt-3 space-y-2.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-ink-muted">মূল ভাড়া</span>
              <span className="font-semibold text-ink">{bnTaka(rentTotal)}</span>
            </div>
            <div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-ink-muted">সেকেন্ডারি</span>
                <span className="font-semibold text-ink">{bnTaka(secondaryTotal)}</span>
              </div>
              <p className="mt-1 text-xs text-ink-faint">
                ইউটিলিটি {bnTaka(utilitiesTotal)} · ওয়েস্ট {bnTaka(wasteTotal)} · লোন{' '}
                {bnTaka(loanTotal)} · আগের বাকি {bnTaka(prevDueTotal)}
                {adjustmentTotal !== 0 ? ` · অ্যাডজাস্ট ${bnTaka(adjustmentTotal)}` : ''}
              </p>
            </div>
            <div className="flex items-baseline justify-between border-t-2 border-border-strong pt-2.5 text-sm font-bold text-ink">
              <span>মোট আয়</span>
              <span className="text-base text-success">{bnTaka(billed)}</span>
            </div>
          </div>
        </section>

        <section
          className="mt-4 rounded-card border border-border bg-surface-raised p-4 md:mt-0"
          aria-label="ব্যয়ের খাত"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink">ব্যয়ের খাত</h2>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-danger">
              <span className="h-2.5 w-2.5 rounded-full bg-danger" aria-hidden="true" />
              ব্যয়
            </span>
          </div>
          <div className="mt-3 space-y-2.5">
            {expenseByCategory.length === 0 ? (
              <p className="text-sm text-ink-faint">এই মাসে কোনো ব্যয় যোগ করা হয়নি।</p>
            ) : (
              expenseByCategory.map((row) => (
                <div key={row.category} className="flex items-baseline justify-between text-sm">
                  <span className="text-ink-muted">{row.category}</span>
                  <span className="font-semibold text-ink">{bnTaka(row.amount)}</span>
                </div>
              ))
            )}
            <div className="flex items-baseline justify-between border-t-2 border-border-strong pt-2.5 text-sm font-bold text-ink">
              <span>মোট ব্যয়</span>
              <span className="text-base">{bnTaka(expenses)}</span>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
