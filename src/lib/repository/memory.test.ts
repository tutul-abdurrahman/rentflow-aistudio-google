import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryRepository } from './memory';
import type { RentFlowRepository } from './types';
import { cycleTotal, dashboardSnapshot, shiftReadings, waterShareUnits } from '../engine';
import { DEMO_MONTH, DEMO_PREV_DUES, buildDemoState } from '../seed/demo';
import { currentMonth } from '../view';
import type { Bill, MeterEntry, MonthKey } from '../types';

const amountOf = (bill: Bill, kind: string): number =>
  bill.lines.filter((line) => line.kind === kind).reduce((sum, line) => sum + line.amount, 0);

const expectedTable = [
  { room: '102', rent: 9000, electricity: 923, water: 625, waste: 200, prevDue: 4200, loan: 0, utilitiesTotal: 1548, total: 14948, paid: 6673, status: 'partial' },
  { room: '103', rent: 9500, electricity: 600, water: 625, waste: 200, prevDue: 2500, loan: 0, utilitiesTotal: 1225, total: 13425, paid: 10627, status: 'partial' },
  { room: '104', rent: 10000, electricity: 675, water: 625, waste: 200, prevDue: 0, loan: 0, utilitiesTotal: 1300, total: 11500, paid: 11625, status: 'paid' },
  { room: '105', rent: 8500, electricity: 525, water: 625, waste: 200, prevDue: 4900, loan: 0, utilitiesTotal: 1150, total: 14750, paid: 0, status: 'due' },
  { room: '107', rent: 10500, electricity: 825, water: 625, waste: 200, prevDue: 0, loan: 1000, utilitiesTotal: 1450, total: 13150, paid: 13275, status: 'paid' },
] as const;

describe('memory repository — demo seed', () => {
  let repo: RentFlowRepository;

  beforeEach(async () => {
    repo = createMemoryRepository();
    await repo.seedDemo();
  });

  it('calculatePapers builds one paper per occupied room and none for vacant 106', async () => {
    const bills = await repo.calculatePapers(DEMO_MONTH);
    const rooms = await repo.listRooms();
    const roomNumbers = bills.map((bill) => rooms.find((room) => room.id === bill.roomId)?.number);

    expect(bills).toHaveLength(5);
    expect(roomNumbers).toEqual(['102', '103', '104', '105', '107']);
    expect(bills.some((bill) => bill.roomId === 'room-106')).toBe(false);
  });

  it('matches the engine-computed per-room table', async () => {
    const bills = await repo.calculatePapers(DEMO_MONTH);
    const rooms = await repo.listRooms();
    const byNumber = new Map(bills.map((bill) => [rooms.find((room) => room.id === bill.roomId)?.number, bill]));

    for (const expected of expectedTable) {
      const bill = byNumber.get(expected.room);
      expect(bill, `room ${expected.room}`).toBeDefined();
      expect(amountOf(bill!, 'rent')).toBe(expected.rent);
      expect(amountOf(bill!, 'electricity')).toBe(expected.electricity);
      expect(amountOf(bill!, 'water')).toBe(expected.water);
      expect(amountOf(bill!, 'waste')).toBe(expected.waste);
      expect(amountOf(bill!, 'prev_due')).toBe(expected.prevDue);
      expect(amountOf(bill!, 'loan')).toBe(expected.loan);
      expect(bill!.utilitiesTotal).toBe(expected.utilitiesTotal);
      expect(bill!.total).toBe(expected.total);
      expect(bill!.paidAmount).toBe(expected.paid);
      expect(bill!.status).toBe(expected.status);
      expect(bill!.paperRef).toBe(`RF-202608-${expected.room}`);
    }
  });

  it('bills the same papers the engine builds from the seed fixture', async () => {
    const stored = await repo.calculatePapers(DEMO_MONTH);
    const fixture = buildDemoState().bills.filter((bill) => bill.month === DEMO_MONTH);
    for (const expected of fixture) {
      const actual = stored.find((bill) => bill.id === expected.id);
      expect(actual?.lines).toEqual(expected.lines);
      expect(actual?.total).toBe(expected.total);
    }
  });

  it('cycleTotal = Σ totals = ৳67,773 (engine math, not the ৳57,998 canvas figure)', async () => {
    const bills = await repo.calculatePapers(DEMO_MONTH);
    expect(cycleTotal(bills)).toBe(67773);
    expect(bills.reduce((sum, bill) => sum + bill.total, 0)).toBe(67773);
  });

  it('is idempotent — re-calling calculatePapers returns the stored papers', async () => {
    const first = await repo.calculatePapers(DEMO_MONTH);
    const second = await repo.calculatePapers(DEMO_MONTH);
    expect(second.map((bill) => bill.paperRef)).toEqual(first.map((bill) => bill.paperRef));
    expect(second.map((bill) => bill.total)).toEqual(first.map((bill) => bill.total));
    expect((await repo.listBills(DEMO_MONTH)).length).toBe(5);
  });

  it('seed carried dues entering August are রাহাত 4,200 · সাব্বির 2,500 · মেহেদী 4,900', async () => {
    const prevDue = await repo.getPrevDueByRoom(DEMO_MONTH);
    expect(prevDue.get('room-102')).toBe(DEMO_PREV_DUES['102']);
    expect(prevDue.get('room-103')).toBe(DEMO_PREV_DUES['103']);
    expect(prevDue.get('room-105')).toBe(DEMO_PREV_DUES['105']);
    expect(prevDue.size).toBe(3);
  });

  it('recordPayment updates paidAmount and status', async () => {
    const bills = await repo.calculatePapers(DEMO_MONTH);
    const dueBill = bills.find((bill) => bill.id === '2026-08-105')!;

    const partial = await repo.recordPayment({ billId: dueBill.id, amount: 1000, paidAt: '2026-08-20', method: 'bkash' });
    expect(partial.month).toBe(DEMO_MONTH);
    let after = (await repo.getBill(dueBill.id))!;
    expect(after.paidAmount).toBe(1000);
    expect(after.status).toBe('partial');

    await repo.recordPayment({ billId: dueBill.id, amount: 13750, paidAt: '2026-08-21', method: 'cash' });
    after = (await repo.getBill(dueBill.id))!;
    expect(after.paidAmount).toBe(14750);
    expect(after.status).toBe('paid');

    const augustCollected = (await repo.listLedger(DEMO_MONTH)).reduce((sum, entry) => sum + entry.amount, 0);
    expect(augustCollected).toBe(42200 + 14750);
  });

  it('adjustBill updates the stored bill in place and never regenerates', async () => {
    const before = await repo.calculatePapers(DEMO_MONTH);
    const target = before.find((bill) => bill.id === '2026-08-104')!;

    const adjusted = await repo.adjustBill(DEMO_MONTH, 'room-104', { label: 'নতুন কল', amount: 500 });
    expect(adjusted.id).toBe(target.id);
    expect(adjusted.paperRef).toBe(target.paperRef);
    expect(adjusted.total).toBe(target.total + 500);
    expect(adjusted.lines.at(-1)).toMatchObject({ kind: 'adjustment', amount: 500, detail: 'নতুন কল' });

    const stored = (await repo.getBill(target.id))!;
    expect(stored.total).toBe(12000);
    const other = (await repo.getBill('2026-08-105'))!;
    expect(other.total).toBe(14750);
    expect(await repo.listAdjustments(DEMO_MONTH)).toHaveLength(1);
  });

  it('getPrevDueByRoom(2026-09) carries August leftovers from the ledger', async () => {
    await repo.calculatePapers(DEMO_MONTH);
    const prevDue = await repo.getPrevDueByRoom('2026-09');
    // August total − August paid per room (overpayments carry as a negative credit).
    expect(prevDue.get('room-102')).toBe(14948 - 6673);
    expect(prevDue.get('room-103')).toBe(13425 - 10627);
    expect(prevDue.get('room-104')).toBe(11500 - 11625);
    expect(prevDue.get('room-105')).toBe(14750 - 0);
    expect(prevDue.get('room-107')).toBe(13150 - 13275);
  });

  it('builds a later month on demand, carrying August prev due and shifting readings', async () => {
    const augustMeter = (await repo.getMeterEntry(DEMO_MONTH))!;
    const september: MeterEntry = {
      month: '2026-09',
      rooms: augustMeter.rooms.map((room) => ({ ...room, previous: room.current, current: room.current + 40 })),
      water: { previous: augustMeter.water.current, current: augustMeter.water.current + 60 },
    };
    await repo.saveMeterEntry('2026-09', september);

    const bills = await repo.calculatePapers('2026-09');
    expect(bills).toHaveLength(5);
    const b102 = bills.find((bill) => bill.id === '2026-09-102')!;
    expect(amountOf(b102, 'prev_due')).toBe(8275);
    expect(amountOf(b102, 'electricity')).toBe(300); // 40 × 7.5
    expect(amountOf(b102, 'water')).toBe(75); // 60 ÷ 6 = 10 units × 7.5

    const shifted = (await repo.getMeterEntry('2026-09'))!;
    expect(shifted.rooms.find((room) => room.roomId === 'room-102')).toMatchObject({ previous: 3408, current: 3408 });
  });

  it('getDashboard equals the engine snapshot and the known §9 figures', async () => {
    await repo.calculatePapers(DEMO_MONTH);

    const snapshot = await repo.getDashboard(DEMO_MONTH);
    expect(snapshot.dueTotal).toBe(25823);
    expect(snapshot.collectedTotal).toBe(42200);
    expect(snapshot.expenseTotal).toBe(9400);
    expect(snapshot.vacantRooms).toBe(1);
    expect(snapshot.totalRooms).toBe(6);
    expect(snapshot.dueList.map((row) => row.amount)).toEqual([14750, 8275, 2798]);
    expect(snapshot.dueList.map((row) => row.roomNumber)).toEqual(['105', '102', '103']);

    const fixture = buildDemoState();
    const engineSnapshot = dashboardSnapshot({
      bills: fixture.bills,
      ledger: fixture.ledger,
      expenses: fixture.finance,
      rooms: fixture.rooms,
      month: DEMO_MONTH,
      tenants: fixture.tenants.map((tenant) => ({ id: tenant.id, name: tenant.name })),
    });
    expect(snapshot).toEqual(engineSnapshot);
  });

  it('getMonthlyLedger assembles the screen-22 rows', async () => {
    await repo.calculatePapers(DEMO_MONTH);
    const rows = await repo.getMonthlyLedger(DEMO_MONTH);
    expect(rows.map((row) => row.roomNumber)).toEqual(['102', '103', '104', '105', '107']);
    expect(rows.reduce((sum, row) => sum + row.total, 0)).toBe(67773);
    expect(rows.reduce((sum, row) => sum + row.paid, 0)).toBe(42200);
    expect(rows.find((row) => row.roomNumber === '102')?.paperRef).toBe('RF-202608-102');
    expect(rows.find((row) => row.roomNumber === '107')?.loan).toBe(1000);
  });

  it('getCashflow recomputes billed/collected/expenses/net per month', async () => {
    await repo.calculatePapers(DEMO_MONTH);
    const [july, august] = await repo.getCashflow(['2026-07', '2026-08']);
    expect(july).toEqual({ month: '2026-07', billed: 47500, collected: 35900, expenses: 0, net: 47500 });
    expect(august).toEqual({ month: '2026-08', billed: 67773, collected: 42200, expenses: 9400, net: 58373 });
  });

  it('listTenants filters active/archived and blocks deleting an active tenant', async () => {
    const active = await repo.listTenants('active');
    const archived = await repo.listTenants('archived');
    expect(active).toHaveLength(5);
    expect(archived.map((tenant) => tenant.name)).toEqual(['শামীম রেজা']);
    expect(archived[0].moveOutResolution).toBe('hold');

    await expect(repo.deleteArchivedTenant('tenant-rahat')).rejects.toThrow('TENANT_ACTIVE');
    // শামীম has no bills or ledger entries, so his archive row can be removed.
    await repo.deleteArchivedTenant('tenant-shamim');
    expect(await repo.listTenants('archived')).toHaveLength(0);
  });

  it('deleteArchivedTenant refuses when the tenant has bills or ledger history', async () => {
    await repo.moveOut('tenant-rahat', { date: '2026-09-30', resolution: 'hold' });

    await expect(repo.deleteArchivedTenant('tenant-rahat')).rejects.toThrow('TENANT_HAS_HISTORY');
    expect(await repo.getTenant('tenant-rahat')).not.toBeNull();
    expect((await repo.listBills(DEMO_MONTH)).some((bill) => bill.tenantId === 'tenant-rahat')).toBe(true);
  });

  it('shiftRoom and moveOut mutate tenant + room status and show up in history', async () => {
    const shifted = await repo.shiftRoom('tenant-rahat', 'room-106', '2026-09-01');
    expect(shifted.roomId).toBe('room-106');
    const rooms = await repo.listRooms();
    expect(rooms.find((room) => room.id === 'room-102')?.status).toBe('vacant');
    expect(rooms.find((room) => room.id === 'room-106')?.status).toBe('occupied');

    const history = await repo.getTenantHistory('tenant-rahat');
    expect(history.some((event) => event.label === 'রুম বদল')).toBe(true);

    const archived = await repo.moveOut('tenant-rahat', { date: '2026-09-30', resolution: 'refund', note: 'জমা ফেরত' });
    expect(archived.status).toBe('archived');
    expect(archived.roomId).toBeNull();
    expect((await repo.listRooms()).find((room) => room.id === 'room-106')?.status).toBe('vacant');
    const after = await repo.getTenantHistory('tenant-rahat');
    expect(after.some((event) => event.label === 'মুভ-আউট')).toBe(true);
  });

  it('seedDemo resets a mutated repository back to the demo state', async () => {
    await repo.calculatePapers(DEMO_MONTH);
    await repo.adjustBill(DEMO_MONTH, 'room-104', { label: 'পরীক্ষা', amount: 999 });
    await repo.seedDemo();
    const bills = await repo.calculatePapers(DEMO_MONTH);
    expect(bills.find((bill) => bill.id === '2026-08-104')?.total).toBe(11500);
    expect(await repo.listAdjustments()).toHaveLength(0);
    expect((await repo.listLedger(DEMO_MONTH)).length).toBe(4);
  });

  it('loans fold into the bill and payLoanInstallment advances the counter', async () => {
    const loans = await repo.listLoans();
    expect(loans).toHaveLength(1);
    expect(loans[0]).toMatchObject({ tenantId: 'tenant-nafisa', paidInstallments: 2, addToBill: true });

    const paid = await repo.payLoanInstallment('loan-nafisa');
    expect(paid.paidInstallments).toBe(3);
    const bills = await repo.calculatePapers(DEMO_MONTH);
    expect(amountOf(bills.find((bill) => bill.id === '2026-08-107')!, 'loan')).toBe(1000);

    const cancelled = await repo.cancelLoan('loan-nafisa');
    expect(cancelled.status).toBe('cancelled');
  });

  it('recordPayment against a bill with a loan line advances the tenant loan', async () => {
    const bills = await repo.calculatePapers(DEMO_MONTH);
    const loanBill = bills.find((bill) => bill.id === '2026-08-107')!;
    expect(loanBill.lines.some((line) => line.kind === 'loan')).toBe(true);

    await repo.recordPayment({ billId: loanBill.id, amount: 1000, paidAt: '2026-08-25', method: 'cash' });

    const loan = (await repo.listLoans()).find((item) => item.id === 'loan-nafisa')!;
    expect(loan.paidInstallments).toBe(3);
    expect(loan.status).toBe('active');
  });

  it('does not overflow the loan counter when a payment lands at the installment count', async () => {
    const bills = await repo.calculatePapers(DEMO_MONTH);
    const loanBill = bills.find((bill) => bill.id === '2026-08-107')!;

    // 2 → 5, completing the loan before the payment is recorded.
    await repo.payLoanInstallment('loan-nafisa');
    await repo.payLoanInstallment('loan-nafisa');
    await repo.payLoanInstallment('loan-nafisa');
    const completed = (await repo.listLoans()).find((item) => item.id === 'loan-nafisa')!;
    expect(completed.paidInstallments).toBe(completed.installmentCount);
    expect(completed.status).toBe('completed');

    await repo.recordPayment({ billId: loanBill.id, amount: 1000, paidAt: '2026-08-26', method: 'cash' });

    const after = (await repo.listLoans()).find((item) => item.id === 'loan-nafisa')!;
    expect(after.paidInstallments).toBe(after.installmentCount);
  });

  it('completes the loan when payments carry the counter to the installment count', async () => {
    const bills = await repo.calculatePapers(DEMO_MONTH);
    const loanBill = bills.find((bill) => bill.id === '2026-08-107')!;

    await repo.recordPayment({ billId: loanBill.id, amount: 1000, paidAt: '2026-08-25', method: 'cash' });
    await repo.recordPayment({ billId: loanBill.id, amount: 1000, paidAt: '2026-08-26', method: 'cash' });
    let loan = (await repo.listLoans()).find((item) => item.id === 'loan-nafisa')!;
    expect(loan.paidInstallments).toBe(4);
    expect(loan.status).toBe('active');

    await repo.recordPayment({ billId: loanBill.id, amount: 1000, paidAt: '2026-08-27', method: 'cash' });
    loan = (await repo.listLoans()).find((item) => item.id === 'loan-nafisa')!;
    expect(loan.paidInstallments).toBe(5);
    expect(loan.status).toBe('completed');
  });

  it('does not use Math.random for demo ids', async () => {
    const first = await repo.calculatePapers(DEMO_MONTH);
    await repo.seedDemo();
    const second = await repo.calculatePapers(DEMO_MONTH);
    expect(second.map((bill) => bill.id)).toEqual(first.map((bill) => bill.id));
    expect(second.map((bill) => bill.paperRef)).toEqual(first.map((bill) => bill.paperRef));
  });
});

describe('bill cycle acceptance — fresh repository', () => {
  const addRoomsAndTenants = async (
    repo: RentFlowRepository,
    rooms: { number: string; rent: number }[],
  ): Promise<string[]> => {
    const ids: string[] = [];
    for (const room of rooms) {
      const created = await repo.addRoom(room);
      await repo.addTenant({
        name: `ভাড়াটে ${room.number}`,
        phone: `017100000${room.number}`,
        roomId: created.id,
        moveInDate: '2025-01-01',
      });
      ids.push(created.id);
    }
    return ids;
  };

  it('T1 — entering a past month builds papers, then the active month advances', async () => {
    const repo = createMemoryRepository({ seed: false });
    const [room101, room102] = await addRoomsAndTenants(repo, [
      { number: '101', rent: 8000 },
      { number: '102', rent: 9000 },
    ]);

    // Nothing entered yet → the draft month is the current calendar month.
    const current = currentMonth();
    expect(await repo.getActiveMonth()).toBe(current);
    expect(await repo.getLatestBilledMonth()).toBeNull();

    await repo.saveMeterEntry('2026-05', {
      month: '2026-05',
      rooms: [
        { roomId: room101, roomNumber: '101', previous: 100, current: 160 },
        { roomId: room102, roomNumber: '102', previous: 200, current: 230 },
      ],
      water: { previous: 900, current: 960 },
    });
    // A saved meter entry with no papers yet is the unfinished draft.
    expect(await repo.getActiveMonth()).toBe('2026-05');

    const papers = await repo.calculatePapers('2026-05');
    expect(papers.map((bill) => bill.id)).toEqual(['2026-05-101', '2026-05-102']);
    // Water: 60 building units ÷ (2 occupied that month + 1) = 20 units each.
    expect(waterShareUnits(60, 2)).toBe(20);
    for (const bill of papers) {
      expect(bill.lines.find((line) => line.kind === 'water')).toMatchObject({
        amount: 20 * 7.5,
        detail: '20 unit × 7.5',
      });
    }
    expect(await repo.getLatestBilledMonth()).toBe('2026-05');
    expect(await repo.listDataMonths()).toEqual(['2026-05']);

    // May is finished → the draft advances to June (today is 2026-09, so the
    // current-calendar-month cap does not bite).
    const advanced = '2026-06' > current ? current : '2026-06';
    expect(await repo.getActiveMonth()).toBe(advanced);
  });

  it('T1 — calculatePapers stays idempotent on a fresh repository', async () => {
    const repo = createMemoryRepository({ seed: false });
    const [room101] = await addRoomsAndTenants(repo, [{ number: '101', rent: 8000 }]);
    await repo.saveMeterEntry('2026-05', {
      month: '2026-05',
      rooms: [{ roomId: room101, roomNumber: '101', previous: 100, current: 160 }],
      water: { previous: 900, current: 960 },
    });

    const first = await repo.calculatePapers('2026-05');
    const second = await repo.calculatePapers('2026-05');
    expect(second.map((bill) => bill.id)).toEqual(first.map((bill) => bill.id));
    expect(second.map((bill) => bill.total)).toEqual(first.map((bill) => bill.total));
    expect((await repo.listBills('2026-05')).length).toBe(1);
  });

  it('T2 — a month with no saved rows opens from the last known readings', async () => {
    const repo = createMemoryRepository({ seed: false });
    const [room101, room102] = await addRoomsAndTenants(repo, [
      { number: '101', rent: 8000 },
      { number: '102', rent: 9000 },
    ]);

    await repo.saveMeterEntry('2026-05', {
      month: '2026-05',
      rooms: [
        { roomId: room101, roomNumber: '101', previous: 100, current: 160 },
        { roomId: room102, roomNumber: '102', previous: 200, current: 230 },
      ],
      water: { previous: 900, current: 960 },
    });
    // June records only room 101 — room 102's meter chain has a gap.
    await repo.saveMeterEntry('2026-06', {
      month: '2026-06',
      rooms: [{ roomId: room101, roomNumber: '101', previous: 160, current: 200 }],
      water: { previous: 960, current: 1020 },
    });

    const known = await repo.getLastKnownReadings('2026-07');
    expect(known.rooms.get(room101)).toBe(200); // June's current — the latest
    expect(known.rooms.get(room102)).toBe(230); // May's current survives the gap
    expect(known.water).toBe(1020);
    expect(known.rooms.size).toBe(2);

    // No month strictly earlier than May → empty history maps to 0.
    const before = await repo.getLastKnownReadings('2026-05');
    expect(before.rooms.size).toBe(0);
    expect(before.water).toBe(0);

    // Screen 03 pre-fills July from these readings; the papers consume them.
    await repo.saveMeterEntry('2026-07', {
      month: '2026-07',
      rooms: [
        { roomId: room101, roomNumber: '101', previous: known.rooms.get(room101) ?? 0, current: 260 },
        { roomId: room102, roomNumber: '102', previous: known.rooms.get(room102) ?? 0, current: 290 },
      ],
      water: { previous: known.water, current: known.water + 60 },
    });
    const papers = await repo.calculatePapers('2026-07');
    // 260 − 200 = 60 and 290 − 230 = 60 units, both at ৳7.5.
    for (const bill of papers) {
      expect(bill.lines.find((line) => line.kind === 'electricity')?.detail).toBe('60 unit × 7.5');
    }
  });

  it('T3 — a corrected previous reading is what the bill consumes', async () => {
    const repo = createMemoryRepository({ seed: false });
    const [room101] = await addRoomsAndTenants(repo, [{ number: '101', rent: 9000 }]);

    // May closes at 4332 — that is the reading the chain remembers.
    await repo.saveMeterEntry('2026-05', {
      month: '2026-05',
      rooms: [{ roomId: room101, roomNumber: '101', previous: 4200, current: 4332 }],
      water: { previous: 0, current: 0 },
    });
    await repo.calculatePapers('2026-05'); // shifts previous ← current

    const known = await repo.getLastKnownReadings('2026-06');
    expect(known.rooms.get(room101)).toBe(4332);

    // The owner corrects June's previous to the move-in reading 4345 (gap).
    await repo.saveMeterEntry('2026-06', {
      month: '2026-06',
      rooms: [{ roomId: room101, roomNumber: '101', previous: 4345, current: 4379 }],
      water: { previous: 0, current: 0 },
    });
    const bills = await repo.calculatePapers('2026-06');
    const electricity = bills[0].lines.find((line) => line.kind === 'electricity');
    // 4379 − 4345 = 34 units (not 4379 − 4332 = 47) → 34 × ৳7.5 = ৳255.
    expect(electricity).toMatchObject({ amount: 255, detail: '34 unit × 7.5' });
  });

  it('T5 — opening arrears carry into the next month without double counting', async () => {
    const repo = createMemoryRepository({ seed: false });
    // ৳1 per unit keeps the client-ledger arithmetic hand-checkable.
    await repo.updateProperty({ electricityRate: 1 });
    const [room101] = await addRoomsAndTenants(repo, [{ number: '101', rent: 4000 }]);

    const meter = (month: MonthKey, previous: number, current: number): MeterEntry => ({
      month,
      rooms: [{ roomId: room101, roomNumber: '101', previous, current }],
      water: { previous: 0, current: 0 },
    });

    // M: 4000 rent + 483 units + 200 waste = 4683.
    await repo.saveMeterEntry('2026-05', meter('2026-05', 1000, 1483));
    await repo.calculatePapers('2026-05');
    // The owner seeds pre-history debt: an OPENING 'আগের বাকি' line.
    const may = await repo.adjustBill('2026-05', room101, { label: 'আগের বাকি', amount: 17276 }, 'prev_due');
    expect(may.lines.at(-1)).toMatchObject({ kind: 'prev_due', amount: 17276, opening: true });
    expect(may.total).toBe(4683 + 17276); // 21959

    // Unpaid → the whole 21959 carries, not just the month's 4683.
    expect((await repo.getPrevDueByRoom('2026-06')).get(room101)).toBe(21959);

    // M+1: 4000 rent + 430 units + 200 waste = 4630, restating the 21959.
    await repo.saveMeterEntry('2026-06', meter('2026-06', 1483, 1913));
    const june = (await repo.calculatePapers('2026-06')).find((bill) => bill.id === '2026-06-101')!;
    const restated = june.lines.find((line) => line.kind === 'prev_due')!;
    expect(restated.amount).toBe(21959);
    expect(restated.opening).toBeUndefined(); // transferred, not an opening line
    expect(june.total).toBe(21959 + 4630); // 26589

    await repo.recordPayment({ billId: june.id, amount: 10000, paidAt: '2026-06-20' });

    // Σ billed − Σ paid − transferred(non-opening) = 21959 + 4630 − 10000 = 16589.
    expect((await repo.getPrevDueByRoom('2026-07')).get(room101)).toBe(16589);
  });

  it('T6 — a four-month chain (walkthrough parity)', async () => {
    const repo = createMemoryRepository({ seed: false });
    await repo.updateProperty({ electricityRate: 9, wasteFee: 80 });

    const room101 = await repo.addRoom({ number: '101', rent: 9000 });
    const room102 = await repo.addRoom({ number: '102', rent: 2800 });
    const room103 = await repo.addRoom({ number: '103', rent: 7000 });
    const room104 = await repo.addRoom({ number: '104', rent: 6000 }); // always vacant
    const [r101, r102, r103, r104] = [room101.id, room102.id, room103.id, room104.id];

    // One continuous tenancy (101) · a mid-June move-in (102) · 103 is vacated
    // at the end of May and re-let on 1 July. 104 never gets a tenant.
    await repo.addTenant({ name: 'চলমান ভাড়াটে', phone: '01710000001', roomId: r101, moveInDate: '2025-01-01' });
    await repo.addTenant({ name: 'জুনে এসেছে', phone: '01710000002', roomId: r102, moveInDate: '2026-06-16' });
    const mayTenant = await repo.addTenant({
      name: 'মে পর্যন্ত',
      phone: '01710000003',
      roomId: r103,
      moveInDate: '2025-01-01',
    });

    // May: 101 (continuous) and 103 (vacated at month end).
    await repo.saveMeterEntry('2026-05', {
      month: '2026-05',
      rooms: [
        { roomId: r101, roomNumber: '101', previous: 100, current: 200 },
        { roomId: r103, roomNumber: '103', previous: 500, current: 530 },
      ],
      water: { previous: 1000, current: 1060 },
    });
    const may = await repo.calculatePapers('2026-05');
    expect(may.map((bill) => bill.roomId)).toEqual([r101, r103]);

    // Opening arrears on 101, seeded by the owner (pre-history debt).
    const may101 = await repo.adjustBill('2026-05', r101, { label: 'আগের বাকি', amount: 17276 }, 'prev_due');
    expect(may101.lines.find((line) => line.kind === 'prev_due')).toMatchObject({
      amount: 17276,
      opening: true,
    });

    // 103 is vacated at the end of May (its May paper is settled) and re-let 1 July.
    const may103 = may.find((bill) => bill.roomId === r103)!;
    await repo.recordPayment({ billId: may103.id, amount: may103.total, paidAt: '2026-05-25' });
    await repo.moveOut(mayTenant.id, { date: '2026-05-31', resolution: 'hold' });
    const julyTenant = await repo.addTenant({
      name: 'জুলাই থেকে',
      phone: '01710000099',
      roomId: r103,
      moveInDate: '2026-07-01',
    });

    // June: rates rise to ৳10; 102 takes a mid-June move-in; 103 has no meter
    // row at all (the untracked gap).
    await repo.updateProperty({ electricityRate: 10 });
    await repo.saveMeterEntry('2026-06', {
      month: '2026-06',
      rooms: [
        { roomId: r101, roomNumber: '101', previous: 200, current: 260 },
        { roomId: r102, roomNumber: '102', previous: 300, current: 350 },
      ],
      water: { previous: 1060, current: 1120 },
    });
    const june = await repo.calculatePapers('2026-06');
    expect(june.map((bill) => bill.roomId)).toEqual([r101, r102]);
    const june102 = june.find((bill) => bill.roomId === r102)!;
    // ৳2,800 × 15/30 (16 June → 30 June) = ৳1,400.
    expect(june102.lines[0]).toMatchObject({ kind: 'rent', amount: 1400, detail: '15/30 day' });

    // July: 103 re-let; its previous is the move-in reading 4345.
    await repo.saveMeterEntry('2026-07', {
      month: '2026-07',
      rooms: [
        { roomId: r101, roomNumber: '101', previous: 260, current: 300 },
        { roomId: r102, roomNumber: '102', previous: 350, current: 400 },
        { roomId: r103, roomNumber: '103', previous: 4345, current: 4400 },
      ],
      water: { previous: 1120, current: 1180 },
    });
    const july = await repo.calculatePapers('2026-07');
    expect(july.map((bill) => bill.roomId)).toEqual([r101, r102, r103]);
    const july103 = july.find((bill) => bill.roomId === r103)!;
    expect(july103.tenantId).toBe(julyTenant.id);
    // 4400 − 4345 = 55 units, at ৳10.
    expect(july103.lines.find((line) => line.kind === 'electricity')).toMatchObject({
      amount: 550,
      detail: '55 unit × 10',
    });

    await repo.saveMeterEntry('2026-08', {
      month: '2026-08',
      rooms: [
        { roomId: r101, roomNumber: '101', previous: 300, current: 340 },
        { roomId: r102, roomNumber: '102', previous: 400, current: 440 },
        { roomId: r103, roomNumber: '103', previous: 4400, current: 4440 },
      ],
      water: { previous: 1180, current: 1240 },
    });
    const august = await repo.calculatePapers('2026-08');
    expect(august.map((bill) => bill.roomId)).toEqual([r101, r102, r103]);

    // Structural facts: one paper per room per month, unique refs, and the
    // always-vacant 104 never appears.
    for (const monthBills of [may, june, july, august]) {
      expect(monthBills.every((bill) => bill.roomId !== r104)).toBe(true);
      expect(new Set(monthBills.map((bill) => bill.roomId)).size).toBe(monthBills.length);
      expect(new Set(monthBills.map((bill) => bill.paperRef)).size).toBe(monthBills.length);
    }
    expect([may, june, july, august].map((bills) => bills.length)).toEqual([2, 2, 3, 3]);

    // The water divisor follows each month's own occupancy (2 rooms in May/June
    // → 60 ÷ 3 = 20 units; 3 rooms in July/August → 60 ÷ 4 = 15 units), never
    // today's room status (which would be 15 units for every month).
    const waterDetail = (bills: Bill[], roomId: string): string | undefined =>
      bills.find((bill) => bill.roomId === roomId)?.lines.find((line) => line.kind === 'water')?.detail;
    expect(waterShareUnits(60, 2)).toBe(20);
    expect(waterShareUnits(60, 3)).toBe(15);
    expect(waterDetail(may, r101)).toBe('20 unit × 9');
    expect(waterDetail(june, r101)).toBe('20 unit × 10');
    expect(waterDetail(july, r101)).toBe('15 unit × 10');
    expect(waterDetail(august, r101)).toBe('15 unit × 10');

    // Arrears chain on 101: nothing paid, so each month's carry is exactly the
    // previous month's bill total — the opening 17276 is never subtracted.
    const carryJune = (await repo.getPrevDueByRoom('2026-06')).get(r101);
    const june101 = june.find((bill) => bill.roomId === r101)!;
    expect(carryJune).toBe(may101.total);
    expect(carryJune).toBeGreaterThan(17276);
    expect((await repo.getPrevDueByRoom('2026-07')).get(r101)).toBe(june101.total);
    const july101 = july.find((bill) => bill.roomId === r101)!;
    expect((await repo.getPrevDueByRoom('2026-08')).get(r101)).toBe(july101.total);
  });
});

describe('shiftReadings re-export guard', () => {
  it('is the engine implementation (previous ← current)', () => {
    const entry: MeterEntry = { month: '2026-08', rooms: [{ roomId: 'r', roomNumber: '1', previous: 10, current: 20 }], water: { previous: 1, current: 2 } };
    expect(shiftReadings(entry).rooms[0]).toMatchObject({ previous: 20, current: 20 });
  });
});
