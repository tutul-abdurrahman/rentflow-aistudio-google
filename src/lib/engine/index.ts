/**
 * RentFlow — calculation engine (pure functions, no IO, no React).
 *
 * Contract file: W-B implements these exact signatures with unit tests.
 * Screens and repositories call these — never re-derive math in UI code.
 *
 * Locked rules (handoff §10, §13 — do not change without Tutul):
 * - Per-room electricity: current − previous; reject negative (current < previous).
 * - Water: building units ÷ (occupied rooms + 1). Vacant rooms excluded.
 *   "Occupied" means occupied DURING the billed month (tenancy intervals),
 *   never today's room status.
 * - Bill line: rent + (elec + waterShare) × rate + waste 200 + adjustments
 *   + prev due + optional loan installment.
 * - Vacant rooms: no waste fee, no water share, no auto electricity.
 * - One paper per room per month: the tenant is the one whose tenancy interval
 *   overlaps that month (active or archived), so backfilled months and a
 *   moved-out tenant's final month bill the right person.
 * - Mid-month move-in rent uses the property setting, default day-wise.
 * - Engine math is the source of truth (Tutul, build start):
 *   room 102 utility = 223 × 7.5 = 1,673. Never hardcode 2,200 or 57,998.
 *
 * Rounding rule (single, documented): every money line is rounded to whole
 * taka with Math.round(); the water share is rounded to 2 decimal places
 * (Math.round(x * 100) / 100). electricityUnits/dayWiseRent use Math.round()
 * where a fraction can appear. No banker's rounding anywhere.
 */

import type {
  Bill,
  BillLine,
  DashboardSnapshot,
  FinanceEntry,
  LedgerEntry,
  MeterEntry,
  MonthKey,
  Property,
  Room,
  TenantId,
} from '../types';
import { daysInMonth as daysInMonthFor } from '../format';

/** Thrown when current < previous. */
export const NEGATIVE_READING = 'NEGATIVE_READING' as const;

/**
 * Bangla line labels. Numbers inside `detail` stay ASCII; screens format them.
 * Screen 17/04/21 render 'আগের বাকি' for prev_due and merge electricity+water
 * for paper display; the engine keeps them as separate lines and sums them
 * into `utilitiesTotal`.
 */
export const BILL_LABELS = {
  rent: 'ভাড়া',
  electricity: 'বিদ্যুৎ',
  water: 'পানি',
  waste: 'ওয়েস্ট',
  adjustment: 'সমন্বয়',
  prev_due: 'আগের বাকি',
  loan: 'লোন কিস্তি',
} as const;

/**
 * One tenancy interval. Active AND archived tenants are passed in — the engine
 * decides which one owns a room in a given month, so backfilled months bill the
 * tenant who actually lived there (handoff: historical tenancy).
 */
export interface Tenancy {
  id: TenantId;
  name: string;
  roomId: string;
  moveInDate: string;
  moveOutDate?: string;
}

export interface RoomBillInput {
  month: MonthKey;
  roomNumber: string;
  /** base monthly rent for the room */
  rent: number;
  /** validated >= 0 */
  elecUnits: number;
  /** this room's water share in units (from waterShareUnits) */
  waterUnits: number;
  /** ৳ per unit — applies to electricity and water alike */
  rate: number;
  wasteFee: number;
  adjustments: { label: string; amount: number }[];
  /** carried leftover due from previous months; 0 = line absent */
  prevDue: number;
  /** loan installment folded into the bill when 'মাসিক বিলে যোগ' is on */
  loanInstallment?: number;
  /** mid-month move-in: day-wise or full month, per property setting */
  midMonth?: { moveInDay: number; daysInMonth: number; rule: 'day_wise' | 'full_month' };
}

export interface RoomBillResult {
  lines: BillLine[];
  /** electricity + water lines */
  utilitiesTotal: number;
  /** rent actually payable (day-wise prorated when mid-month applies) */
  rentPayable: number;
  total: number;
}

export interface DashboardSnapshotArgs {
  bills: Bill[];
  ledger: LedgerEntry[];
  /** expense entries only */
  expenses: FinanceEntry[];
  rooms: Room[];
  month: MonthKey;
  /**
   * Optional id → name lookup so `dueList` rows can carry tenant names.
   * Added to the contract as an optional field; callers without a name
   * registry still compile (names default to '').
   */
  tenants?: { id: TenantId; name: string }[];
}

/** current − previous; throws Error(NEGATIVE_READING) when current < previous. */
export function electricityUnits(previous: number, current: number): number {
  if (current < previous) {
    throw new Error(NEGATIVE_READING);
  }
  return current - previous;
}

/** Building water share per occupied room: units ÷ (occupied + 1), rounded to 2dp. */
export function waterShareUnits(buildingUnits: number, occupiedRooms: number): number {
  const divisor = occupiedRooms + 1;
  return Math.round((buildingUnits / divisor) * 100) / 100;
}

/** Day-wise rent: monthRent × (daysInMonth − moveInDay + 1) ÷ daysInMonth, rounded to nearest taka. */
export function dayWiseRent(
  monthRent: number,
  moveInDay: number,
  daysInMonth: number,
  rule: 'day_wise' | 'full_month',
): number {
  if (rule === 'full_month') return monthRent;
  if (moveInDay <= 1) return monthRent;
  const billableDays = Math.max(0, daysInMonth - moveInDay + 1);
  if (billableDays >= daysInMonth) return monthRent;
  return Math.round((monthRent * billableDays) / daysInMonth);
}

/** Build one room's monthly paper. Pure — no fetching. */
export function calcRoomBill(input: RoomBillInput): RoomBillResult {
  const lines: BillLine[] = [];

  let rentPayable = input.rent;
  let rentDetail: string | undefined;
  if (input.midMonth && input.midMonth.moveInDay > 1) {
    rentPayable = dayWiseRent(
      input.rent,
      input.midMonth.moveInDay,
      input.midMonth.daysInMonth,
      input.midMonth.rule,
    );
    const billableDays = Math.max(0, input.midMonth.daysInMonth - input.midMonth.moveInDay + 1);
    rentDetail = `${billableDays}/${input.midMonth.daysInMonth} day`;
  }
  // Rent is always present, even at 0.
  lines.push({ kind: 'rent', label: BILL_LABELS.rent, amount: rentPayable, ...(rentDetail ? { detail: rentDetail } : {}) });

  const electricity = Math.round(input.elecUnits * input.rate);
  if (electricity !== 0) {
    lines.push({
      kind: 'electricity',
      label: BILL_LABELS.electricity,
      amount: electricity,
      detail: `${input.elecUnits} unit × ${input.rate}`,
    });
  }

  const water = Math.round(input.waterUnits * input.rate);
  if (water !== 0) {
    lines.push({
      kind: 'water',
      label: BILL_LABELS.water,
      amount: water,
      detail: `${input.waterUnits} unit × ${input.rate}`,
    });
  }

  if (input.wasteFee !== 0) {
    lines.push({ kind: 'waste', label: BILL_LABELS.waste, amount: input.wasteFee });
  }

  for (const adjustment of input.adjustments) {
    if (adjustment.amount === 0) continue;
    lines.push({
      kind: 'adjustment',
      label: BILL_LABELS.adjustment,
      amount: adjustment.amount,
      detail: adjustment.label,
    });
  }

  if (input.prevDue !== 0) {
    lines.push({ kind: 'prev_due', label: BILL_LABELS.prev_due, amount: input.prevDue });
  }

  if (input.loanInstallment !== undefined && input.loanInstallment !== 0) {
    lines.push({ kind: 'loan', label: BILL_LABELS.loan, amount: input.loanInstallment });
  }

  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  return {
    lines,
    utilitiesTotal: electricity + water,
    rentPayable,
    total,
  };
}

/**
 * Unique paper reference, e.g. 'RF-202608-102'. When a room needs a second
 * paper in a month, a sequence suffix keeps uniqueness: 'RF-202608-102-2'.
 */
export function paperRef(month: MonthKey, roomNumber: string, existingRefs: string[]): string {
  const base = `RF-${month.replace(/-/g, '')}-${roomNumber}`;
  const taken = new Set(existingRefs);
  if (!taken.has(base)) return base;
  let sequence = 2;
  while (taken.has(`${base}-${sequence}`)) {
    sequence += 1;
  }
  return `${base}-${sequence}`;
}

/** After papers are calculated: previous ← current for every meter. */
export function shiftReadings(entry: MeterEntry): MeterEntry {
  return {
    month: entry.month,
    rooms: entry.rooms.map((room) => ({
      ...room,
      previous: room.current,
      current: room.current,
    })),
    water: {
      previous: entry.water.current,
      current: entry.water.current,
    },
  };
}

/** Dashboard numbers — recomputed from bills + ledger + expenses. Never stored. */
export function dashboardSnapshot(args: DashboardSnapshotArgs): DashboardSnapshot {
  const { bills, ledger, expenses, rooms, month } = args;
  const nameOf = (tenantId: TenantId): string =>
    args.tenants?.find((tenant) => tenant.id === tenantId)?.name ?? '';
  const numberOf = (roomId: string): string =>
    rooms.find((room) => room.id === roomId)?.number ?? '';

  const openRows: { tenantId: TenantId; tenantName: string; roomNumber: string; amount: number }[] = [];
  let dueTotal = 0;
  for (const bill of bills) {
    if (bill.month !== month) continue;
    if (bill.total > bill.paidAmount) {
      const amount = bill.total - bill.paidAmount;
      dueTotal += amount;
      openRows.push({
        tenantId: bill.tenantId,
        tenantName: nameOf(bill.tenantId),
        roomNumber: numberOf(bill.roomId),
        amount,
      });
    }
  }
  openRows.sort((a, b) => b.amount - a.amount || a.roomNumber.localeCompare(b.roomNumber));

  const collectedTotal = ledger
    .filter((entry) => entry.month === month)
    .reduce((sum, entry) => sum + entry.amount, 0);

  const expenseTotal = expenses
    .filter((entry) => entry.kind === 'expense' && entry.date.slice(0, 7) === month)
    .reduce((sum, entry) => sum + entry.amount, 0);

  return {
    month,
    dueTotal,
    collectedTotal,
    expenseTotal,
    vacantRooms: rooms.filter((room) => room.status === 'vacant').length,
    totalRooms: rooms.length,
    dueList: openRows,
  };
}

/** Σ of bill totals for the cycle (screen 17 footer). */
export function cycleTotal(bills: Bill[]): number {
  return bills.reduce((sum, bill) => sum + bill.total, 0);
}

/**
 * Reads occupied rooms from a room list in deterministic order (sortOrder).
 * Reflects TODAY's `room.status` — for a specific month use
 * `occupiedRoomsInMonth`, which derives occupancy from tenancy intervals.
 */
export function occupiedRooms(rooms: Room[]): Room[] {
  return rooms
    .filter((room) => room.status === 'occupied')
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.number.localeCompare(b.number));
}

/** First / last calendar day of a 'YYYY-MM' month, as ISO dates. */
function monthStart(month: MonthKey): string {
  return `${month}-01`;
}

function monthEnd(month: MonthKey): string {
  return `${month}-${String(daysInMonthFor(month)).padStart(2, '0')}`;
}

/**
 * The tenant who owns each room DURING `month`, from the full tenancy list
 * (active + archived). A tenancy covers the month when its interval
 * [moveInDate, moveOutDate] overlaps it; a room with no overlapping tenancy was
 * vacant that month and gets no paper.
 *
 * Deterministic tie-break when intervals overlap inside one month: the tenancy
 * that covers the month start wins, otherwise the earliest moveInDate (then id).
 */
export function monthTenantByRoom(tenancies: Tenancy[], month: MonthKey): Map<string, Tenancy> {
  const start = monthStart(month);
  const end = monthEnd(month);

  const candidates = new Map<string, Tenancy[]>();
  for (const tenancy of tenancies) {
    if (tenancy.moveInDate > end) continue;
    if (tenancy.moveOutDate !== undefined && tenancy.moveOutDate < start) continue;
    const list = candidates.get(tenancy.roomId);
    if (list) list.push(tenancy);
    else candidates.set(tenancy.roomId, [tenancy]);
  }

  const coversStart = (tenancy: Tenancy): number =>
    tenancy.moveInDate <= start && (tenancy.moveOutDate === undefined || tenancy.moveOutDate >= start)
      ? 0
      : 1;

  const byRoom = new Map<string, Tenancy>();
  for (const [roomId, list] of candidates) {
    const winner = list
      .slice()
      .sort(
        (a, b) =>
          coversStart(a) - coversStart(b) ||
          a.moveInDate.localeCompare(b.moveInDate) ||
          a.id.localeCompare(b.id),
      )[0];
    byRoom.set(roomId, winner);
  }
  return byRoom;
}

/**
 * Rooms occupied DURING `month`, in display order. Drives the bill set and the
 * water-share divisor (occupied that month + 1), never today's room status.
 */
export function occupiedRoomsInMonth(rooms: Room[], tenancies: Tenancy[], month: MonthKey): Room[] {
  const byRoom = monthTenantByRoom(tenancies, month);
  return rooms
    .filter((room) => byRoom.has(room.id))
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.number.localeCompare(b.number));
}

/**
 * Build every occupied room's bill for the month from a meter entry + settings.
 * Occupancy and the room's tenant are derived from the tenancy intervals that
 * overlap the month (active + archived), so a backfilled month bills whoever
 * lived there then. Vacant rooms are skipped entirely (no waste, no water, no
 * electricity). Pure: takes everything it needs as arguments; the repository
 * persists.
 */
export function buildMonthBills(args: {
  month: MonthKey;
  property: Property;
  rooms: Room[];
  /** every tenancy (active + archived) — the engine picks the month's tenant */
  tenancies: Tenancy[];
  meterEntry: MeterEntry;
  adjustmentsByRoom: Map<string, { label: string; amount: number }[]>;
  /** roomId → carried leftover due (from ledger history) */
  prevDueByRoom: Map<string, number>;
  /** roomId → active loan installment when add-to-bill is on */
  loanInstallmentByRoom: Map<string, number>;
  existingRefs: string[];
}): Bill[] {
  const { month, property, tenancies, meterEntry, adjustmentsByRoom, prevDueByRoom, loanInstallmentByRoom } = args;

  const tenantByRoom = monthTenantByRoom(tenancies, month);
  const occupied = occupiedRoomsInMonth(args.rooms, tenancies, month);
  const waterBuildingUnits = electricityUnits(meterEntry.water.previous, meterEntry.water.current);
  const waterUnits = waterShareUnits(waterBuildingUnits, occupied.length);
  const monthDays = daysInMonthFor(month);

  const refs = [...args.existingRefs];
  const bills: Bill[] = [];

  for (const room of occupied) {
    const tenant = tenantByRoom.get(room.id);
    if (!tenant) continue;

    const meter = meterEntry.rooms.find((row) => row.roomId === room.id);
    const elecUnits = meter ? electricityUnits(meter.previous, meter.current) : 0;

    const moveInDay = tenant.moveInDate.slice(0, 7) === month ? Number(tenant.moveInDate.slice(8, 10)) : 0;
    const midMonth =
      moveInDay > 1
        ? { moveInDay, daysInMonth: monthDays, rule: property.midMonthRule }
        : undefined;

    const result = calcRoomBill({
      month,
      roomNumber: room.number,
      rent: room.rent,
      elecUnits,
      waterUnits,
      rate: property.electricityRate,
      wasteFee: property.wasteFee,
      adjustments: adjustmentsByRoom.get(room.id) ?? [],
      prevDue: prevDueByRoom.get(room.id) ?? 0,
      loanInstallment: loanInstallmentByRoom.get(room.id),
      midMonth,
    });

    const ref = paperRef(month, room.number, refs);
    refs.push(ref);

    bills.push({
      id: `${month}-${room.number}`,
      propertyId: property.id,
      month,
      roomId: room.id,
      tenantId: tenant.id,
      lines: result.lines,
      utilitiesTotal: result.utilitiesTotal,
      total: result.total,
      paperRef: ref,
      status: 'due',
      paidAmount: 0,
      createdAt: `${month}-01T00:00:00.000Z`,
    });
  }

  return bills;
}

/** Convenience: days in a 'YYYY-MM' month (delegates to format.ts). */
export { daysInMonth } from '../format';
