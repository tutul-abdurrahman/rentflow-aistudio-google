/**
 * RentFlow — repository contract.
 *
 * The app talks to data ONLY through this interface. Implementations:
 * - src/lib/repository/memory.ts — in-memory, seeded with §9 demo data (build/test).
 * - src/lib/repository/supabase.ts — Supabase Postgres + Auth (production).
 * Swapping the backend stays mechanical (AI Studio pass / stack change).
 *
 * Monthly cycle semantics (handoff §8, §10, §14 — locked):
 * - Print-then-collect: calculatePapers(month) → print (04/21) → recordPayment later.
 * - calculatePapers shifts readings (previous ← current) after building papers.
 * - adjustBill updates the ledger in place. NEVER regenerate bills as correction.
 * - recordPayment stores a ledger entry only. No payment receipt anywhere.
 * - Next month's prev_due comes from the ledger; absent when nothing is leftover.
 * - getActiveMonth is the DRAFT month screen 03 opens; every bill-side screen
 *   resolves its month as ?month= → getLatestBilledMonth() → getActiveMonth().
 */

import type {
  Adjustment,
  Bill,
  BillId,
  CashflowRow,
  DashboardSnapshot,
  FinanceEntry,
  HistoryEvent,
  Loan,
  LoanId,
  LedgerEntry,
  MeterEntry,
  MonthlyLedgerRow,
  MonthKey,
  Property,
  Room,
  RoomId,
  Tenant,
  TenantId,
} from '../types';

export interface AddTenantInput {
  name: string;
  phone: string;
  roomId: RoomId;
  moveInDate: string;
  /** optional mid-month move-in day for day-wise rent; engine reads moveInDate */
}

export interface MoveOutInput {
  date: string;
  resolution: 'refund' | 'hold' | 'adjust';
  note?: string;
}

export interface PaymentInput {
  billId: BillId;
  amount: number;
  paidAt: string;
  method?: string;
  note?: string;
}

export interface AddLoanInput {
  tenantId: TenantId;
  totalAmount: number;
  installmentCount: number;
  installmentAmount: number;
  addToBill: boolean;
  note?: string;
}

export interface AddFinanceInput {
  kind: 'income' | 'expense';
  category: string;
  amount: number;
  date: string;
  note?: string;
}

export interface RentFlowRepository {
  // ---- property / settings (screen 31) ----
  getProperty(): Promise<Property>;
  updateProperty(patch: Partial<Omit<Property, 'id' | 'createdAt'>>): Promise<Property>;

  // ---- rooms (screens 07, 30) ----
  listRooms(): Promise<Room[]>;
  addRoom(input: { number: string; rent: number }): Promise<Room>;
  updateRoom(id: RoomId, patch: Partial<Pick<Room, 'number' | 'rent' | 'status' | 'sortOrder'>>): Promise<Room>;

  // ---- tenants (screens 09–16) ----
  listTenants(status?: 'active' | 'archived'): Promise<Tenant[]>;
  getTenant(id: TenantId): Promise<Tenant | null>;
  addTenant(input: AddTenantInput): Promise<Tenant>;
  updateTenant(id: TenantId, patch: Partial<Pick<Tenant, 'name' | 'phone'>>): Promise<Tenant>;
  /** screen 13 — room shift, tenant stays active */
  shiftRoom(tenantId: TenantId, newRoomId: RoomId, effectiveDate: string): Promise<Tenant>;
  /** screen 14 — move out; room becomes vacant; tenant archived */
  moveOut(tenantId: TenantId, input: MoveOutInput): Promise<Tenant>;
  /** active tenants cannot be deleted — must move out first */
  deleteArchivedTenant(tenantId: TenantId): Promise<void>;
  /** screen 16 */
  getTenantHistory(tenantId: TenantId): Promise<HistoryEvent[]>;

  // ---- meters (screen 03) ----
  getMeterEntry(month: MonthKey): Promise<MeterEntry | null>;
  saveMeterEntry(month: MonthKey, entry: MeterEntry): Promise<MeterEntry>;
  /**
   * Latest known `current` per room electricity meter and for the building
   * water meter, taken from the saved meter entries of months STRICTLY EARLIER
   * than `month`. Missing rooms map to nothing (callers fall back to 0).
   * Screen 03 uses this to open a month with the previous reading already
   * filled in (auto-filled, still editable).
   */
  getLastKnownReadings(month: MonthKey): Promise<{ rooms: Map<RoomId, number>; water: number }>;

  // ---- bills / monthly cycle (screens 17, 18, 04, 21) ----
  listBills(month: MonthKey): Promise<Bill[]>;
  getBill(id: BillId): Promise<Bill | null>;
  /**
   * The month the cycle is working on — the month screen 03 opens as a draft:
   * 1. the EARLIEST month that has a saved meter entry but no bills (finish
   *    what is in progress first),
   * 2. else the month immediately after the latest month that has bills,
   *    capped at the current calendar month (never a future month),
   * 3. else the current calendar month.
   */
  getActiveMonth(): Promise<MonthKey>;
  /**
   * Latest month that has stored papers, or null when no cycle exists yet.
   * Bill-side screens (02, 04, 17–22, 33) default to this month — never to an
   * empty draft month.
   */
  getLatestBilledMonth(): Promise<MonthKey | null>;
  /**
   * Every month that has data (a meter entry or bills), ascending — the
   * screen-03 cycle picker unions this with the trailing 12 calendar months.
   */
  listDataMonths(): Promise<MonthKey[]>;
  /**
   * Build + persist all occupied rooms' papers for the month, then shift readings.
   * Unique paperRef per paper. Safe to call once per month; re-calling an already
   * calculated month returns the stored bills (never a silent regenerate).
   */
  calculatePapers(month: MonthKey): Promise<Bill[]>;
  /**
   * screen 18 — add an adjustment and update the stored bill in place.
   * `kind` 'prev_due' appends an OPENING 'আগের বাকি' line (pre-history debt
   * seeded by the owner) instead of an 'adjustment' line; either way the bill is
   * never regenerated and an Adjustment history row is recorded.
   */
  adjustBill(
    month: MonthKey,
    roomId: RoomId,
    adjustment: { label: string; amount: number; note?: string },
    kind?: 'adjustment' | 'prev_due',
  ): Promise<Bill>;
  /** roomId → carried leftover due entering this month (ledger-derived) */
  getPrevDueByRoom(month: MonthKey): Promise<Map<RoomId, number>>;

  // ---- ledger / collection (screens 19, 20, 22) ----
  listLedger(month?: MonthKey): Promise<LedgerEntry[]>;
  /** records a ledger entry only — no receipt, no document */
  recordPayment(input: PaymentInput): Promise<LedgerEntry>;

  // ---- adjustments history (screen 18 list) ----
  listAdjustments(month?: MonthKey): Promise<Adjustment[]>;

  // ---- loans (screens 23–25) ----
  listLoans(): Promise<Loan[]>;
  getLoan(id: LoanId): Promise<Loan | null>;
  addLoan(input: AddLoanInput): Promise<Loan>;
  /** cancel → confirm on screen 25 → back to 23 */
  cancelLoan(id: LoanId): Promise<Loan>;
  /** record one installment paid (25) — folds into the monthly bill when addToBill */
  payLoanInstallment(id: LoanId): Promise<Loan>;

  // ---- finance (screens 26–28) ----
  listFinance(month?: MonthKey): Promise<FinanceEntry[]>;
  addFinanceEntry(input: AddFinanceInput): Promise<FinanceEntry>;
  deleteFinanceEntry(id: string): Promise<void>;

  // ---- derived views (screens 02, 22, 28) — always recomputed ----
  getDashboard(month: MonthKey): Promise<DashboardSnapshot>;
  getMonthlyLedger(month: MonthKey): Promise<MonthlyLedgerRow[]>;
  getCashflow(months: MonthKey[]): Promise<CashflowRow[]>;

  // ---- demo ----
  /** §9 canonical demo data (memory impl only; supabase impl throws or guards dev-only). */
  seedDemo(): Promise<void>;
}
