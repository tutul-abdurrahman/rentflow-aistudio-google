/**
 * RentFlow — in-memory repository (build/test).
 *
 * Full RentFlowRepository over the engine + §9 demo seed. State is initialized
 * lazily from buildDemoState(); nothing here does IO. Every derived number is
 * recomputed through the engine — there is no stored dashboard snapshot.
 *
 * Cycle semantics (handoff §10, §14):
 * - calculatePapers: build + persist + shift readings; idempotent per month.
 * - adjustBill: mutate the stored bill in place, never regenerate.
 * - recordPayment: ledger entry only; bill paidAmount/status follow. When the
 *   bill carries a loan line, the paying tenant's active add-to-bill loan
 *   advances one installment (handoff §10).
 * - getPrevDueByRoom: Σ prior billed − Σ prior paid, per room. Only prev_due
 *   lines that were TRANSFERRED into a later bill are subtracted; OPENING
 *   (pre-history) prev_due lines are genuine debt and stay in the carry.
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
} from '../types';
import type {
  AddFinanceInput,
  AddLoanInput,
  AddTenantInput,
  MoveOutInput,
  PaymentInput,
  RentFlowRepository,
} from './types';
import { BILL_LABELS, buildMonthBills, cycleTotal, dashboardSnapshot, shiftReadings, type Tenancy } from '../engine';
import { addMonths, currentMonth } from '../view';
import { buildDemoState, buildEmptyState, type DemoState } from '../seed/demo';

function cloneBill(bill: Bill): Bill {
  return { ...bill, lines: bill.lines.map((line) => ({ ...line })) };
}

function cloneMeterEntry(entry: MeterEntry): MeterEntry {
  return {
    month: entry.month,
    rooms: entry.rooms.map((room) => ({ ...room })),
    water: { ...entry.water },
  };
}

export interface MemoryRepositoryOptions {
  /**
   * Test-only escape hatch: `seed: false` starts from an empty state (property
   * only) instead of lazily booting the §9 demo dataset. Production always
   * seeds — `getRepository()` calls this factory with no options.
   */
  seed?: boolean;
}

export function createMemoryRepository(options: MemoryRepositoryOptions = {}): RentFlowRepository {
  const seed = options.seed ?? true;
  let state: DemoState | null = null;
  let sequence = 1;

  const ensure = (): DemoState => {
    if (!state) state = seed ? buildDemoState() : buildEmptyState();
    return state;
  };
  const nextId = (prefix: string): string => `${prefix}-${sequence++}`;
  const nowIso = (): string => new Date().toISOString();

  const findRoom = (s: DemoState, id: RoomId): Room | null => s.rooms.find((room) => room.id === id) ?? null;
  const activeTenantInRoom = (s: DemoState, roomId: RoomId): Tenant | undefined =>
    s.tenants.find((tenant) => tenant.status === 'active' && tenant.roomId === roomId);
  const roomOrder = (s: DemoState, roomId: RoomId): number => findRoom(s, roomId)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const sortBills = (s: DemoState, bills: Bill[]): Bill[] =>
    bills
      .slice()
      .sort((a, b) => roomOrder(s, a.roomId) - roomOrder(s, b.roomId) || a.roomId.localeCompare(b.roomId));

  const loanInstallmentsByRoom = (s: DemoState): Map<string, number> => {
    const map = new Map<string, number>();
    for (const loan of s.loans) {
      if (loan.status !== 'active' || !loan.addToBill) continue;
      if (loan.paidInstallments >= loan.installmentCount) continue;
      const tenant = s.tenants.find((t) => t.id === loan.tenantId);
      if (tenant?.roomId) map.set(tenant.roomId, loan.installmentAmount);
    }
    return map;
  };

  /**
   * Carried due entering `month`. Σ prior billed − Σ prior paid, minus the
   * prev_due lines that were transferred into later bills (otherwise the same
   * leftover is counted once in its own month and again inside the next bill).
   * Telescopes to the latest prior cycle's leftover, matching handoff §14.
   * OPENING prev_due lines are pre-history debt the owner entered: they are NOT
   * subtracted, so the carry into the next month keeps them.
   */
  const computePrevDue = (s: DemoState, month: MonthKey): Map<RoomId, number> => {
    const map = new Map<RoomId, number>();
    for (const room of s.rooms) {
      const priorBills = s.bills.filter((bill) => bill.month < month && bill.roomId === room.id);
      const billed = priorBills.reduce((sum, bill) => sum + bill.total, 0);
      const transferred = priorBills.reduce(
        (sum, bill) =>
          sum +
          bill.lines
            .filter((line) => line.kind === 'prev_due' && line.opening !== true)
            .reduce((x, line) => x + line.amount, 0),
        0,
      );
      const paid = s.ledger
        .filter((entry) => {
          const bill = s.bills.find((b) => b.id === entry.billId);
          return bill !== undefined && bill.month < month && bill.roomId === room.id;
        })
        .reduce((sum, entry) => sum + entry.amount, 0);
      const carried = billed - paid - transferred;
      if (carried !== 0) map.set(room.id, carried);
    }
    return map;
  };

  /** Every tenancy (active + archived) — the engine picks the month's tenant. */
  const tenancies = (s: DemoState): Tenancy[] =>
    s.tenants
      .filter((tenant): tenant is Tenant & { roomId: RoomId } => tenant.roomId !== null)
      .map((tenant) => {
        const tenancy: Tenancy = {
          id: tenant.id,
          name: tenant.name,
          roomId: tenant.roomId,
          moveInDate: tenant.moveInDate,
        };
        if (tenant.moveOutDate) tenancy.moveOutDate = tenant.moveOutDate;
        return tenancy;
      });

  const ledgerRow = (s: DemoState, bill: Bill): MonthlyLedgerRow => {
    const room = findRoom(s, bill.roomId);
    const tenant = s.tenants.find((t) => t.id === bill.tenantId);
    const sumKind = (kind: string): number =>
      bill.lines.filter((line) => line.kind === kind).reduce((sum, line) => sum + line.amount, 0);
    return {
      roomNumber: room?.number ?? '',
      tenantName: tenant?.name ?? '',
      rent: sumKind('rent'),
      utilitiesTotal: bill.utilitiesTotal,
      wasteFee: sumKind('waste'),
      adjustments: sumKind('adjustment'),
      prevDue: sumKind('prev_due'),
      loan: sumKind('loan'),
      total: bill.total,
      paid: bill.paidAmount,
      status: bill.status,
      paperRef: bill.paperRef,
    };
  };

  return {
    // ---- property / settings ----
    async getProperty(): Promise<Property> {
      return { ...ensure().property };
    },

    async updateProperty(patch): Promise<Property> {
      const s = ensure();
      s.property = { ...s.property, ...patch };
      return { ...s.property };
    },

    // ---- rooms ----
    async listRooms(): Promise<Room[]> {
      const s = ensure();
      return s.rooms
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.number.localeCompare(b.number))
        .map((room) => ({ ...room }));
    },

    async addRoom(input): Promise<Room> {
      const s = ensure();
      if (s.rooms.some((room) => room.number === input.number)) {
        throw new Error('ROOM_EXISTS');
      }
      const sortOrder = s.rooms.reduce((max, room) => Math.max(max, room.sortOrder), 0) + 1;
      const room: Room = {
        id: `room-${input.number}`,
        propertyId: s.property.id,
        number: input.number,
        rent: input.rent,
        status: 'vacant',
        sortOrder,
      };
      s.rooms.push(room);
      return { ...room };
    },

    async updateRoom(id, patch): Promise<Room> {
      const s = ensure();
      const room = findRoom(s, id);
      if (!room) throw new Error('ROOM_NOT_FOUND');
      Object.assign(room, patch);
      return { ...room };
    },

    // ---- tenants ----
    async listTenants(status?): Promise<Tenant[]> {
      const s = ensure();
      return s.tenants
        .filter((tenant) => (status ? tenant.status === status : true))
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((tenant) => ({ ...tenant }));
    },

    async getTenant(id): Promise<Tenant | null> {
      const tenant = ensure().tenants.find((t) => t.id === id);
      return tenant ? { ...tenant } : null;
    },

    async addTenant(input: AddTenantInput): Promise<Tenant> {
      const s = ensure();
      const room = findRoom(s, input.roomId);
      if (!room) throw new Error('ROOM_NOT_FOUND');
      if (activeTenantInRoom(s, input.roomId)) throw new Error('ROOM_OCCUPIED');
      const tenant: Tenant = {
        id: nextId('tenant'),
        propertyId: s.property.id,
        name: input.name,
        phone: input.phone,
        roomId: input.roomId,
        status: 'active',
        moveInDate: input.moveInDate,
        createdAt: nowIso(),
      };
      s.tenants.push(tenant);
      room.status = 'occupied';
      return { ...tenant };
    },

    async updateTenant(id, patch): Promise<Tenant> {
      const s = ensure();
      const tenant = s.tenants.find((t) => t.id === id);
      if (!tenant) throw new Error('TENANT_NOT_FOUND');
      Object.assign(tenant, patch);
      return { ...tenant };
    },

    async shiftRoom(tenantId, newRoomId, effectiveDate): Promise<Tenant> {
      const s = ensure();
      const tenant = s.tenants.find((t) => t.id === tenantId);
      if (!tenant) throw new Error('TENANT_NOT_FOUND');
      if (tenant.status !== 'active') throw new Error('TENANT_ARCHIVED');
      const newRoom = findRoom(s, newRoomId);
      if (!newRoom) throw new Error('ROOM_NOT_FOUND');
      const holder = activeTenantInRoom(s, newRoomId);
      if (holder && holder.id !== tenantId) throw new Error('ROOM_OCCUPIED');

      const fromRoomId = tenant.roomId;
      if (fromRoomId) {
        const fromRoom = findRoom(s, fromRoomId);
        if (fromRoom) fromRoom.status = 'vacant';
      }
      newRoom.status = 'occupied';
      tenant.roomId = newRoomId;
      s.shifts.push({ tenantId, fromRoomId, toRoomId: newRoomId, effectiveDate });
      return { ...tenant };
    },

    async moveOut(tenantId, input: MoveOutInput): Promise<Tenant> {
      const s = ensure();
      const tenant = s.tenants.find((t) => t.id === tenantId);
      if (!tenant) throw new Error('TENANT_NOT_FOUND');
      if (tenant.status !== 'active') throw new Error('TENANT_ARCHIVED');
      if (tenant.roomId) {
        const room = findRoom(s, tenant.roomId);
        if (room) room.status = 'vacant';
      }
      tenant.roomId = null;
      tenant.status = 'archived';
      tenant.moveOutDate = input.date;
      tenant.moveOutResolution = input.resolution;
      if (input.note) tenant.moveOutNote = input.note;
      return { ...tenant };
    },

    async deleteArchivedTenant(tenantId): Promise<void> {
      const s = ensure();
      const tenant = s.tenants.find((t) => t.id === tenantId);
      if (!tenant) throw new Error('TENANT_NOT_FOUND');
      if (tenant.status !== 'archived') throw new Error('TENANT_ACTIVE');
      // Financial history is protected: bills and ledger entries must survive
      // the tenant record (handoff §10). Deleting would orphan the archive.
      const hasHistory =
        s.bills.some((bill) => bill.tenantId === tenantId) ||
        s.ledger.some((entry) => entry.tenantId === tenantId);
      if (hasHistory) throw new Error('TENANT_HAS_HISTORY');
      s.tenants = s.tenants.filter((t) => t.id !== tenantId);
    },

    async getTenantHistory(tenantId): Promise<HistoryEvent[]> {
      const s = ensure();
      const tenant = s.tenants.find((t) => t.id === tenantId);
      if (!tenant) return [];
      const roomLabel = (id: RoomId | null): string => (id ? (findRoom(s, id)?.number ?? '') : '');

      const events: HistoryEvent[] = [
        {
          id: `hist-movein-${tenant.id}`,
          date: tenant.moveInDate,
          label: 'রুম যোগদান',
          detail: tenant.roomId ? `রুম ${roomLabel(tenant.roomId)}` : 'ভাড়াটে যোগ হয়েছে',
        },
      ];

      for (const bill of s.bills) {
        if (bill.tenantId !== tenantId) continue;
        events.push({
          id: `hist-bill-${bill.id}`,
          date: bill.createdAt.slice(0, 10),
          label: 'মাসিক বিল',
          detail: `${bill.paperRef} · রুম ${roomLabel(bill.roomId)}`,
          amount: bill.total,
        });
      }
      for (const entry of s.ledger) {
        if (entry.tenantId !== tenantId) continue;
        events.push({
          id: `hist-pay-${entry.id}`,
          date: entry.paidAt,
          label: 'পেমেন্ট',
          detail: entry.method ?? '',
          amount: entry.amount,
        });
      }
      s.shifts.forEach((shift, index) => {
        if (shift.tenantId !== tenantId) return;
        events.push({
          id: `hist-shift-${tenantId}-${index}`,
          date: shift.effectiveDate,
          label: 'রুম বদল',
          detail: `রুম ${roomLabel(shift.fromRoomId)} → রুম ${roomLabel(shift.toRoomId)}`,
        });
      });
      if (tenant.moveOutDate) {
        events.push({
          id: `hist-moveout-${tenant.id}`,
          date: tenant.moveOutDate,
          label: 'মুভ-আউট',
          detail: tenant.moveOutNote ?? tenant.moveOutResolution ?? '',
        });
      }

      return events.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
    },

    // ---- meters ----
    async getMeterEntry(month: MonthKey): Promise<MeterEntry | null> {
      const entry = ensure().meterEntries.get(month);
      return entry ? cloneMeterEntry(entry) : null;
    },

    async saveMeterEntry(month: MonthKey, entry: MeterEntry): Promise<MeterEntry> {
      const s = ensure();
      const stored: MeterEntry = { ...cloneMeterEntry(entry), month };
      s.meterEntries.set(month, stored);
      return cloneMeterEntry(stored);
    },

    async getLastKnownReadings(month: MonthKey): Promise<{ rooms: Map<RoomId, number>; water: number }> {
      const s = ensure();
      const rooms = new Map<RoomId, number>();
      let water = 0;
      // Ascending, so the latest earlier month wins per room meter.
      for (const key of [...s.meterEntries.keys()].filter((entryMonth) => entryMonth < month).sort()) {
        const entry = s.meterEntries.get(key)!;
        for (const row of entry.rooms) rooms.set(row.roomId, row.current);
        water = entry.water.current;
      }
      return { rooms, water };
    },

    // ---- bills / monthly cycle ----
    async getActiveMonth(): Promise<MonthKey> {
      const s = ensure();
      const billed = new Set(s.bills.map((bill) => bill.month));
      const unfinished = [...s.meterEntries.keys()].filter((month) => !billed.has(month)).sort();
      if (unfinished.length > 0) return unfinished[0];

      const billedMonths = [...billed].sort();
      const current = currentMonth();
      if (billedMonths.length > 0) {
        const next = addMonths(billedMonths[billedMonths.length - 1], 1);
        return next > current ? current : next;
      }
      return current;
    },

    async getLatestBilledMonth(): Promise<MonthKey | null> {
      const months = [...new Set(ensure().bills.map((bill) => bill.month))].sort();
      return months.length > 0 ? months[months.length - 1] : null;
    },

    async listDataMonths(): Promise<MonthKey[]> {
      const s = ensure();
      return [...new Set([...s.bills.map((bill) => bill.month), ...s.meterEntries.keys()])].sort();
    },

    async listBills(month: MonthKey): Promise<Bill[]> {
      const s = ensure();
      return sortBills(s, s.bills.filter((bill) => bill.month === month)).map(cloneBill);
    },

    async getBill(id: BillId): Promise<Bill | null> {
      const bill = ensure().bills.find((b) => b.id === id);
      return bill ? cloneBill(bill) : null;
    },

    async calculatePapers(month: MonthKey): Promise<Bill[]> {
      const s = ensure();
      const stored = s.bills.filter((bill) => bill.month === month);
      if (stored.length > 0) {
        // Idempotent: never regenerate an already-calculated month.
        return sortBills(s, stored).map(cloneBill);
      }

      const meterEntry = s.meterEntries.get(month);
      if (!meterEntry) throw new Error('NO_METER_ENTRY');

      const built = buildMonthBills({
        month,
        property: s.property,
        rooms: s.rooms,
        tenancies: tenancies(s),
        meterEntry,
        adjustmentsByRoom: new Map(),
        prevDueByRoom: computePrevDue(s, month),
        loanInstallmentByRoom: loanInstallmentsByRoom(s),
        existingRefs: s.bills.map((bill) => bill.paperRef),
      });

      s.bills.push(...built);
      s.meterEntries.set(month, shiftReadings(meterEntry));
      return sortBills(s, built).map(cloneBill);
    },

    async adjustBill(month, roomId, adjustment, kind = 'adjustment'): Promise<Bill> {
      const s = ensure();
      const bill = s.bills.find((b) => b.month === month && b.roomId === roomId);
      if (!bill) throw new Error('BILL_NOT_FOUND');

      const record: Adjustment = {
        id: nextId('adj'),
        propertyId: s.property.id,
        month,
        roomId,
        label: adjustment.label,
        amount: adjustment.amount,
        note: adjustment.note,
        createdAt: nowIso(),
      };
      s.adjustments.push(record);

      // In place — add a line, recompute the total. Never regenerate the bill.
      // 'prev_due' seeds opening (pre-history) debt: an OPENING line, so the
      // ledger carry keeps it instead of subtracting it as a transfer.
      bill.lines.push(
        kind === 'prev_due'
          ? { kind: 'prev_due', label: BILL_LABELS.prev_due, amount: adjustment.amount, opening: true }
          : {
              kind: 'adjustment',
              label: BILL_LABELS.adjustment,
              amount: adjustment.amount,
              detail: adjustment.label,
            },
      );
      bill.total = bill.lines.reduce((sum, line) => sum + line.amount, 0);
      bill.status = bill.paidAmount >= bill.total ? 'paid' : bill.paidAmount > 0 ? 'partial' : 'due';
      return cloneBill(bill);
    },

    async getPrevDueByRoom(month: MonthKey): Promise<Map<RoomId, number>> {
      return computePrevDue(ensure(), month);
    },

    // ---- ledger / collection ----
    async listLedger(month?): Promise<LedgerEntry[]> {
      const s = ensure();
      return s.ledger
        .filter((entry) => (month ? entry.month === month : true))
        .slice()
        .sort((a, b) => a.paidAt.localeCompare(b.paidAt) || a.id.localeCompare(b.id))
        .map((entry) => ({ ...entry }));
    },

    async recordPayment(input: PaymentInput): Promise<LedgerEntry> {
      const s = ensure();
      const bill = s.bills.find((b) => b.id === input.billId);
      if (!bill) throw new Error('BILL_NOT_FOUND');
      const entry: LedgerEntry = {
        id: nextId('led'),
        propertyId: s.property.id,
        billId: bill.id,
        tenantId: bill.tenantId,
        month: bill.month,
        amount: input.amount,
        paidAt: input.paidAt,
        method: input.method,
        note: input.note,
        createdAt: nowIso(),
      };
      s.ledger.push(entry);
      bill.paidAmount += input.amount;
      bill.status = bill.paidAmount >= bill.total ? 'paid' : bill.paidAmount > 0 ? 'partial' : 'due';

      // A loan folded into this bill is settled installment-by-installment as
      // the bill gets paid: advance the paying tenant's active add-to-bill loan.
      if (bill.lines.some((line) => line.kind === 'loan')) {
        const loan = s.loans.find(
          (item) => item.tenantId === bill.tenantId && item.status === 'active' && item.addToBill,
        );
        if (loan) {
          loan.paidInstallments = Math.min(loan.paidInstallments + 1, loan.installmentCount);
          if (loan.paidInstallments >= loan.installmentCount) loan.status = 'completed';
        }
      }

      return { ...entry };
    },

    // ---- adjustments history ----
    async listAdjustments(month?): Promise<Adjustment[]> {
      const s = ensure();
      return s.adjustments
        .filter((adjustment) => (month ? adjustment.month === month : true))
        .slice()
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
        .map((adjustment) => ({ ...adjustment }));
    },

    // ---- loans ----
    async listLoans(): Promise<Loan[]> {
      return ensure().loans.map((loan) => ({ ...loan }));
    },

    async getLoan(id: LoanId): Promise<Loan | null> {
      const loan = ensure().loans.find((l) => l.id === id);
      return loan ? { ...loan } : null;
    },

    async addLoan(input: AddLoanInput): Promise<Loan> {
      const s = ensure();
      const tenant = s.tenants.find((t) => t.id === input.tenantId);
      if (!tenant) throw new Error('TENANT_NOT_FOUND');
      const loan: Loan = {
        id: nextId('loan'),
        propertyId: s.property.id,
        tenantId: input.tenantId,
        totalAmount: input.totalAmount,
        installmentCount: input.installmentCount,
        installmentAmount: input.installmentAmount,
        paidInstallments: 0,
        addToBill: input.addToBill,
        status: 'active',
        note: input.note,
        createdAt: nowIso(),
      };
      s.loans.push(loan);
      return { ...loan };
    },

    async cancelLoan(id: LoanId): Promise<Loan> {
      const s = ensure();
      const loan = s.loans.find((l) => l.id === id);
      if (!loan) throw new Error('LOAN_NOT_FOUND');
      loan.status = 'cancelled';
      loan.cancelledAt = nowIso();
      return { ...loan };
    },

    async payLoanInstallment(id: LoanId): Promise<Loan> {
      const s = ensure();
      const loan = s.loans.find((l) => l.id === id);
      if (!loan) throw new Error('LOAN_NOT_FOUND');
      if (loan.status === 'cancelled') throw new Error('LOAN_CANCELLED');
      loan.paidInstallments = Math.min(loan.paidInstallments + 1, loan.installmentCount);
      if (loan.paidInstallments >= loan.installmentCount) loan.status = 'completed';
      return { ...loan };
    },

    // ---- finance ----
    async listFinance(month?): Promise<FinanceEntry[]> {
      const s = ensure();
      return s.finance
        .filter((entry) => (month ? entry.date.slice(0, 7) === month : true))
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
        .map((entry) => ({ ...entry }));
    },

    async addFinanceEntry(input: AddFinanceInput): Promise<FinanceEntry> {
      const s = ensure();
      const entry: FinanceEntry = {
        id: nextId('fin'),
        propertyId: s.property.id,
        kind: input.kind,
        category: input.category,
        amount: input.amount,
        date: input.date,
        note: input.note,
        createdAt: nowIso(),
      };
      s.finance.push(entry);
      return { ...entry };
    },

    async deleteFinanceEntry(id): Promise<void> {
      const s = ensure();
      s.finance = s.finance.filter((entry) => entry.id !== id);
    },

    // ---- derived views (always recomputed) ----
    async getDashboard(month: MonthKey): Promise<DashboardSnapshot> {
      const s = ensure();
      return dashboardSnapshot({
        bills: s.bills,
        ledger: s.ledger,
        expenses: s.finance,
        rooms: s.rooms,
        month,
        tenants: s.tenants.map((tenant) => ({ id: tenant.id, name: tenant.name })),
      });
    },

    async getMonthlyLedger(month: MonthKey): Promise<MonthlyLedgerRow[]> {
      const s = ensure();
      return sortBills(s, s.bills.filter((bill) => bill.month === month)).map((bill) => ledgerRow(s, bill));
    },

    async getCashflow(months: MonthKey[]): Promise<CashflowRow[]> {
      const s = ensure();
      return months.map((month) => {
        const monthBills = s.bills.filter((bill) => bill.month === month);
        const billed = cycleTotal(monthBills);
        const collected = s.ledger
          .filter((entry) => entry.month === month)
          .reduce((sum, entry) => sum + entry.amount, 0);
        const expenses = s.finance
          .filter((entry) => entry.kind === 'expense' && entry.date.slice(0, 7) === month)
          .reduce((sum, entry) => sum + entry.amount, 0);
        // Screen 28: নিট ক্যাশফ্লো = মোট আয় − মোট ব্যয় (আয় = billed).
        return { month, billed, collected, expenses, net: billed - expenses };
      });
    },

    // ---- demo ----
    async seedDemo(): Promise<void> {
      state = buildDemoState();
      sequence = 1;
    },
  };
}
