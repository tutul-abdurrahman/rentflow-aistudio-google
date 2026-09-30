import { describe, it, expect } from 'vitest';
import {
  BILL_LABELS,
  NEGATIVE_READING,
  buildMonthBills,
  calcRoomBill,
  cycleTotal,
  dashboardSnapshot,
  dayWiseRent,
  daysInMonth,
  electricityUnits,
  occupiedRooms,
  paperRef,
  shiftReadings,
  type Tenancy,
  waterShareUnits,
} from './index';
import type { Bill, FinanceEntry, LedgerEntry, MeterEntry, Property, Room } from '../types';

const property: Property = {
  id: 'p1',
  name: 'আবাসিক ভবন',
  address: 'ঢাকা',
  ownerName: 'রফিকুল ইসলাম',
  ownerPhone: '01711234567',
  electricityRate: 7.5,
  wasteFee: 200,
  waterSplitRule: 'occupied_plus_one',
  midMonthRule: 'day_wise',
  createdAt: '2024-01-01T00:00:00.000Z',
};

const rooms: Room[] = [
  { id: 'room-102', propertyId: 'p1', number: '102', rent: 9000, status: 'occupied', sortOrder: 1 },
  { id: 'room-103', propertyId: 'p1', number: '103', rent: 9500, status: 'occupied', sortOrder: 2 },
  { id: 'room-104', propertyId: 'p1', number: '104', rent: 10000, status: 'occupied', sortOrder: 3 },
  { id: 'room-105', propertyId: 'p1', number: '105', rent: 8500, status: 'occupied', sortOrder: 4 },
  { id: 'room-106', propertyId: 'p1', number: '106', rent: 9200, status: 'vacant', sortOrder: 5 },
  { id: 'room-107', propertyId: 'p1', number: '107', rent: 10500, status: 'occupied', sortOrder: 6 },
];

const meterEntry: MeterEntry = {
  month: '2026-08',
  rooms: [
    { roomId: 'room-102', roomNumber: '102', previous: 3245, current: 3368 },
    { roomId: 'room-103', roomNumber: '103', previous: 2890, current: 2970 },
    { roomId: 'room-104', roomNumber: '104', previous: 2560, current: 2650 },
    { roomId: 'room-105', roomNumber: '105', previous: 1980, current: 2050 },
    { roomId: 'room-107', roomNumber: '107', previous: 2800, current: 3010 },
  ],
  water: { previous: 4500, current: 5000 },
};

// Tenancy intervals (active + archived) — the engine derives the month's
// tenant and the month's occupancy from these, never from room.status.
const tenancies: Tenancy[] = [
  { id: 't-102', name: 'রাহাত হোসেন', roomId: 'room-102', moveInDate: '2025-01-01' },
  { id: 't-103', name: 'সাব্বির আহমেদ', roomId: 'room-103', moveInDate: '2025-01-01' },
  { id: 't-104', name: 'তানভীর ইসলাম', roomId: 'room-104', moveInDate: '2025-01-01' },
  { id: 't-105', name: 'মেহেদী হাসান', roomId: 'room-105', moveInDate: '2025-01-01' },
  { id: 't-107', name: 'নাফিসা আক্তার', roomId: 'room-107', moveInDate: '2025-01-01' },
];

function buildFixtureBills(): Bill[] {
  return buildMonthBills({
    month: '2026-08',
    property,
    rooms,
    tenancies,
    meterEntry,
    adjustmentsByRoom: new Map([['room-102', [{ label: 'অতিরিক্ত ইউনিট', amount: 195 }]]]),
    prevDueByRoom: new Map([['room-102', 4200]]),
    loanInstallmentByRoom: new Map([['room-107', 1000]]),
    existingRefs: [],
  });
}

describe('electricityUnits', () => {
  it('returns current − previous', () => {
    expect(electricityUnits(3245, 3368)).toBe(123);
    expect(electricityUnits(2800, 2800)).toBe(0);
  });

  it('rejects a negative reading with the NEGATIVE_READING error', () => {
    expect(() => electricityUnits(2560, 2500)).toThrow(NEGATIVE_READING);
    expect(() => electricityUnits(2560, 2500)).toThrowError(new Error(NEGATIVE_READING));
  });
});

describe('waterShareUnits', () => {
  it('divides by occupied rooms + 1 and rounds to 2dp', () => {
    expect(waterShareUnits(500, 5)).toBe(83.33);
    expect(waterShareUnits(600, 5)).toBe(100);
    expect(waterShareUnits(1500, 2)).toBe(500);
  });

  it('keeps the +1 even with a single occupied room', () => {
    expect(waterShareUnits(500, 0)).toBe(500);
    expect(waterShareUnits(500, 4)).toBe(100);
  });
});

describe('dayWiseRent', () => {
  it('returns full rent for the full_month rule', () => {
    expect(dayWiseRent(9000, 15, 31, 'full_month')).toBe(9000);
  });

  it('returns full rent when moveInDay is 1', () => {
    expect(dayWiseRent(9000, 1, 31, 'day_wise')).toBe(9000);
  });

  it('prorates by remaining days, rounded to the nearest taka', () => {
    // 17 of 31 days: 9000 × 17 ÷ 31 = 4935.48 → 4935
    expect(dayWiseRent(9000, 15, 31, 'day_wise')).toBe(4935);
    // 15 of 30 days
    expect(dayWiseRent(10000, 16, 30, 'day_wise')).toBe(5000);
  });

  it('never goes negative past the end of the month', () => {
    expect(dayWiseRent(9000, 40, 31, 'day_wise')).toBe(0);
  });
});

describe('calcRoomBill', () => {
  it('composes lines in rent → electricity → water → waste → adjustment → prev_due → loan order', () => {
    const result = calcRoomBill({
      month: '2026-08',
      roomNumber: '102',
      rent: 9000,
      elecUnits: 123,
      waterUnits: 83.33,
      rate: 7.5,
      wasteFee: 200,
      adjustments: [{ label: 'অতিরিক্ত ইউনিট', amount: 195 }],
      prevDue: 4200,
      loanInstallment: 1000,
    });

    expect(result.lines.map((line) => line.kind)).toEqual([
      'rent',
      'electricity',
      'water',
      'waste',
      'adjustment',
      'prev_due',
      'loan',
    ]);
    expect(result.lines.map((line) => line.amount)).toEqual([9000, 923, 625, 200, 195, 4200, 1000]);
    expect(result.lines.map((line) => line.label)).toEqual([
      BILL_LABELS.rent,
      BILL_LABELS.electricity,
      BILL_LABELS.water,
      BILL_LABELS.waste,
      BILL_LABELS.adjustment,
      BILL_LABELS.prev_due,
      BILL_LABELS.loan,
    ]);
    expect(result.utilitiesTotal).toBe(1548);
    expect(result.rentPayable).toBe(9000);
    expect(result.total).toBe(16143);
    // ASCII detail strings (screens format Bengali numerals).
    expect(result.lines[1].detail).toBe('123 unit × 7.5');
    expect(result.lines[2].detail).toBe('83.33 unit × 7.5');
    expect(result.lines[4].detail).toBe('অতিরিক্ত ইউনিট');
  });

  it('keeps rent always and drops zero lines; prev_due and loan are absent when 0', () => {
    const result = calcRoomBill({
      month: '2026-08',
      roomNumber: '106',
      rent: 9200,
      elecUnits: 0,
      waterUnits: 0,
      rate: 7.5,
      wasteFee: 0,
      adjustments: [{ label: 'শূন্য', amount: 0 }],
      prevDue: 0,
    });

    expect(result.lines).toEqual([{ kind: 'rent', label: BILL_LABELS.rent, amount: 9200 }]);
    expect(result.total).toBe(9200);
    expect(result.utilitiesTotal).toBe(0);
  });

  it('keeps a loan installment of 0 out of the paper', () => {
    const result = calcRoomBill({
      month: '2026-08',
      roomNumber: '102',
      rent: 9000,
      elecUnits: 100,
      waterUnits: 0,
      rate: 7.5,
      wasteFee: 200,
      adjustments: [],
      prevDue: 0,
      loanInstallment: 0,
    });
    expect(result.lines.some((line) => line.kind === 'loan')).toBe(false);
    expect(result.total).toBe(9950);
  });

  it('allows a negative adjustment credit', () => {
    const result = calcRoomBill({
      month: '2026-08',
      roomNumber: '102',
      rent: 9000,
      elecUnits: 0,
      waterUnits: 0,
      rate: 7.5,
      wasteFee: 200,
      adjustments: [{ label: 'ছাড়', amount: -300 }],
      prevDue: 0,
    });
    expect(result.lines.find((line) => line.kind === 'adjustment')?.amount).toBe(-300);
    expect(result.total).toBe(8900);
  });

  it('prorates mid-month rent day-wise and records the day fraction', () => {
    const result = calcRoomBill({
      month: '2026-08',
      roomNumber: '102',
      rent: 9000,
      elecUnits: 0,
      waterUnits: 0,
      rate: 7.5,
      wasteFee: 0,
      adjustments: [],
      prevDue: 0,
      midMonth: { moveInDay: 15, daysInMonth: 31, rule: 'day_wise' },
    });
    expect(result.rentPayable).toBe(4935);
    expect(result.lines[0]).toEqual({ kind: 'rent', label: BILL_LABELS.rent, amount: 4935, detail: '17/31 day' });
  });

  it('honours the full_month rule even when mid-month', () => {
    const result = calcRoomBill({
      month: '2026-08',
      roomNumber: '102',
      rent: 9000,
      elecUnits: 0,
      waterUnits: 0,
      rate: 7.5,
      wasteFee: 0,
      adjustments: [],
      prevDue: 0,
      midMonth: { moveInDay: 15, daysInMonth: 31, rule: 'full_month' },
    });
    expect(result.rentPayable).toBe(9000);
    expect(result.total).toBe(9000);
  });
});

describe('paperRef', () => {
  it('builds RF-YYYYMM-RRR', () => {
    expect(paperRef('2026-08', '102', [])).toBe('RF-202608-102');
  });

  it('appends a sequence suffix until unique', () => {
    expect(paperRef('2026-08', '102', ['RF-202608-102'])).toBe('RF-202608-102-2');
    expect(paperRef('2026-08', '102', ['RF-202608-102', 'RF-202608-102-2'])).toBe('RF-202608-102-3');
    expect(paperRef('2026-08', '102', ['RF-202608-102-2'])).toBe('RF-202608-102');
  });
});

describe('shiftReadings', () => {
  it('moves previous ← current for room and water meters without mutating the input', () => {
    const shifted = shiftReadings(meterEntry);
    expect(shifted.rooms[0]).toMatchObject({ previous: 3368, current: 3368 });
    expect(shifted.water).toEqual({ previous: 5000, current: 5000 });
    expect(shifted.rooms).toHaveLength(5);
    // original untouched
    expect(meterEntry.rooms[0].previous).toBe(3245);
    expect(meterEntry.water.current).toBe(5000);
  });
});

describe('occupiedRooms', () => {
  it('filters vacant rooms and orders by sortOrder', () => {
    const result = occupiedRooms(rooms);
    expect(result.map((room) => room.number)).toEqual(['102', '103', '104', '105', '107']);
    expect(result.every((room) => room.status === 'occupied')).toBe(true);
  });
});

describe('cycleTotal', () => {
  it('sums bill totals', () => {
    // rent 47500 + elec 4298 + water 3125 + waste 1000 + prev 4200 + adj 195 + loan 1000.
    expect(cycleTotal(buildFixtureBills())).toBe(61318);
  });
});

describe('dashboardSnapshot', () => {
  const mkBill = (over: Partial<Bill>): Bill => ({
    id: 'b',
    propertyId: 'p1',
    month: '2026-08',
    roomId: 'room-102',
    tenantId: 't-102',
    lines: [],
    utilitiesTotal: 0,
    total: 0,
    paperRef: 'RF',
    status: 'due',
    paidAmount: 0,
    createdAt: '2026-08-01T00:00:00.000Z',
    ...over,
  });

  const bills: Bill[] = [
    mkBill({ id: 'b1', roomId: 'room-102', tenantId: 't-102', total: 1000, paidAmount: 400 }),
    mkBill({ id: 'b2', roomId: 'room-103', tenantId: 't-103', total: 500, paidAmount: 500 }),
    mkBill({ id: 'b3', month: '2026-07', roomId: 'room-105', tenantId: 't-105', total: 999, paidAmount: 0 }),
  ];
  const ledger: LedgerEntry[] = [
    { id: 'l1', propertyId: 'p1', billId: 'b1', tenantId: 't-102', month: '2026-08', amount: 400, paidAt: '2026-08-10', createdAt: '2026-08-10T00:00:00.000Z' },
    { id: 'l2', propertyId: 'p1', billId: 'b2', tenantId: 't-103', month: '2026-08', amount: 100, paidAt: '2026-08-11', createdAt: '2026-08-11T00:00:00.000Z' },
    { id: 'l3', propertyId: 'p1', billId: 'b3', tenantId: 't-105', month: '2026-07', amount: 50, paidAt: '2026-07-11', createdAt: '2026-07-11T00:00:00.000Z' },
  ];
  const expenses: FinanceEntry[] = [
    { id: 'e1', propertyId: 'p1', kind: 'expense', category: 'মেরামত', amount: 300, date: '2026-08-02', createdAt: '2026-08-02T00:00:00.000Z' },
    { id: 'e2', propertyId: 'p1', kind: 'expense', category: 'অন্যান্য', amount: 100, date: '2026-07-02', createdAt: '2026-07-02T00:00:00.000Z' },
    { id: 'e3', propertyId: 'p1', kind: 'income', category: 'পার্কিং', amount: 999, date: '2026-08-02', createdAt: '2026-08-02T00:00:00.000Z' },
  ];

  it('computes month-scoped due/collected/expense and room counts', () => {
    const snapshot = dashboardSnapshot({
      bills,
      ledger,
      expenses,
      rooms,
      month: '2026-08',
      tenants: [
        { id: 't-102', name: 'রাহাত হোসেন' },
        { id: 't-103', name: 'সাব্বির আহমেদ' },
      ],
    });
    expect(snapshot.dueTotal).toBe(600);
    expect(snapshot.collectedTotal).toBe(500);
    expect(snapshot.expenseTotal).toBe(300);
    expect(snapshot.vacantRooms).toBe(1);
    expect(snapshot.totalRooms).toBe(6);
    expect(snapshot.dueList).toEqual([
      { tenantId: 't-102', tenantName: 'রাহাত হোসেন', roomNumber: '102', amount: 600 },
    ]);
  });

  it('orders open rows by amount descending', () => {
    const snapshot = dashboardSnapshot({
      bills: [
        mkBill({ id: 'a', roomId: 'room-102', tenantId: 't-102', total: 900, paidAmount: 0 }),
        mkBill({ id: 'b', roomId: 'room-105', tenantId: 't-105', total: 5000, paidAmount: 0 }),
        mkBill({ id: 'c', roomId: 'room-107', tenantId: 't-107', total: 2000, paidAmount: 0 }),
      ],
      ledger: [],
      expenses: [],
      rooms,
      month: '2026-08',
      tenants: [],
    });
    expect(snapshot.dueList.map((row) => row.amount)).toEqual([5000, 2000, 900]);
  });
});

describe('buildMonthBills', () => {
  it('builds one paper per occupied room, skipping vacant 106 entirely', () => {
    const bills = buildFixtureBills();
    expect(bills).toHaveLength(5);
    expect(bills.map((bill) => bill.id)).toEqual([
      '2026-08-102',
      '2026-08-103',
      '2026-08-104',
      '2026-08-105',
      '2026-08-107',
    ]);
    expect(bills.some((bill) => bill.roomId === 'room-106')).toBe(false);
    expect(bills.every((bill) => bill.status === 'due' && bill.paidAmount === 0)).toBe(true);
    expect(new Set(bills.map((bill) => bill.paperRef)).size).toBe(5);
  });

  it('uses the occupied+1 water share, so vacant 106 is never in the denominator', () => {
    const bills = buildFixtureBills();
    // 500 building units ÷ (5 occupied + 1) = 83.33 → ৳625 at 7.5
    for (const bill of bills) {
      const water = bill.lines.find((line) => line.kind === 'water');
      expect(water?.amount).toBe(625);
      expect(water?.detail).toBe('83.33 unit × 7.5');
    }
    // 500 ÷ (5+1) — not 500 ÷ 5 (design canvas) and not 500 ÷ 7.
    expect(waterShareUnits(500, 5)).toBe(83.33);
  });

  it('folds prev due, adjustments and the loan into the right rooms', () => {
    const bills = buildFixtureBills();
    const byId = new Map(bills.map((bill) => [bill.id, bill]));
    expect(byId.get('2026-08-102')?.lines.find((line) => line.kind === 'prev_due')?.amount).toBe(4200);
    expect(byId.get('2026-08-102')?.lines.find((line) => line.kind === 'adjustment')?.amount).toBe(195);
    expect(byId.get('2026-08-107')?.lines.find((line) => line.kind === 'loan')?.amount).toBe(1000);
    expect(byId.get('2026-08-103')?.lines.some((line) => line.kind === 'prev_due')).toBe(false);
    expect(byId.get('2026-08-103')?.lines.some((line) => line.kind === 'loan')).toBe(false);
  });

  it('prorates rent for a tenant who moved in mid-month', () => {
    const midMonthTenancies = tenancies.map((tenancy) =>
      tenancy.roomId === 'room-102' ? { ...tenancy, moveInDate: '2026-08-15' } : tenancy,
    );
    const bills = buildMonthBills({
      month: '2026-08',
      property,
      rooms,
      tenancies: midMonthTenancies,
      meterEntry,
      adjustmentsByRoom: new Map(),
      prevDueByRoom: new Map(),
      loanInstallmentByRoom: new Map(),
      existingRefs: [],
    });
    const first = bills.find((bill) => bill.id === '2026-08-102');
    expect(first?.lines[0].amount).toBe(4935);
    expect(first?.lines[0].detail).toBe('17/31 day');
  });

  it('propagates the negative-reading rejection', () => {
    const badMeter: MeterEntry = {
      ...meterEntry,
      rooms: meterEntry.rooms.map((room) =>
        room.roomId === 'room-104' ? { ...room, current: 2500 } : room,
      ),
    };
    expect(() =>
      buildMonthBills({
        month: '2026-08',
        property,
        rooms,
        tenancies,
        meterEntry: badMeter,
        adjustmentsByRoom: new Map(),
        prevDueByRoom: new Map(),
        loanInstallmentByRoom: new Map(),
        existingRefs: [],
      }),
    ).toThrow(NEGATIVE_READING);
  });
});

describe('buildMonthBills — tenancy intervals pick the month’s tenant', () => {
  // 201 is re-let after a gap month; 202 takes a mid-June move-in.
  const tenancyRooms: Room[] = [
    { id: 'room-201', propertyId: 'p1', number: '201', rent: 9000, status: 'vacant', sortOrder: 1 },
    { id: 'room-202', propertyId: 'p1', number: '202', rent: 2800, status: 'occupied', sortOrder: 2 },
  ];

  const intervals: Tenancy[] = [
    // A lived in 201 through 31 May, B moves in 1 July → June bills nobody.
    { id: 't-a', name: 'ক', roomId: 'room-201', moveInDate: '2025-01-01', moveOutDate: '2026-05-31' },
    { id: 't-b', name: 'খ', roomId: 'room-201', moveInDate: '2026-07-01' },
    // C moved into 202 on 16 June at ৳2,800 rent.
    { id: 't-c', name: 'গ', roomId: 'room-202', moveInDate: '2026-06-16' },
  ];

  const build = (month: string, meterEntry: MeterEntry): Bill[] =>
    buildMonthBills({
      month,
      property,
      rooms: tenancyRooms,
      tenancies: intervals,
      meterEntry,
      adjustmentsByRoom: new Map(),
      prevDueByRoom: new Map(),
      loanInstallmentByRoom: new Map(),
      existingRefs: [],
    });

  it('T4 — bills the moved-out tenant for their final month and nobody in the gap', () => {
    const may = build('2026-05', {
      month: '2026-05',
      rooms: [{ roomId: 'room-201', roomNumber: '201', previous: 100, current: 200 }],
      water: { previous: 0, current: 0 },
    });
    expect(may.map((bill) => bill.roomId)).toEqual(['room-201']);
    expect(may[0].tenantId).toBe('t-a'); // A's final month, move-out 31 May

    const june = build('2026-06', {
      month: '2026-06',
      rooms: [{ roomId: 'room-202', roomNumber: '202', previous: 1000, current: 1050 }],
      water: { previous: 0, current: 0 },
    });
    // Nobody lived in 201 in June → no paper at all for that room.
    expect(june.some((bill) => bill.roomId === 'room-201')).toBe(false);
    const june202 = june.find((bill) => bill.roomId === 'room-202')!;
    expect(june202.tenantId).toBe('t-c');
    // ৳2,800 × 15/30 days (16 June → 30 June) = ৳1,400
    expect(june202.lines[0]).toEqual({
      kind: 'rent',
      label: BILL_LABELS.rent,
      amount: 1400,
      detail: '15/30 day',
    });

    const july = build('2026-07', {
      month: '2026-07',
      rooms: [
        { roomId: 'room-201', roomNumber: '201', previous: 200, current: 240 },
        { roomId: 'room-202', roomNumber: '202', previous: 1050, current: 1100 },
      ],
      water: { previous: 0, current: 0 },
    });
    expect(july.map((bill) => bill.tenantId)).toEqual(['t-b', 't-c']);
    const july201 = july.find((bill) => bill.roomId === 'room-201')!;
    // Re-let from 1 July → a normal full month, no day-wise detail.
    expect(july201.lines[0]).toEqual({ kind: 'rent', label: BILL_LABELS.rent, amount: 9000 });
  });
});

describe('daysInMonth re-export', () => {
  it('delegates to format.ts', () => {
    expect(daysInMonth('2026-08')).toBe(31);
    expect(daysInMonth('2026-02')).toBe(28);
  });
});
