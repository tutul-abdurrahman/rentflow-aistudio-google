import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useRepository } from '../app/repository';
import { bnDigits, bnMonth, bnTaka } from '../lib/format';
import type { Bill, Property, Room, Tenant } from '../lib/types';
import { slipLines, takaInWords } from './04-receipt-grid-print';

/**
 * 21 — হারানো কাগজ. Reprint ONE tenant's monthly paper (a lost slip).
 * Entry from 17 via /bills/reprint/:tenantId. It is NOT payment proof:
 * no 'পরিশোধিত' stamp, no receipt-for-payment language (handoff §10/§11/§14).
 */

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

export default function SingleReceipt() {
  const repo = useRepository();
  const { tenantId } = useParams<{ tenantId?: string }>();

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

  const bill = useMemo(
    () => (tenantId ? bills.find((item) => item.tenantId === tenantId) ?? null : null),
    [bills, tenantId],
  );

  const tenantName = useMemo(() => {
    const map = new Map(tenants.map((tenant) => [tenant.id, tenant.name]));
    return bill ? map.get(bill.tenantId) ?? '' : '';
  }, [tenants, bill]);

  if (!tenantId) {
    return <Navigate to="/bills/preview" replace />;
  }

  if (loading || !property) {
    return (
      <div className="min-h-dvh bg-surface text-ink">
        <p className="px-5 py-10 text-sm text-ink-muted">— অপেক্ষা করুন —</p>
      </div>
    );
  }

  const toolbarTitle = bill
    ? `হারানো কাগজ — ${bnDigits(roomNumber(bill.roomId))} · ${bnMonth(month)}`
    : `হারানো কাগজ — ${bnMonth(month)}`;

  return (
    <div className="print-21 min-h-dvh bg-surface text-ink">
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
            <h1 className="truncate text-base font-bold text-ink">{toolbarTitle}</h1>
            <p className="text-xs text-ink-muted">মাসিক কাগজ আবার ছাপুন · Margin: None</p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!bill}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-button bg-primary px-4 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-hover active:bg-primary-active disabled:bg-primary-disabled disabled:text-ink-faint"
          >
            <PrintIcon />
            প্রিন্ট
          </button>
        </div>
      </header>

      <div className="print-stage overflow-x-auto px-5 py-8">
        {!bill ? (
          <div className="mx-auto w-full max-w-[48rem] rounded-card border border-dashed border-border bg-surface-raised px-6 py-12 text-center">
            <p className="text-sm font-semibold text-ink">এই ভাড়াটের কোনো কাগজ পাওয়া যায়নি।</p>
            <p className="mt-1 text-xs text-ink-muted">
              {bnMonth(month)} মাসে এই ভাড়াটের কাগজ তৈরি হয়নি।
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
            <div className="print-sheet flex w-[210mm] min-h-[297mm] flex-col rounded-sm border border-border bg-surface-raised shadow-(--shadow-overlay)">
              <div className="receipt-frame flex flex-1 flex-col rounded-sm border-[1.5px] border-border-strong px-14 py-12">
                <p className="text-center text-sm font-semibold tracking-[0.28em] text-ink-muted uppercase">
                  মানি রিসিট
                </p>
                <div className="mt-5 text-center">
                  <p className="text-2xl leading-snug font-bold text-ink">{property.name}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-muted">{property.address}</p>
                  <p className="text-sm leading-relaxed text-ink-muted">
                    মোবাইল: {phoneLabel(property.ownerPhone)}
                  </p>
                </div>

                <div className="mt-8 flex items-baseline justify-between border-t border-border pt-4 text-base">
                  <span className="font-bold text-ink">রিসিট নং {bill.paperRef}</span>
                  <span className="text-ink-muted">তারিখ: {printedOn}</span>
                </div>

                <p className="mt-8 text-xl font-semibold text-ink">
                  রুম {bnDigits(roomNumber(bill.roomId))} · {tenantName}
                </p>
                <p className="mt-1 text-base text-ink-muted">বিলের মাস: {bnMonth(month)}</p>

                <div className="mt-8 border-t-2 border-border-strong">
                  {slipLines(bill).map((row, index) => (
                    <div
                      key={`${row.label}-${index}`}
                      className="flex items-baseline justify-between border-b border-border py-4 text-base"
                    >
                      <span className="text-ink">{row.label}</span>
                      <span
                        className={`text-lg font-semibold ${
                          row.danger ? 'text-danger' : 'text-ink'
                        }`}
                      >
                        {bnTaka(row.amount)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between pt-5 text-xl font-bold text-ink">
                    <span>মোট</span>
                    <span className="text-2xl">{bnTaka(bill.total)}</span>
                  </div>
                </div>

                <p className="mt-6 text-sm leading-relaxed text-ink-muted">
                  টাকা অক্ষরে: {takaInWords(bill.total)} টাকা মাত্র
                </p>

                <div className="mt-auto flex items-end justify-end pt-10 text-base">
                  <p className="w-64 border-t border-border-strong pt-2 text-right text-ink-muted">
                    আদায়কারীর স্বাক্ষর
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
