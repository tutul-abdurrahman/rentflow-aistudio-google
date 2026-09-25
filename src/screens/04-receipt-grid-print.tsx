import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepository } from '../app/repository';
import { bnDigits, bnMonth, bnTaka } from '../lib/format';
import type { Bill, BillLine, Property, Room, Tenant } from '../lib/types';

/**
 * 04 — মাসিক কাগজ (A4 portrait, 2×3 = 6 slips). Monthly cycle step 3: printed
 * BEFORE collection (handoff §8/§11/§14). Each slip carries the unique
 * bill.paperRef, the property header, blank hand-collection signature fields
 * (আদায়কারী, right) and the `1.5px dashed #bbb` cut lines on print.
 * The grid stays 6 slots — never 8.
 */

/** Bangla 0–99 words — used for the receipt "টাকা অক্ষরে" line. */
const BN_TENS = [
  'শূন্য',
  'এক',
  'দুই',
  'তিন',
  'চার',
  'পাঁচ',
  'ছয়',
  'সাত',
  'আট',
  'নয়',
  'দশ',
  'এগারো',
  'বারো',
  'তেরো',
  'চোদ্দ',
  'পনেরো',
  'ষোল',
  'সতেরো',
  'আঠারো',
  'উনিশ',
  'বিশ',
  'একুশ',
  'বাইশ',
  'তেইশ',
  'চব্বিশ',
  'পঁচিশ',
  'ছাব্বিশ',
  'সাতাশ',
  'আটাশ',
  'ঊনত্রিশ',
  'ত্রিশ',
  'একত্রিশ',
  'বত্রিশ',
  'তেত্রিশ',
  'চৌত্রিশ',
  'পঁয়ত্রিশ',
  'ছত্রিশ',
  'সাঁইত্রিশ',
  'আটত্রিশ',
  'ঊনচল্লিশ',
  'চল্লিশ',
  'একচল্লিশ',
  'বিয়াল্লিশ',
  'তেতাল্লিশ',
  'চুয়াল্লিশ',
  'পঁয়তাল্লিশ',
  'ছেচল্লিশ',
  'সাতচল্লিশ',
  'আটচল্লিশ',
  'ঊনপঞ্চাশ',
  'পঞ্চাশ',
  'একান্ন',
  'বায়ান্ন',
  'তিপ্পান্ন',
  'চুয়ান্ন',
  'পঞ্চান্ন',
  'ছাপ্পান্ন',
  'সাতান্ন',
  'আটান্ন',
  'ঊনষাট',
  'ষাট',
  'একষট্টি',
  'বাষট্টি',
  'তেষট্টি',
  'চৌষট্টি',
  'পঁয়ষট্টি',
  'ছেষট্টি',
  'সাতষট্টি',
  'আটষট্টি',
  'ঊনসত্তর',
  'সত্তর',
  'একাত্তর',
  'বাহাত্তর',
  'তিয়াত্তর',
  'চুয়াত্তর',
  'পঁচাত্তর',
  'ছিয়াত্তর',
  'সাতাত্তর',
  'আটাত্তর',
  'ঊনআশি',
  'আশি',
  'একাশি',
  'বিরাশি',
  'তিরাশি',
  'চুরাশি',
  'পঁচাশি',
  'ছিয়াশি',
  'সাতাশি',
  'আটাশি',
  'ঊননব্বই',
  'নব্বই',
  'একানব্বই',
  'বিরানব্বই',
  'তিরানব্বই',
  'চুরানব্বই',
  'পঁচানব্বই',
  'ছিয়ানব্বই',
  'সাতানব্বই',
  'আটানব্বই',
  'নিরানব্বই',
] as const;

function underThousand(value: number): string {
  if (value < 100) return BN_TENS[value];
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  return `${BN_TENS[hundreds]}শ${rest ? ` ${BN_TENS[rest]}` : ''}`;
}

/** 14948 → 'চোদ্দ হাজার নয়শ আটচল্লিশ' (receipts render '<words> টাকা মাত্র'). */
export function takaInWords(value: number): string {
  const amount = Math.round(Math.abs(value));
  if (amount === 0) return 'শূন্য';
  const crore = Math.floor(amount / 10000000);
  const lakh = Math.floor((amount % 10000000) / 100000);
  const thousand = Math.floor((amount % 100000) / 1000);
  const rest = amount % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${crore >= 100 ? underThousand(crore) : BN_TENS[crore]} কোটি`);
  if (lakh) parts.push(`${BN_TENS[lakh]} লক্ষ`);
  if (thousand) parts.push(`${BN_TENS[thousand]} হাজার`);
  if (rest) parts.push(underThousand(rest));
  return parts.join(' ');
}

const sumKind = (bill: Bill, kind: BillLine['kind']): number =>
  bill.lines.filter((line) => line.kind === kind).reduce((sum, line) => sum + line.amount, 0);

/** '01711234567' → '০১৭১১-২৩৪৫৬৭' */
function phoneLabel(phone: string): string {
  const digits = bnDigits(phone);
  return digits.length === 11 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

function slashDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${bnDigits(day)}/${bnDigits(month)}/${bnDigits(date.getFullYear())}`;
}

function BackIcon() {
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
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function PrintIcon({ size = 16 }: { size?: number }) {
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
      <path d="M6 9V2h12v7" />
      <path d="M6 18H4a1 1 0 0 1-1-1v-5a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v5a1 1 0 0 1-1 1h-2" />
      <path d="M6 14h12v8H6z" />
    </svg>
  );
}

export interface SlipLine {
  label: string;
  amount: number;
  danger?: boolean;
}

/** Merged slip lines: electricity + water are one 'বিদ্যুৎ ও পানি' row. */
export function slipLines(bill: Bill): SlipLine[] {
  const rows: SlipLine[] = [
    { label: 'ভাড়া', amount: sumKind(bill, 'rent') },
    { label: 'বিদ্যুৎ ও পানি', amount: bill.utilitiesTotal },
    { label: 'ময়লা/ওয়েস্ট', amount: sumKind(bill, 'waste') },
  ];
  for (const line of bill.lines.filter((item) => item.kind === 'adjustment')) {
    rows.push({
      label: line.detail ? `সমন্বয় · ${line.detail}` : 'সমন্বয়',
      amount: line.amount,
      danger: line.amount < 0,
    });
  }
  const prevDue = sumKind(bill, 'prev_due');
  rows.push({ label: 'আগের বাকি', amount: prevDue, danger: prevDue > 0 });
  rows.push({ label: 'লোন কিস্তি', amount: sumKind(bill, 'loan') });
  return rows;
}

export default function ReceiptGridPrint() {
  const repo = useRepository();

  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState('');
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const activeMonth = await repo.getActiveMonth();
      const [prop, roomList, tenantList, billList] = await Promise.all([
        repo.getProperty(),
        repo.listRooms(),
        repo.listTenants(),
        repo.listBills(activeMonth),
      ]);
      if (!alive) return;
      setMonth(activeMonth);
      setProperty(prop);
      setRooms(roomList);
      setTenants(tenantList);
      setBills(billList);
      setLoading(false);
    })().catch(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [repo]);

  const printedOn = useMemo(() => slashDate(new Date()), []);

  const roomNumber = useMemo(() => {
    const map = new Map(rooms.map((room) => [room.id, room.number]));
    return (roomId: string): string => map.get(roomId) ?? '';
  }, [rooms]);

  const tenantName = useMemo(() => {
    const map = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
    return (tenantId: string): string => map.get(tenantId) ?? '';
  }, [tenants]);

  /** 6 slips per A4 page; vacant room 106 is never billed — its slot stays blank. */
  const pages = useMemo<Array<Array<Bill | null>>>(() => {
    const result: Array<Array<Bill | null>> = [];
    if (bills.length === 0) return result;
    for (let index = 0; index < bills.length; index += 6) {
      const slice: Array<Bill | null> = bills.slice(index, index + 6);
      while (slice.length < 6) slice.push(null);
      result.push(slice);
    }
    return result;
  }, [bills]);

  if (loading || !property) {
    return (
      <div className="min-h-dvh bg-surface text-ink" aria-busy="true" aria-label="লোড হচ্ছে">
        <div className="mx-auto max-w-3xl px-5 py-10" aria-hidden="true">
          <div className="skeleton h-7 w-56 max-w-full" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div
                key={index}
                className="rounded-card border border-border bg-surface-raised px-5 py-6"
              >
                <div className="skeleton h-2 w-24" />
                <div className="skeleton mt-2 h-5 w-36 max-w-full" />
                <div className="skeleton mt-2 h-3 w-44 max-w-full" />
                {[0, 1, 2].map((row) => (
                  <div key={row} className="mt-4 flex items-center justify-between gap-3">
                    <div className="skeleton h-3 w-20" />
                    <div className="skeleton h-3 w-14" />
                  </div>
                ))}
                <div className="skeleton mt-5 h-px w-full" />
                <div className="skeleton mt-3 h-4 w-28" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Actual non-blank slips — the padded slot for vacant 106 must not count.
  const slipCount = bills.length;

  return (
    <div className="print-04 min-h-dvh bg-surface text-ink">
      <header className="no-print sticky top-0 z-30 border-b border-border bg-surface px-5 py-3">
        <div className="mx-auto flex max-w-[48rem] items-center justify-between gap-3">
          <Link
            to="/bills/preview"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-button px-2 py-2 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-soft"
          >
            <BackIcon />
            পেছনে
          </Link>
          <div className="min-w-0 text-center">
            <h1 className="truncate text-base font-bold text-ink">
              মাসিক কাগজ — {bnMonth(month)}
              {slipCount > 0 ? ` · ${bnDigits(slipCount)}টি / A4` : ''}
            </h1>
            <p className="text-xs text-ink-muted">এখন ভাড়াটেদের হাতে দিন · Margin: None</p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-button bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active"
          >
            <PrintIcon />
            প্রিন্ট
          </button>
        </div>
      </header>

      <div className="print-stage overflow-x-auto px-5 py-8">
        {pages.length === 0 ? (
          <div className="mx-auto w-full max-w-[48rem] rounded-card border border-dashed border-border bg-surface-raised px-6 py-12 text-center">
            <p className="text-sm font-semibold text-ink">এই মাসে কোনো কাগজ নেই।</p>
            <p className="mt-1 text-xs text-ink-muted">
              বিল প্রিভিউ থেকে কাগজ তৈরি হলে এখানে ছাপা যাবে।
            </p>
            <Link
              to="/bills/preview"
              className="mt-5 inline-flex items-center justify-center rounded-button border border-secondary bg-surface-raised px-5 py-3 text-base font-semibold text-secondary transition-colors hover:bg-secondary-hover"
            >
              বিল প্রিভিউতে যান
            </Link>
          </div>
        ) : (
          <div className="mx-auto w-max min-w-[210mm]">
            {pages.map((page, pageIndex) => (
              <div
                key={`page-${pageIndex}`}
                className="print-sheet flex w-[210mm] min-h-[297mm] flex-col rounded-sm border border-border bg-surface-raised shadow-(--shadow-overlay)"
              >
              <div className="receipt-grid grid flex-1 grid-cols-2 grid-rows-3">
                {page.map((bill, slotIndex) =>
                  bill ? (
                    <article
                      key={bill.id}
                      className="receipt flex h-full min-h-0 flex-col border border-dashed border-border px-5 pt-4 pb-6"
                      aria-label={`কাগজ ${bill.paperRef} — রুম ${roomNumber(bill.roomId)}`}
                    >
                      <p className="text-center text-[10px] font-semibold tracking-[0.18em] text-ink-muted uppercase">
                        মানি রিসিট
                      </p>
                      <div className="mt-1.5 text-center">
                        <p className="text-[11px] leading-snug font-bold text-ink">
                          {property.name}
                        </p>
                        <p className="text-[9px] leading-snug text-ink-muted">{property.address}</p>
                        <p className="text-[9px] leading-snug text-ink-muted">
                          মোবাইল: {phoneLabel(property.ownerPhone)}
                        </p>
                      </div>
                      <div className="mt-2 flex items-baseline justify-between text-[11px]">
                        <span className="font-bold text-ink">রিসিট নং {bill.paperRef}</span>
                        <span className="text-ink-muted">তারিখ: {printedOn}</span>
                      </div>
                      <p className="mt-2.5 text-[12px] font-semibold text-ink">
                        রুম {bnDigits(roomNumber(bill.roomId))} · {tenantName(bill.tenantId)}
                      </p>
                      <p className="text-[11px] text-ink-muted">বিলের মাস: {bnMonth(month)}</p>

                      <div className="mt-2.5 border-t border-border-strong">
                        {slipLines(bill).map((row, rowIndex) => (
                          <div
                            key={`${bill.id}-${row.label}-${rowIndex}`}
                            className={`flex justify-between py-1 text-[11px] ${
                              rowIndex === 0 ? 'text-ink' : 'border-t border-border'
                            }`}
                          >
                            <span>{row.label}</span>
                            <span
                              className={`text-[12px] ${row.danger ? 'text-danger' : 'text-ink'}`}
                            >
                              {bnTaka(row.amount)}
                            </span>
                          </div>
                        ))}
                        <div className="mt-1 flex justify-between border-t-2 border-border-strong pt-1.5 text-[12px] font-bold text-ink">
                          <span>মোট</span>
                          <span className="text-[13px]">{bnTaka(bill.total)}</span>
                        </div>
                      </div>

                      <p className="mt-2 text-[10px] leading-relaxed text-ink-muted">
                        টাকা অক্ষরে: {takaInWords(bill.total)} টাকা মাত্র
                      </p>

                      <div className="mt-auto flex min-h-[26px] items-end justify-end pt-4 text-[11px] text-ink-muted">
                        <p className="w-44 border-t border-border-strong pt-1 text-right">
                          আদায়কারীর স্বাক্ষর
                        </p>
                      </div>
                    </article>
                  ) : (
                    <article
                      key={`blank-${pageIndex}-${slotIndex}`}
                      className="receipt border border-dashed border-border"
                      aria-hidden="true"
                    />
                  ),
                )}
              </div>
            </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
