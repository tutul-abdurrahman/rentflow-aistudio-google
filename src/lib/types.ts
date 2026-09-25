/**
 * RentFlow — domain types (single source of truth).
 *
 * Contract file: workers build against these types. Changes go through
 * the manager only. Numbers are plain ASCII numbers; Bangla display
 * formatting happens in src/lib/format.ts at the screen layer.
 */

/** '2026-08' — month the cycle belongs to. */
export type MonthKey = string;

export type RoomId = string;
export type TenantId = string;
export type BillId = string;
export type LoanId = string;

export interface Property {
  id: string;
  /** আবাসিক ভবন — মিরপুর-১০ */
  name: string;
  /** ৪৪/২ শাহ আলী বাগ, মিরপুর-১০, ঢাকা-১২১৬ */
  address: string;
  /** রফিকুল ইসলাম */
  ownerName: string;
  /** ০১৭১১-২৩৪৫৬৭ */
  ownerPhone: string;
  /** ৳ per unit for electricity and water share — 7.5 */
  electricityRate: number;
  /** ৳ per occupied room per month — 200 */
  wasteFee: number;
  /** Locked rule — do not add variants without Tutul. */
  waterSplitRule: 'occupied_plus_one';
  /** Mid-month move-in rent rule. Default day_wise (property setting, not per-tenant quiz). */
  midMonthRule: 'day_wise' | 'full_month';
  createdAt: string;
}

export type RoomStatus = 'occupied' | 'vacant';

export interface Room {
  id: RoomId;
  propertyId: string;
  /** '102' — ASCII; display via format.ts */
  number: string;
  /** Monthly rent for the room — ৳9,000 etc. */
  rent: number;
  status: RoomStatus;
  sortOrder: number;
}

export type TenantStatus = 'active' | 'archived';

export interface Tenant {
  id: TenantId;
  propertyId: string;
  name: string;
  /** ASCII digits — display via format.ts */
  phone: string;
  /** null when moved out */
  roomId: RoomId | null;
  status: TenantStatus;
  /** ISO date */
  moveInDate: string;
  moveOutDate?: string;
  /** due vs advance resolution at move-out */
  moveOutResolution?: 'refund' | 'hold' | 'adjust';
  moveOutNote?: string;
  /** archived records kept 2 years */
  createdAt: string;
}

/** One meter reading row. Room meters = electricity; building meter (roomId null) = water. */
export interface MeterReading {
  id: string;
  propertyId: string;
  month: MonthKey;
  roomId: RoomId | null;
  utility: 'electricity' | 'water';
  previous: number;
  /** must be >= previous — engine rejects negative usage */
  current: number;
  recordedAt: string;
}

/** Grouped view of screen 03: per-room electricity + one building water meter. */
export interface MeterEntry {
  month: MonthKey;
  rooms: { roomId: RoomId; roomNumber: string; tenantName?: string; previous: number; current: number }[];
  water: { previous: number; current: number };
}

export type BillLineKind =
  | 'rent'
  | 'electricity'
  | 'water'
  | 'waste'
  | 'adjustment'
  | 'prev_due'
  | 'loan';

export interface BillLine {
  kind: BillLineKind;
  /** Bangla label shown on screen/paper */
  label: string;
  /** may be negative (adjustment credit) */
  amount: number;
  /** e.g. '223 unit × 7.5' — engine keeps ASCII; screens format Bengali */
  detail?: string;
}

export type BillStatus = 'due' | 'partial' | 'paid';

/** One monthly paper (bill) for one occupied room. Vacant rooms get no bill. */
export interface Bill {
  id: BillId;
  propertyId: string;
  month: MonthKey;
  roomId: RoomId;
  tenantId: TenantId;
  lines: BillLine[];
  /** electricity + water lines total */
  utilitiesTotal: number;
  total: number;
  /** unique reference printed on the paper, e.g. RF-202608-102 */
  paperRef: string;
  status: BillStatus;
  paidAmount: number;
  createdAt: string;
}

/**
 * A payment recorded in the ledger. There is NO receipt for payments —
 * screen 20 must not offer one; screen 21 is a reprint of the monthly paper.
 */
export interface LedgerEntry {
  id: string;
  propertyId: string;
  billId: BillId;
  tenantId: TenantId;
  month: MonthKey;
  amount: number;
  /** ISO date */
  paidAt: string;
  /** cash / bkash / note — free text */
  method?: string;
  note?: string;
  createdAt: string;
}

/** Manual bill adjustment (screen 18). Applied in place — never regenerate bills. */
export interface Adjustment {
  id: string;
  propertyId: string;
  month: MonthKey;
  roomId: RoomId;
  label: string;
  /** +/− ৳ */
  amount: number;
  note?: string;
  createdAt: string;
}

export type LoanStatus = 'active' | 'cancelled' | 'completed';

export interface Loan {
  id: LoanId;
  propertyId: string;
  tenantId: TenantId;
  /** ৳5,000 */
  totalAmount: number;
  /** 5 */
  installmentCount: number;
  /** ৳1,000 */
  installmentAmount: number;
  /** 2 paid */
  paidInstallments: number;
  /** 'মাসিক বিলে যোগ' — default ON */
  addToBill: boolean;
  status: LoanStatus;
  note?: string;
  createdAt: string;
  cancelledAt?: string;
}

export interface FinanceEntry {
  id: string;
  propertyId: string;
  kind: 'income' | 'expense';
  /** Bangla category label */
  category: string;
  amount: number;
  /** ISO date */
  date: string;
  note?: string;
  createdAt: string;
}

/** Dashboard snapshot — always recomputed from engine + ledger, never stored. */
export interface DashboardSnapshot {
  month: MonthKey;
  /** Σ (bill.total − paid) across open bills */
  dueTotal: number;
  /** Σ ledger payments in the month */
  collectedTotal: number;
  /** Σ expenses in the month */
  expenseTotal: number;
  vacantRooms: number;
  totalRooms: number;
  /** open due rows for the preview list */
  dueList: { tenantId: TenantId; tenantName: string; roomNumber: string; amount: number }[];
}

/** One row of screen 22 — monthly summary ledger (A4 landscape print). */
export interface MonthlyLedgerRow {
  roomNumber: string;
  tenantName: string;
  rent: number;
  utilitiesTotal: number;
  wasteFee: number;
  adjustments: number;
  prevDue: number;
  loan: number;
  total: number;
  paid: number;
  status: BillStatus;
  paperRef: string;
}

/** Screen 28 — cashflow summary rows per month. */
export interface CashflowRow {
  month: MonthKey;
  billed: number;
  collected: number;
  expenses: number;
  net: number;
}

/** Screen 16 — tenant history events. */
export interface HistoryEvent {
  id: string;
  date: string;
  /** Bangla event label — 'রুম বদল', 'মাসিক বিল', 'পেমেন্ট', 'মুভ-আউট'… */
  label: string;
  detail: string;
  amount?: number;
}
