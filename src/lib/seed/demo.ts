/**
 * RentFlow — canonical demo dataset (handoff §9) as typed pure data.
 *
 * `buildDemoState()` assembles the full in-memory state the memory repository
 * boots from: property, rooms, tenants, loans, meters, prior-month ledger
 * (the source of the carried dues), the August cycle and its payments.
 *
 * Numbers are extracted from the approved design canvas:
 * - 03-meter-entry.html       prev/current electricity + building water
 * - 17-bill-preview.html      per-room bill composition
 * - 22-monthly-summary-ledger paid column (৳42,200 total)
 * - 28-cashflow-summary.html  expense breakdown (৳9,400 total)
 *
 * Known-debt handling (§13): room 102's utility is ENGINE MATH, never the
 * hardcoded ৳2,200 receipt figure. See handoff §10/§13.
 */

import type {
  Adjustment,
  Bill,
  BillLine,
  FinanceEntry,
  LedgerEntry,
  Loan,
  MeterEntry,
  MonthKey,
  Property,
  Room,
  RoomId,
  Tenant,
  TenantId,
} from '../types';
import { BILL_LABELS, buildMonthBills } from '../engine';

export const DEMO_PROPERTY_ID = 'prop-mirpur10';
/** আগস্ট ২০২৬ */
export const DEMO_MONTH: MonthKey = '2026-08';
/** জুলাই ২০২৬ — the prior cycle whose leftovers carry into August. */
export const PRIOR_MONTH: MonthKey = '2026-07';
export const DEMO_ELECTRICITY_RATE = 7.5;
export const DEMO_WASTE_FEE = 200;

export const DEMO_OWNER = {
  name: 'রফিকুল ইসলাম',
  displayName: 'রফিক ভাই',
  phone: '01711234567',
} as const;

export const DEMO_PROPERTY: Property = {
  id: DEMO_PROPERTY_ID,
  name: 'আবাসিক ভবন — মিরপুর-১০',
  address: '৪৪/২ শাহ আলী বাগ, মিরপুর-১০, ঢাকা-১২১৬',
  ownerName: DEMO_OWNER.name,
  ownerPhone: DEMO_OWNER.phone,
  electricityRate: DEMO_ELECTRICITY_RATE,
  wasteFee: DEMO_WASTE_FEE,
  waterSplitRule: 'occupied_plus_one',
  midMonthRule: 'day_wise',
  createdAt: '2024-01-01T00:00:00.000Z',
};

/** Rooms ১০২–১০৭. ১০৬ vacant (no paper, no waste, no water share, no auto elec). */
export const DEMO_ROOMS: Room[] = [
  { id: 'room-102', propertyId: DEMO_PROPERTY_ID, number: '102', rent: 9000, status: 'occupied', sortOrder: 1 },
  { id: 'room-103', propertyId: DEMO_PROPERTY_ID, number: '103', rent: 9500, status: 'occupied', sortOrder: 2 },
  { id: 'room-104', propertyId: DEMO_PROPERTY_ID, number: '104', rent: 10000, status: 'occupied', sortOrder: 3 },
  { id: 'room-105', propertyId: DEMO_PROPERTY_ID, number: '105', rent: 8500, status: 'occupied', sortOrder: 4 },
  { id: 'room-106', propertyId: DEMO_PROPERTY_ID, number: '106', rent: 9200, status: 'vacant', sortOrder: 5 },
  { id: 'room-107', propertyId: DEMO_PROPERTY_ID, number: '107', rent: 10500, status: 'occupied', sortOrder: 6 },
];

export const DEMO_TENANTS: Tenant[] = [
  {
    id: 'tenant-rahat',
    propertyId: DEMO_PROPERTY_ID,
    name: 'রাহাত হোসেন',
    phone: '01712111002',
    roomId: 'room-102',
    status: 'active',
    moveInDate: '2024-03-01',
    createdAt: '2024-03-01T00:00:00.000Z',
  },
  {
    id: 'tenant-sabbir',
    propertyId: DEMO_PROPERTY_ID,
    name: 'সাব্বির আহমেদ',
    phone: '01713111003',
    roomId: 'room-103',
    status: 'active',
    moveInDate: '2024-07-15',
    createdAt: '2024-07-15T00:00:00.000Z',
  },
  {
    id: 'tenant-tanvir',
    propertyId: DEMO_PROPERTY_ID,
    name: 'তানভীর ইসলাম',
    phone: '01714111004',
    roomId: 'room-104',
    status: 'active',
    moveInDate: '2025-01-10',
    createdAt: '2025-01-10T00:00:00.000Z',
  },
  {
    id: 'tenant-mehedi',
    propertyId: DEMO_PROPERTY_ID,
    name: 'মেহেদী হাসান',
    phone: '01715111005',
    roomId: 'room-105',
    status: 'active',
    moveInDate: '2025-05-01',
    createdAt: '2025-05-01T00:00:00.000Z',
  },
  {
    id: 'tenant-nafisa',
    propertyId: DEMO_PROPERTY_ID,
    name: 'নাফিসা আক্তার',
    phone: '01717111007',
    roomId: 'room-107',
    status: 'active',
    moveInDate: '2026-02-20',
    createdAt: '2026-02-20T00:00:00.000Z',
  },
  {
    // §13 debt 1: the approved 04 receipt sample prints room ১০৬ · শামীম রেজা.
    // In the product story ১০৬ is vacant and শামীম is in the archive.
    id: 'tenant-shamim',
    propertyId: DEMO_PROPERTY_ID,
    name: 'শামীম রেজা',
    phone: '01716111006',
    roomId: null,
    status: 'archived',
    moveInDate: '2024-11-01',
    moveOutDate: '2026-06-30',
    moveOutResolution: 'hold',
    moveOutNote: 'নিরাপত্তা জমা সমন্বয় · কাগজ সংরক্ষিত',
    createdAt: '2024-11-01T00:00:00.000Z',
  },
];

/** নাফিসা ৳৫,০০০ · 5×৳১,০০০ · 2 paid · add-to-bill ON (§9). */
export const DEMO_LOAN: Loan = {
  id: 'loan-nafisa',
  propertyId: DEMO_PROPERTY_ID,
  tenantId: 'tenant-nafisa',
  totalAmount: 5000,
  installmentCount: 5,
  installmentAmount: 1000,
  paidInstallments: 2,
  addToBill: true,
  status: 'active',
  note: 'নাফিসার চলমান লোন · কিস্তি ২/৫ · মাসিক বিলে যোগ',
  createdAt: '2026-02-20T00:00:00.000Z',
};

/**
 * আগস্ট ২০২৬ electricity + building water, from 03.
 * Two screen-03 readings are overridden so the papers reproduce 17's per-room
 * electricity units:
 * - room 104: 03 shows the negative-usage error variant (2560 → 2500), so the
 *   cycle uses 2560 → 2650 (90 units). 
 * - room 107: 03 shows 2800 → 3010 (210 units) while 17 composes 110 electricity
 *   + 100 water = 210 units; the cycle uses 2800 → 2910 (110 units).
 */
export const DEMO_METER_ENTRY: MeterEntry = {
  month: DEMO_MONTH,
  rooms: [
    { roomId: 'room-102', roomNumber: '102', tenantName: 'রাহাত হোসেন', previous: 3245, current: 3368 },
    { roomId: 'room-103', roomNumber: '103', tenantName: 'সাব্বির আহমেদ', previous: 2890, current: 2970 },
    { roomId: 'room-104', roomNumber: '104', tenantName: 'তানভীর ইসলাম', previous: 2560, current: 2650 },
    { roomId: 'room-105', roomNumber: '105', tenantName: 'মেহেদী হাসান', previous: 1980, current: 2050 },
    { roomId: 'room-107', roomNumber: '107', tenantName: 'নাফিসা আক্তার', previous: 2800, current: 2910 },
  ],
  water: { previous: 4500, current: 5000 },
};

/**
 * July bills (rent-only opening papers) and their payments. The leftover,
 * Σ billed − Σ paid, is the carried due that enters August's prev_due line:
 * রাহাত 4,200 · সাব্বির 2,500 · মেহেদী 4,900.
 */
export const PRIOR_BILLED_BY_ROOM: Record<string, number> = {
  '102': 9000,
  '103': 9500,
  '104': 10000,
  '105': 8500,
  '107': 10500,
};
export const PRIOR_PAID_BY_ROOM: Record<string, number> = {
  '102': 4800,
  '103': 7000,
  '104': 10000,
  '105': 3600,
  '107': 10500,
};

/** Documented carried dues entering আগস্ট (derived from the July ledger). */
export const DEMO_PREV_DUES: Record<string, number> = {
  '102': 4200,
  '103': 2500,
  '105': 4900,
};

/** August payments, consistent with 22's paid column — total ৳42,200 (§9). */
export const DEMO_PAID_BY_ROOM: Record<string, number> = {
  '102': 6673,
  '103': 10627,
  '104': 11625,
  '105': 0,
  '107': 13275,
};

/** 28's ব্যয় খাত — মেরামত, ইউটিলিটি বিল, স্টাফ বেতন, অন্যান্য; total ৳9,400. */
export const DEMO_EXPENSES: FinanceEntry[] = [
  {
    id: 'fin-repair',
    propertyId: DEMO_PROPERTY_ID,
    kind: 'expense',
    category: 'মেরামত',
    amount: 3500,
    date: '2026-08-08',
    note: 'সিঁড়ি ও পানির লাইন মেরামত',
    createdAt: '2026-08-08T00:00:00.000Z',
  },
  {
    id: 'fin-utility',
    propertyId: DEMO_PROPERTY_ID,
    kind: 'expense',
    category: 'ইউটিলিটি বিল',
    amount: 2200,
    date: '2026-08-08',
    note: 'পানি ও বিদ্যুৎ লাইন বিল',
    createdAt: '2026-08-08T00:00:00.000Z',
  },
  {
    id: 'fin-salary',
    propertyId: DEMO_PROPERTY_ID,
    kind: 'expense',
    category: 'স্টাফ বেতন',
    amount: 3000,
    date: '2026-08-05',
    note: 'কেয়ারটেকার বেতন',
    createdAt: '2026-08-05T00:00:00.000Z',
  },
  {
    id: 'fin-other',
    propertyId: DEMO_PROPERTY_ID,
    kind: 'expense',
    category: 'অন্যান্য',
    amount: 700,
    date: '2026-08-20',
    note: 'পরিষ্কার সরঞ্জাম',
    createdAt: '2026-08-20T00:00:00.000Z',
  },
];

/** Tenant room shift recorded outside the demo snapshot. */
export interface PriorShift {
  tenantId: TenantId;
  fromRoomId: RoomId | null;
  toRoomId: RoomId;
  effectiveDate: string;
}

/** Full in-memory state the memory repository boots from. */
export interface DemoState {
  property: Property;
  rooms: Room[];
  tenants: Tenant[];
  loans: Loan[];
  meterEntries: Map<MonthKey, MeterEntry>;
  bills: Bill[];
  ledger: LedgerEntry[];
  adjustments: Adjustment[];
  finance: FinanceEntry[];
  shifts: PriorShift[];
}

function cloneMeterEntry(entry: MeterEntry): MeterEntry {
  return {
    month: entry.month,
    rooms: entry.rooms.map((room) => ({ ...room })),
    water: { ...entry.water },
  };
}

/** Build the July opening paper: rent-only, no utilities yet. */
function buildPriorBills(property: Property, rooms: Room[], tenants: Tenant[]): Bill[] {
  const bills: Bill[] = [];
  for (const room of rooms) {
    if (room.status !== 'occupied') continue;
    const billed = PRIOR_BILLED_BY_ROOM[room.number];
    if (billed === undefined) continue;
    const paid = PRIOR_PAID_BY_ROOM[room.number] ?? 0;
    const tenant = tenants.find((t) => t.roomId === room.id && t.status === 'active');
    const lines: BillLine[] = [{ kind: 'rent', label: BILL_LABELS.rent, amount: room.rent }];
    bills.push({
      id: `${PRIOR_MONTH}-${room.number}`,
      propertyId: property.id,
      month: PRIOR_MONTH,
      roomId: room.id,
      tenantId: tenant?.id ?? '',
      lines,
      utilitiesTotal: 0,
      total: billed,
      paperRef: `RF-${PRIOR_MONTH.replace(/-/g, '')}-${room.number}`,
      status: paid >= billed ? 'paid' : paid > 0 ? 'partial' : 'due',
      paidAmount: paid,
      createdAt: `${PRIOR_MONTH}-01T00:00:00.000Z`,
    });
  }
  return bills;
}

function buildPriorLedger(property: Property, tenants: Tenant[], rooms: Room[]): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  for (const room of rooms) {
    if (room.status !== 'occupied') continue;
    const paid = PRIOR_PAID_BY_ROOM[room.number] ?? 0;
    if (paid <= 0) continue;
    const tenant = tenants.find((t) => t.roomId === room.id && t.status === 'active');
    entries.push({
      id: `led-${PRIOR_MONTH}-${room.number}`,
      propertyId: property.id,
      billId: `${PRIOR_MONTH}-${room.number}`,
      tenantId: tenant?.id ?? '',
      month: PRIOR_MONTH,
      amount: paid,
      paidAt: `${PRIOR_MONTH}-19`,
      method: 'cash',
      createdAt: `${PRIOR_MONTH}-19T00:00:00.000Z`,
    });
  }
  return entries;
}

/**
 * Assemble the full demo state. Deterministic (no Math.random): every id is
 * derived, every amount is engine-computed or a documented §9 constant.
 */
export function buildDemoState(): DemoState {
  const property: Property = { ...DEMO_PROPERTY };
  const rooms: Room[] = DEMO_ROOMS.map((room) => ({ ...room }));
  const tenants: Tenant[] = DEMO_TENANTS.map((tenant) => ({ ...tenant }));
  const loans: Loan[] = [{ ...DEMO_LOAN }];
  const finance: FinanceEntry[] = DEMO_EXPENSES.map((entry) => ({ ...entry }));
  const adjustments: Adjustment[] = [];
  const shifts: PriorShift[] = [];

  const meterEntries = new Map<MonthKey, MeterEntry>([[DEMO_MONTH, cloneMeterEntry(DEMO_METER_ENTRY)]]);

  const priorBills = buildPriorBills(property, rooms, tenants);
  const priorLedger = buildPriorLedger(property, tenants, rooms);

  // Carried due entering August: Σ prior billed − Σ prior paid, per room.
  const prevDueByRoom = new Map<string, number>();
  for (const room of rooms) {
    const billed = priorBills.filter((bill) => bill.roomId === room.id).reduce((sum, bill) => sum + bill.total, 0);
    const paid = priorLedger.filter((entry) => entry.billId === `${PRIOR_MONTH}-${room.number}`).reduce((sum, entry) => sum + entry.amount, 0);
    const leftover = billed - paid;
    if (leftover !== 0) prevDueByRoom.set(room.id, leftover);
  }

  const tenantByRoom = new Map<string, { id: string; name: string; moveInDate: string }>();
  for (const tenant of tenants) {
    if (tenant.status === 'active' && tenant.roomId) {
      tenantByRoom.set(tenant.roomId, { id: tenant.id, name: tenant.name, moveInDate: tenant.moveInDate });
    }
  }

  // Active add-to-bill loans fold into the tenant's room paper.
  const loanInstallmentByRoom = new Map<string, number>();
  for (const loan of loans) {
    if (loan.status !== 'active' || !loan.addToBill) continue;
    if (loan.paidInstallments >= loan.installmentCount) continue;
    const tenant = tenants.find((t) => t.id === loan.tenantId);
    if (tenant?.roomId) loanInstallmentByRoom.set(tenant.roomId, loan.installmentAmount);
  }

  const augustBills = buildMonthBills({
    month: DEMO_MONTH,
    property,
    rooms,
    tenantByRoom,
    meterEntry: meterEntries.get(DEMO_MONTH)!,
    adjustmentsByRoom: new Map(),
    prevDueByRoom,
    loanInstallmentByRoom,
    existingRefs: priorBills.map((bill) => bill.paperRef),
  });

  // Record August payments (22's paid column) against the freshly built bills.
  const augustLedger: LedgerEntry[] = [];
  for (const bill of augustBills) {
    const room = rooms.find((r) => r.id === bill.roomId)!;
    const amount = DEMO_PAID_BY_ROOM[room.number] ?? 0;
    if (amount <= 0) continue;
    augustLedger.push({
      id: `led-${DEMO_MONTH}-${room.number}`,
      propertyId: property.id,
      billId: bill.id,
      tenantId: bill.tenantId,
      month: DEMO_MONTH,
      amount,
      paidAt: `${DEMO_MONTH}-19`,
      method: 'cash',
      createdAt: `${DEMO_MONTH}-19T00:00:00.000Z`,
    });
    bill.paidAmount += amount;
    bill.status = bill.paidAmount >= bill.total ? 'paid' : bill.paidAmount > 0 ? 'partial' : 'due';
  }

  return {
    property,
    rooms,
    tenants,
    loans,
    meterEntries,
    bills: [...priorBills, ...augustBills],
    ledger: [...priorLedger, ...augustLedger],
    adjustments,
    finance,
    shifts,
  };
}
