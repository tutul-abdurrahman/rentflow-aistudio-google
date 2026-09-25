/**
 * RentFlow — Supabase repository (production).
 *
 * A RentFlowRepository over a Supabase client. The app passes the anon-key
 * client from src/lib/supabase.ts, which is the SAME instance the auth layer
 * signs in with, so every query carries the owner JWT and RLS enforces
 * `owner_id = auth.uid()` server-side. Signed out, queries return zero rows.
 *
 * Boundary rules:
 * - Postgres `numeric` arrives as a STRING — every money/quantity is Number()'d.
 * - snake_case rows are mapped to camelCase domain types here and nowhere else.
 * - bills.lines is jsonb <-> BillLine[].
 * - Meter rows are one row per room/utility; the building water meter uses
 *   room_id = null. The unique index is an EXPRESSION index, so PostgREST
 *   upsert onConflict cannot target it — we select-then-update-or-insert.
 * - Engine math is the source of truth. This file never hardcodes a demo number
 *   and never stores a derived snapshot.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Adjustment,
  Bill,
  BillId,
  BillLine,
  BillLineKind,
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
import type {
  AddFinanceInput,
  AddLoanInput,
  AddTenantInput,
  MoveOutInput,
  PaymentInput,
  RentFlowRepository,
} from './types';
import { BILL_LABELS, buildMonthBills, cycleTotal, dashboardSnapshot } from '../engine';

type Num = number | string | null | undefined;

const MAX_ORDER = Number.MAX_SAFE_INTEGER;

function num(value: Num): number {
  return value == null ? 0 : Number(value);
}

interface PropertyRow {
  id: string;
  owner_id: string;
  name: string;
  address: string;
  owner_name: string;
  owner_phone: string;
  electricity_rate: Num;
  waste_fee: Num;
  water_split_rule: string;
  mid_month_rule: string;
  created_at: string;
}

interface RoomRow {
  id: string;
  property_id: string;
  number: string;
  rent: Num;
  status: string;
  sort_order: Num;
}

interface TenantRow {
  id: string;
  property_id: string;
  name: string;
  phone: string;
  room_id: string | null;
  status: string;
  move_in_date: string | null;
  move_out_date: string | null;
  move_out_resolution: string | null;
  move_out_note: string | null;
  created_at: string;
}

interface MeterRow {
  id: string;
  month: string;
  room_id: string | null;
  utility: string;
  previous: Num;
  current: Num;
}

interface BillRow {
  id: string;
  property_id: string;
  month: string;
  room_id: string;
  tenant_id: string;
  lines: unknown;
  utilities_total: Num;
  total: Num;
  paper_ref: string;
  status: string;
  paid_amount: Num;
  created_at: string;
}

interface LedgerRow {
  id: string;
  property_id: string;
  bill_id: string;
  tenant_id: string;
  month: string;
  amount: Num;
  paid_at: string;
  method: string | null;
  note: string | null;
  created_at: string;
}

interface AdjustmentRow {
  id: string;
  property_id: string;
  month: string;
  room_id: string;
  label: string;
  amount: Num;
  note: string | null;
  created_at: string;
}

interface LoanRow {
  id: string;
  property_id: string;
  tenant_id: string;
  total_amount: Num;
  installment_count: Num;
  installment_amount: Num;
  paid_installments: Num;
  add_to_bill: boolean;
  status: string;
  note: string | null;
  created_at: string;
  cancelled_at: string | null;
}

interface FinanceRow {
  id: string;
  property_id: string;
  kind: string;
  category: string;
  amount: Num;
  date: string;
  note: string | null;
  created_at: string;
}

interface TenantEventRow {
  id: string;
  date: string;
  label: string;
  detail: string;
  amount: Num;
}

function mapLines(value: unknown): BillLine[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const line = (raw ?? {}) as Partial<BillLine>;
    const mapped: BillLine = {
      kind: line.kind as BillLineKind,
      label: String(line.label ?? ''),
      amount: Number(line.amount ?? 0),
    };
    if (line.detail !== undefined) mapped.detail = String(line.detail);
    return mapped;
  });
}

function mapProperty(row: PropertyRow): Property {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    ownerName: row.owner_name,
    ownerPhone: row.owner_phone,
    electricityRate: num(row.electricity_rate),
    wasteFee: num(row.waste_fee),
    waterSplitRule: 'occupied_plus_one',
    midMonthRule: row.mid_month_rule === 'full_month' ? 'full_month' : 'day_wise',
    createdAt: row.created_at,
  };
}

function mapRoom(row: RoomRow): Room {
  return {
    id: row.id,
    propertyId: row.property_id,
    number: row.number,
    rent: num(row.rent),
    status: row.status === 'occupied' ? 'occupied' : 'vacant',
    sortOrder: num(row.sort_order),
  };
}

function mapTenant(row: TenantRow): Tenant {
  const tenant: Tenant = {
    id: row.id,
    propertyId: row.property_id,
    name: row.name,
    phone: row.phone,
    roomId: row.room_id ?? null,
    status: row.status === 'archived' ? 'archived' : 'active',
    moveInDate: row.move_in_date ?? '',
    createdAt: row.created_at,
  };
  if (row.move_out_date) tenant.moveOutDate = row.move_out_date;
  if (row.move_out_resolution) {
    tenant.moveOutResolution = row.move_out_resolution as NonNullable<Tenant['moveOutResolution']>;
  }
  if (row.move_out_note) tenant.moveOutNote = row.move_out_note;
  return tenant;
}

function mapBill(row: BillRow): Bill {
  return {
    id: row.id,
    propertyId: row.property_id,
    month: row.month,
    roomId: row.room_id,
    tenantId: row.tenant_id,
    lines: mapLines(row.lines),
    utilitiesTotal: num(row.utilities_total),
    total: num(row.total),
    paperRef: row.paper_ref,
    status: row.status === 'paid' ? 'paid' : row.status === 'partial' ? 'partial' : 'due',
    paidAmount: num(row.paid_amount),
    createdAt: row.created_at,
  };
}

function mapLedger(row: LedgerRow): LedgerEntry {
  const entry: LedgerEntry = {
    id: row.id,
    propertyId: row.property_id,
    billId: row.bill_id,
    tenantId: row.tenant_id,
    month: row.month,
    amount: num(row.amount),
    paidAt: row.paid_at,
    createdAt: row.created_at,
  };
  if (row.method != null) entry.method = row.method;
  if (row.note != null) entry.note = row.note;
  return entry;
}

function mapAdjustment(row: AdjustmentRow): Adjustment {
  const adjustment: Adjustment = {
    id: row.id,
    propertyId: row.property_id,
    month: row.month,
    roomId: row.room_id,
    label: row.label,
    amount: num(row.amount),
    createdAt: row.created_at,
  };
  if (row.note != null) adjustment.note = row.note;
  return adjustment;
}

function mapLoan(row: LoanRow): Loan {
  const loan: Loan = {
    id: row.id,
    propertyId: row.property_id,
    tenantId: row.tenant_id,
    totalAmount: num(row.total_amount),
    installmentCount: num(row.installment_count),
    installmentAmount: num(row.installment_amount),
    paidInstallments: num(row.paid_installments),
    addToBill: Boolean(row.add_to_bill),
    status: row.status === 'cancelled' ? 'cancelled' : row.status === 'completed' ? 'completed' : 'active',
    createdAt: row.created_at,
  };
  if (row.note != null) loan.note = row.note;
  if (row.cancelled_at != null) loan.cancelledAt = row.cancelled_at;
  return loan;
}

function mapFinance(row: FinanceRow): FinanceEntry {
  const entry: FinanceEntry = {
    id: row.id,
    propertyId: row.property_id,
    kind: row.kind === 'income' ? 'income' : 'expense',
    category: row.category,
    amount: num(row.amount),
    date: row.date,
    createdAt: row.created_at,
  };
  if (row.note != null) entry.note = row.note;
  return entry;
}

function sortRooms(rooms: Room[]): Room[] {
  return rooms
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.number.localeCompare(b.number));
}

function billStatus(paid: number, total: number): 'due' | 'partial' | 'paid' {
  return paid >= total ? 'paid' : paid > 0 ? 'partial' : 'due';
}

export function createSupabaseRepository(client: SupabaseClient): RentFlowRepository {
  interface PropertyContext {
    id: string;
    ownerId: string;
  }

  let cachedContext: PropertyContext | null = null;

  async function maybePropertyContext(): Promise<PropertyContext | null> {
    if (cachedContext) return cachedContext;
    const { data, error } = await client
      .from('properties')
      .select('id, owner_id')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    cachedContext = { id: data.id as string, ownerId: data.owner_id as string };
    return cachedContext;
  }

  async function propertyContext(): Promise<PropertyContext> {
    const context = await maybePropertyContext();
    if (!context) throw new Error('PROPERTY_NOT_FOUND');
    return context;
  }

  async function authUserId(): Promise<string> {
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error('NOT_AUTHENTICATED');
    return data.user.id;
  }

  /**
   * Get the single property. DO NOT auto-create a row here: a brand-new
   * owner must go through onboarding, which persists via updateProperty
   * (that path inserts on first save). Until then a detached default is
   * returned so screens can render without touching the database.
   */
  async function fetchProperty(): Promise<Property> {
    const existing = await maybePropertyContext();
    if (existing) {
      const { data, error } = await client
        .from('properties')
        .select('*')
        .eq('id', existing.id)
        .maybeSingle();
      if (error) throw error;
      if (data) return mapProperty(data as PropertyRow);
    }
    return {
      id: '',
      createdAt: new Date().toISOString(),
      name: '',
      address: '',
      ownerName: '',
      ownerPhone: '',
      electricityRate: 7.5,
      wasteFee: 200,
      waterSplitRule: 'occupied_plus_one',
      midMonthRule: 'day_wise',
    };
  }

  async function fetchRooms(): Promise<Room[]> {
    const context = await propertyContext();
    const { data, error } = await client
      .from('rooms')
      .select('*')
      .eq('property_id', context.id);
    if (error) throw error;
    return sortRooms((data ?? []).map((row) => mapRoom(row as RoomRow)));
  }

  async function allPaperRefs(): Promise<string[]> {
    const context = await propertyContext();
    const { data, error } = await client
      .from('bills')
      .select('paper_ref')
      .eq('property_id', context.id);
    if (error) throw error;
    return (data ?? []).map((row) => row.paper_ref as string);
  }

  /** previous ← current for every meter row of the month (engine shiftReadings). */
  async function shiftMonthReadings(month: MonthKey): Promise<void> {
    const context = await propertyContext();
    const { data, error } = await client
      .from('meter_readings')
      .select('id, current')
      .eq('property_id', context.id)
      .eq('month', month);
    if (error) throw error;
    for (const row of (data ?? []) as Pick<MeterRow, 'id' | 'current'>[]) {
      const { error: updateError } = await client
        .from('meter_readings')
        .update({ previous: num(row.current) })
        .eq('id', row.id);
      if (updateError) throw updateError;
    }
  }

  return {
    // ---- property / settings ----
    async getProperty(): Promise<Property> {
      return fetchProperty();
    },

    async updateProperty(patch): Promise<Property> {
      const context = await maybePropertyContext();
      const values: Record<string, unknown> = {};
      if (patch.name !== undefined) values.name = patch.name;
      if (patch.address !== undefined) values.address = patch.address;
      if (patch.ownerName !== undefined) values.owner_name = patch.ownerName;
      if (patch.ownerPhone !== undefined) values.owner_phone = patch.ownerPhone;
      if (patch.electricityRate !== undefined) values.electricity_rate = patch.electricityRate;
      if (patch.wasteFee !== undefined) values.waste_fee = patch.wasteFee;
      if (patch.waterSplitRule !== undefined) values.water_split_rule = patch.waterSplitRule;
      if (patch.midMonthRule !== undefined) values.mid_month_rule = patch.midMonthRule;

      if (!context) {
        const ownerId = await authUserId();
        const { data, error } = await client
          .from('properties')
          .insert({ owner_id: ownerId, ...values })
          .select()
          .single();
        if (error) throw error;
        cachedContext = { id: (data as PropertyRow).id, ownerId };
        return mapProperty(data as PropertyRow);
      }

      const { data, error } = await client
        .from('properties')
        .update(values)
        .eq('id', context.id)
        .select()
        .single();
      if (error) throw error;
      return mapProperty(data as PropertyRow);
    },

    // ---- rooms ----
    async listRooms(): Promise<Room[]> {
      return fetchRooms();
    },

    async addRoom(input): Promise<Room> {
      const context = await propertyContext();
      const rooms = await fetchRooms();
      if (rooms.some((room) => room.number === input.number)) throw new Error('ROOM_EXISTS');
      const sortOrder = rooms.reduce((max, room) => Math.max(max, room.sortOrder), 0) + 1;
      const { data, error } = await client
        .from('rooms')
        .insert({
          property_id: context.id,
          owner_id: context.ownerId,
          number: input.number,
          rent: input.rent,
          status: 'vacant',
          sort_order: sortOrder,
        })
        .select()
        .single();
      if (error) {
        if ((error as { code?: string }).code === '23505') throw new Error('ROOM_EXISTS');
        throw error;
      }
      return mapRoom(data as RoomRow);
    },

    async updateRoom(id, patch): Promise<Room> {
      const values: Record<string, unknown> = {};
      if (patch.number !== undefined) values.number = patch.number;
      if (patch.rent !== undefined) values.rent = patch.rent;
      if (patch.status !== undefined) values.status = patch.status;
      if (patch.sortOrder !== undefined) values.sort_order = patch.sortOrder;
      const { data, error } = await client
        .from('rooms')
        .update(values)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('ROOM_NOT_FOUND');
      return mapRoom(data as RoomRow);
    },

    // ---- tenants ----
    async listTenants(status?): Promise<Tenant[]> {
      const context = await maybePropertyContext();
      if (!context) return [];
      let query = client.from('tenants').select('*').eq('property_id', context.id);
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? [])
        .map((row) => mapTenant(row as TenantRow))
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async getTenant(id): Promise<Tenant | null> {
      const { data, error } = await client
        .from('tenants')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? mapTenant(data as TenantRow) : null;
    },

    async addTenant(input: AddTenantInput): Promise<Tenant> {
      const context = await propertyContext();
      const rooms = await fetchRooms();
      const room = rooms.find((item) => item.id === input.roomId);
      if (!room) throw new Error('ROOM_NOT_FOUND');
      const tenants = await this.listTenants('active');
      if (tenants.some((tenant) => tenant.roomId === input.roomId)) {
        throw new Error('ROOM_OCCUPIED');
      }
      const { data, error } = await client
        .from('tenants')
        .insert({
          property_id: context.id,
          owner_id: context.ownerId,
          name: input.name,
          phone: input.phone,
          room_id: input.roomId,
          status: 'active',
          move_in_date: input.moveInDate,
        })
        .select()
        .single();
      if (error) throw error;
      const { error: roomError } = await client
        .from('rooms')
        .update({ status: 'occupied' })
        .eq('id', input.roomId);
      if (roomError) throw roomError;
      return mapTenant(data as TenantRow);
    },

    async updateTenant(id, patch): Promise<Tenant> {
      const values: Record<string, unknown> = {};
      if (patch.name !== undefined) values.name = patch.name;
      if (patch.phone !== undefined) values.phone = patch.phone;
      const { data, error } = await client
        .from('tenants')
        .update(values)
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('TENANT_NOT_FOUND');
      return mapTenant(data as TenantRow);
    },

    async shiftRoom(tenantId, newRoomId, effectiveDate): Promise<Tenant> {
      const context = await propertyContext();
      const tenant = await this.getTenant(tenantId);
      if (!tenant) throw new Error('TENANT_NOT_FOUND');
      if (tenant.status !== 'active') throw new Error('TENANT_ARCHIVED');
      const rooms = await fetchRooms();
      const newRoom = rooms.find((item) => item.id === newRoomId);
      if (!newRoom) throw new Error('ROOM_NOT_FOUND');
      const tenants = await this.listTenants('active');
      const holder = tenants.find((item) => item.roomId === newRoomId);
      if (holder && holder.id !== tenantId) throw new Error('ROOM_OCCUPIED');

      const fromRoomId = tenant.roomId;
      if (fromRoomId) {
        const { error } = await client.from('rooms').update({ status: 'vacant' }).eq('id', fromRoomId);
        if (error) throw error;
      }
      const { error: occupyError } = await client
        .from('rooms')
        .update({ status: 'occupied' })
        .eq('id', newRoomId);
      if (occupyError) throw occupyError;

      const { data, error } = await client
        .from('tenants')
        .update({ room_id: newRoomId })
        .eq('id', tenantId)
        .select()
        .single();
      if (error) throw error;

      const fromLabel = fromRoomId ? rooms.find((room) => room.id === fromRoomId)?.number ?? '' : '';
      const { error: eventError } = await client.from('tenant_events').insert({
        property_id: context.id,
        owner_id: context.ownerId,
        tenant_id: tenantId,
        date: effectiveDate,
        label: 'রুম বদল',
        detail: `রুম ${fromLabel} → রুম ${newRoom.number}`,
      });
      if (eventError) throw eventError;

      return mapTenant(data as TenantRow);
    },

    async moveOut(tenantId, input: MoveOutInput): Promise<Tenant> {
      const tenant = await this.getTenant(tenantId);
      if (!tenant) throw new Error('TENANT_NOT_FOUND');
      if (tenant.status !== 'active') throw new Error('TENANT_ARCHIVED');
      if (tenant.roomId) {
        const { error } = await client.from('rooms').update({ status: 'vacant' }).eq('id', tenant.roomId);
        if (error) throw error;
      }
      const { data, error } = await client
        .from('tenants')
        .update({
          room_id: null,
          status: 'archived',
          move_out_date: input.date,
          move_out_resolution: input.resolution,
          move_out_note: input.note ?? null,
        })
        .eq('id', tenantId)
        .select()
        .single();
      if (error) throw error;
      return mapTenant(data as TenantRow);
    },

    async deleteArchivedTenant(tenantId: TenantId): Promise<void> {
      const tenant = await this.getTenant(tenantId);
      if (!tenant) throw new Error('TENANT_NOT_FOUND');
      if (tenant.status !== 'archived') throw new Error('TENANT_ACTIVE');

      const [bills, ledger] = await Promise.all([
        client.from('bills').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
        client
          .from('ledger_entries')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),
      ]);
      if (bills.error) throw bills.error;
      if (ledger.error) throw ledger.error;
      if ((bills.count ?? 0) > 0 || (ledger.count ?? 0) > 0) {
        throw new Error('TENANT_HAS_HISTORY');
      }

      const { error } = await client.from('tenants').delete().eq('id', tenantId);
      if (error) {
        // Loans (and any other restricted FK) also protect financial history.
        if ((error as { code?: string }).code === '23503') throw new Error('TENANT_HAS_HISTORY');
        throw error;
      }
    },

    async getTenantHistory(tenantId): Promise<HistoryEvent[]> {
      const context = await maybePropertyContext();
      if (!context) return [];
      const tenant = await this.getTenant(tenantId);
      if (!tenant) return [];

      const [rooms, billsResult, ledgerResult, eventsResult] = await Promise.all([
        fetchRooms(),
        client.from('bills').select('*').eq('tenant_id', tenantId),
        client.from('ledger_entries').select('*').eq('tenant_id', tenantId),
        client.from('tenant_events').select('*').eq('tenant_id', tenantId),
      ]);
      if (billsResult.error) throw billsResult.error;
      if (ledgerResult.error) throw ledgerResult.error;
      if (eventsResult.error) throw eventsResult.error;

      const roomNumber = (id: RoomId | null): string =>
        id ? rooms.find((room) => room.id === id)?.number ?? '' : '';

      const events: HistoryEvent[] = [
        {
          id: `hist-movein-${tenant.id}`,
          date: tenant.moveInDate,
          label: 'রুম যোগদান',
          detail: tenant.roomId ? `রুম ${roomNumber(tenant.roomId)}` : 'ভাড়াটে যোগ হয়েছে',
        },
      ];

      for (const row of (billsResult.data ?? []) as BillRow[]) {
        const bill = mapBill(row);
        events.push({
          id: `hist-bill-${bill.id}`,
          date: bill.createdAt.slice(0, 10),
          label: 'মাসিক বিল',
          detail: `${bill.paperRef} · রুম ${roomNumber(bill.roomId)}`,
          amount: bill.total,
        });
      }
      for (const row of (ledgerResult.data ?? []) as LedgerRow[]) {
        const entry = mapLedger(row);
        events.push({
          id: `hist-pay-${entry.id}`,
          date: entry.paidAt,
          label: 'পেমেন্ট',
          detail: entry.method ?? '',
          amount: entry.amount,
        });
      }
      for (const row of (eventsResult.data ?? []) as TenantEventRow[]) {
        const event: HistoryEvent = {
          id: `hist-ev-${row.id}`,
          date: row.date,
          label: row.label,
          detail: row.detail ?? '',
        };
        if (row.amount != null) event.amount = num(row.amount);
        events.push(event);
      }
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
      const context = await propertyContext();
      const { data, error } = await client
        .from('meter_readings')
        .select('*')
        .eq('property_id', context.id)
        .eq('month', month);
      if (error) throw error;
      const rows = (data ?? []) as MeterRow[];
      if (rows.length === 0) return null;

      const [rooms, tenants] = await Promise.all([fetchRooms(), this.listTenants('active')]);
      const roomById = new Map(rooms.map((room) => [room.id, room]));
      const tenantByRoom = new Map(
        tenants.filter((tenant) => tenant.roomId).map((tenant) => [tenant.roomId as string, tenant.name]),
      );

      const electricity = rows
        .filter((row) => row.utility === 'electricity' && row.room_id)
        .map((row) => ({
          roomId: row.room_id as string,
          roomNumber: roomById.get(row.room_id as string)?.number ?? '',
          tenantName: tenantByRoom.get(row.room_id as string),
          previous: num(row.previous),
          current: num(row.current),
        }))
        .sort(
          (a, b) =>
            (roomById.get(a.roomId)?.sortOrder ?? MAX_ORDER) -
            (roomById.get(b.roomId)?.sortOrder ?? MAX_ORDER),
        );

      const waterRow = rows.find((row) => row.utility === 'water' && row.room_id === null);

      return {
        month,
        rooms: electricity,
        water: { previous: num(waterRow?.previous), current: num(waterRow?.current) },
      };
    },

    async saveMeterEntry(month: MonthKey, entry: MeterEntry): Promise<MeterEntry> {
      const context = await propertyContext();
      const recordedAt = new Date().toISOString();

      async function upsertRow(
        utility: 'electricity' | 'water',
        roomId: string | null,
        previous: number,
        current: number,
      ): Promise<void> {
        let lookup = client
          .from('meter_readings')
          .select('id')
          .eq('property_id', context.id)
          .eq('month', month)
          .eq('utility', utility);
        lookup = roomId === null ? lookup.is('room_id', null) : lookup.eq('room_id', roomId);
        const { data, error } = await lookup.maybeSingle();
        if (error) throw error;
        if (data) {
          const { error: updateError } = await client
            .from('meter_readings')
            .update({ previous, current, recorded_at: recordedAt })
            .eq('id', data.id);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await client.from('meter_readings').insert({
            property_id: context.id,
            owner_id: context.ownerId,
            month,
            room_id: roomId,
            utility,
            previous,
            current,
            recorded_at: recordedAt,
          });
          if (insertError) throw insertError;
        }
      }

      for (const room of entry.rooms) {
        await upsertRow('electricity', room.roomId, room.previous, room.current);
      }
      await upsertRow('water', null, entry.water.previous, entry.water.current);

      return {
        month,
        rooms: entry.rooms.map((room) => ({ ...room })),
        water: { ...entry.water },
      };
    },

    // ---- bills / monthly cycle ----
    async getActiveMonth(): Promise<MonthKey> {
      const context = await maybePropertyContext();
      if (context) {
        const { data, error } = await client
          .from('bills')
          .select('month')
          .eq('property_id', context.id)
          .order('month', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (data) return data.month as string;
      }
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    },

    async listBills(month: MonthKey): Promise<Bill[]> {
      const context = await maybePropertyContext();
      if (!context) return [];
      const { data, error } = await client
        .from('bills')
        .select('*')
        .eq('property_id', context.id)
        .eq('month', month);
      if (error) throw error;
      const rooms = await fetchRooms();
      const order = new Map(rooms.map((room) => [room.id, room.sortOrder]));
      return (data ?? [])
        .map((row) => mapBill(row as BillRow))
        .sort(
          (a, b) =>
            (order.get(a.roomId) ?? MAX_ORDER) - (order.get(b.roomId) ?? MAX_ORDER) ||
            a.roomId.localeCompare(b.roomId),
        );
    },

    async getBill(id: BillId): Promise<Bill | null> {
      const { data, error } = await client.from('bills').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? mapBill(data as BillRow) : null;
    },

    async calculatePapers(month: MonthKey): Promise<Bill[]> {
      const stored = await this.listBills(month);
      if (stored.length > 0) return stored;

      const meterEntry = await this.getMeterEntry(month);
      if (!meterEntry) throw new Error('NO_METER_ENTRY');

      const context = await propertyContext();
      const [property, rooms, tenants, adjustments, loans] = await Promise.all([
        this.getProperty(),
        fetchRooms(),
        this.listTenants('active'),
        this.listAdjustments(month),
        this.listLoans(),
      ]);

      const tenantByRoom = new Map<string, { id: string; name: string; moveInDate: string }>();
      for (const tenant of tenants) {
        if (tenant.roomId) {
          tenantByRoom.set(tenant.roomId, {
            id: tenant.id,
            name: tenant.name,
            moveInDate: tenant.moveInDate,
          });
        }
      }

      const adjustmentsByRoom = new Map<string, { label: string; amount: number }[]>();
      for (const adjustment of adjustments) {
        const list = adjustmentsByRoom.get(adjustment.roomId) ?? [];
        list.push({ label: adjustment.label, amount: adjustment.amount });
        adjustmentsByRoom.set(adjustment.roomId, list);
      }

      const loanInstallmentByRoom = new Map<string, number>();
      for (const loan of loans) {
        if (loan.status !== 'active' || !loan.addToBill) continue;
        if (loan.paidInstallments >= loan.installmentCount) continue;
        const tenant = tenants.find((item) => item.id === loan.tenantId);
        if (tenant?.roomId) loanInstallmentByRoom.set(tenant.roomId, loan.installmentAmount);
      }

      const prevDueByRoom = await this.getPrevDueByRoom(month);
      const existingRefs = await allPaperRefs();

      const built = buildMonthBills({
        month,
        property,
        rooms,
        tenantByRoom,
        meterEntry,
        adjustmentsByRoom,
        prevDueByRoom,
        loanInstallmentByRoom,
        existingRefs,
      });

      if (built.length > 0) {
        const rows = built.map((bill) => ({
          property_id: context.id,
          owner_id: context.ownerId,
          month: bill.month,
          room_id: bill.roomId,
          tenant_id: bill.tenantId,
          lines: bill.lines,
          utilities_total: bill.utilitiesTotal,
          total: bill.total,
          paper_ref: bill.paperRef,
          status: bill.status,
          paid_amount: bill.paidAmount,
          created_at: bill.createdAt,
        }));
        const { error } = await client.from('bills').insert(rows);
        if (error && (error as { code?: string }).code !== '23505') throw error;
      }

      // calculatePapers shifts readings: previous ← current for the whole month.
      await shiftMonthReadings(month);

      return this.listBills(month);
    },

    async adjustBill(month, roomId, adjustment): Promise<Bill> {
      const context = await propertyContext();
      const { data: row, error } = await client
        .from('bills')
        .select('*')
        .eq('property_id', context.id)
        .eq('month', month)
        .eq('room_id', roomId)
        .maybeSingle();
      if (error) throw error;
      if (!row) throw new Error('BILL_NOT_FOUND');

      const { error: adjustmentError } = await client.from('adjustments').insert({
        property_id: context.id,
        owner_id: context.ownerId,
        month,
        room_id: roomId,
        label: adjustment.label,
        amount: adjustment.amount,
        note: adjustment.note ?? null,
      });
      if (adjustmentError) throw adjustmentError;

      const bill = mapBill(row as BillRow);
      const lines = [
        ...bill.lines,
        {
          kind: 'adjustment' as const,
          label: BILL_LABELS.adjustment,
          amount: adjustment.amount,
          detail: adjustment.label,
        },
      ];
      const total = lines.reduce((sum, line) => sum + line.amount, 0);
      const { data: updated, error: updateError } = await client
        .from('bills')
        .update({ lines, total, status: billStatus(bill.paidAmount, total) })
        .eq('id', bill.id)
        .select()
        .single();
      if (updateError) throw updateError;
      return mapBill(updated as BillRow);
    },

    async getPrevDueByRoom(month: MonthKey): Promise<Map<RoomId, number>> {
      const context = await propertyContext();
      const rooms = await fetchRooms();
      const { data, error } = await client
        .from('bills')
        .select('id, room_id, total, lines')
        .eq('property_id', context.id)
        .lt('month', month);
      if (error) throw error;
      const priorBills = (data ?? []) as Pick<BillRow, 'id' | 'room_id' | 'total' | 'lines'>[];
      const billIds = priorBills.map((bill) => bill.id);

      const paidByBill = new Map<string, number>();
      if (billIds.length > 0) {
        const { data: ledgerRows, error: ledgerError } = await client
          .from('ledger_entries')
          .select('bill_id, amount')
          .in('bill_id', billIds);
        if (ledgerError) throw ledgerError;
        for (const entry of (ledgerRows ?? []) as Pick<LedgerRow, 'bill_id' | 'amount'>[]) {
          paidByBill.set(entry.bill_id, (paidByBill.get(entry.bill_id) ?? 0) + num(entry.amount));
        }
      }

      const map = new Map<RoomId, number>();
      for (const room of rooms) {
        const roomBills = priorBills.filter((bill) => bill.room_id === room.id);
        const billed = roomBills.reduce((sum, bill) => sum + num(bill.total), 0);
        const transferred = roomBills.reduce(
          (sum, bill) =>
            sum +
            mapLines(bill.lines)
              .filter((line) => line.kind === 'prev_due')
              .reduce((inner, line) => inner + line.amount, 0),
          0,
        );
        const paid = roomBills.reduce((sum, bill) => sum + (paidByBill.get(bill.id) ?? 0), 0);
        const carried = billed - paid - transferred;
        if (carried !== 0) map.set(room.id, carried);
      }
      return map;
    },

    // ---- ledger / collection ----
    async listLedger(month?): Promise<LedgerEntry[]> {
      const context = await maybePropertyContext();
      if (!context) return [];
      let query = client.from('ledger_entries').select('*').eq('property_id', context.id);
      if (month) query = query.eq('month', month);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? [])
        .map((row) => mapLedger(row as LedgerRow))
        .sort((a, b) => a.paidAt.localeCompare(b.paidAt) || a.id.localeCompare(b.id));
    },

    async recordPayment(input: PaymentInput): Promise<LedgerEntry> {
      const context = await propertyContext();
      const { data: row, error } = await client
        .from('bills')
        .select('*')
        .eq('id', input.billId)
        .maybeSingle();
      if (error) throw error;
      if (!row) throw new Error('BILL_NOT_FOUND');
      const bill = mapBill(row as BillRow);

      const { data: inserted, error: insertError } = await client
        .from('ledger_entries')
        .insert({
          property_id: context.id,
          owner_id: context.ownerId,
          bill_id: bill.id,
          tenant_id: bill.tenantId,
          month: bill.month,
          amount: input.amount,
          paid_at: input.paidAt,
          method: input.method ?? null,
          note: input.note ?? null,
        })
        .select()
        .single();
      if (insertError) throw insertError;

      // paid_amount is Σ ledger for the bill (never an incremental guess).
      const { data: ledgerRows, error: sumError } = await client
        .from('ledger_entries')
        .select('amount')
        .eq('bill_id', bill.id);
      if (sumError) throw sumError;
      const paid = (ledgerRows ?? []).reduce(
        (sum, entry) => sum + num((entry as Pick<LedgerRow, 'amount'>).amount),
        0,
      );
      const { error: updateError } = await client
        .from('bills')
        .update({ paid_amount: paid, status: billStatus(paid, bill.total) })
        .eq('id', bill.id);
      if (updateError) throw updateError;

      // A loan folded into this bill advances the paying tenant's active loan.
      if (bill.lines.some((line) => line.kind === 'loan')) {
        const { data: loanRow, error: loanError } = await client
          .from('loans')
          .select('*')
          .eq('tenant_id', bill.tenantId)
          .eq('status', 'active')
          .eq('add_to_bill', true)
          .limit(1)
          .maybeSingle();
        if (loanError) throw loanError;
        if (loanRow) {
          const loan = mapLoan(loanRow as LoanRow);
          const next = Math.min(loan.paidInstallments + 1, loan.installmentCount);
          const { error: loanUpdateError } = await client
            .from('loans')
            .update({
              paid_installments: next,
              status: next >= loan.installmentCount ? 'completed' : 'active',
            })
            .eq('id', loan.id);
          if (loanUpdateError) throw loanUpdateError;
        }
      }

      return mapLedger(inserted as LedgerRow);
    },

    // ---- adjustments history ----
    async listAdjustments(month?): Promise<Adjustment[]> {
      const context = await maybePropertyContext();
      if (!context) return [];
      let query = client.from('adjustments').select('*').eq('property_id', context.id);
      if (month) query = query.eq('month', month);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? [])
        .map((row) => mapAdjustment(row as AdjustmentRow))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    },

    // ---- loans ----
    async listLoans(): Promise<Loan[]> {
      const context = await maybePropertyContext();
      if (!context) return [];
      const { data, error } = await client
        .from('loans')
        .select('*')
        .eq('property_id', context.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => mapLoan(row as LoanRow));
    },

    async getLoan(id: LoanId): Promise<Loan | null> {
      const { data, error } = await client.from('loans').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? mapLoan(data as LoanRow) : null;
    },

    async addLoan(input: AddLoanInput): Promise<Loan> {
      const context = await propertyContext();
      const tenant = await this.getTenant(input.tenantId);
      if (!tenant) throw new Error('TENANT_NOT_FOUND');
      const { data, error } = await client
        .from('loans')
        .insert({
          property_id: context.id,
          owner_id: context.ownerId,
          tenant_id: input.tenantId,
          total_amount: input.totalAmount,
          installment_count: input.installmentCount,
          installment_amount: input.installmentAmount,
          paid_installments: 0,
          add_to_bill: input.addToBill,
          status: 'active',
          note: input.note ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return mapLoan(data as LoanRow);
    },

    async cancelLoan(id: LoanId): Promise<Loan> {
      const { data, error } = await client
        .from('loans')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('LOAN_NOT_FOUND');
      return mapLoan(data as LoanRow);
    },

    async payLoanInstallment(id: LoanId): Promise<Loan> {
      const loan = await this.getLoan(id);
      if (!loan) throw new Error('LOAN_NOT_FOUND');
      if (loan.status === 'cancelled') throw new Error('LOAN_CANCELLED');
      const next = Math.min(loan.paidInstallments + 1, loan.installmentCount);
      const { data, error } = await client
        .from('loans')
        .update({
          paid_installments: next,
          status: next >= loan.installmentCount ? 'completed' : 'active',
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return mapLoan(data as LoanRow);
    },

    // ---- finance ----
    async listFinance(month?): Promise<FinanceEntry[]> {
      const context = await maybePropertyContext();
      if (!context) return [];
      const { data, error } = await client
        .from('finance_entries')
        .select('*')
        .eq('property_id', context.id);
      if (error) throw error;
      return (data ?? [])
        .map((row) => mapFinance(row as FinanceRow))
        .filter((entry) => (month ? entry.date.slice(0, 7) === month : true))
        .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    },

    async addFinanceEntry(input: AddFinanceInput): Promise<FinanceEntry> {
      const context = await propertyContext();
      const { data, error } = await client
        .from('finance_entries')
        .insert({
          property_id: context.id,
          owner_id: context.ownerId,
          kind: input.kind,
          category: input.category,
          amount: input.amount,
          date: input.date,
          note: input.note ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return mapFinance(data as FinanceRow);
    },

    async deleteFinanceEntry(id): Promise<void> {
      const { error } = await client.from('finance_entries').delete().eq('id', id);
      if (error) throw error;
    },

    // ---- derived views ----
    async getDashboard(month: MonthKey): Promise<DashboardSnapshot> {
      const context = await propertyContext();
      const [billsResult, ledgerResult, financeResult, rooms, tenants] = await Promise.all([
        client.from('bills').select('*').eq('property_id', context.id).eq('month', month),
        client.from('ledger_entries').select('*').eq('property_id', context.id).eq('month', month),
        client.from('finance_entries').select('*').eq('property_id', context.id),
        fetchRooms(),
        this.listTenants(),
      ]);
      if (billsResult.error) throw billsResult.error;
      if (ledgerResult.error) throw ledgerResult.error;
      if (financeResult.error) throw financeResult.error;

      return dashboardSnapshot({
        bills: (billsResult.data ?? []).map((row) => mapBill(row as BillRow)),
        ledger: (ledgerResult.data ?? []).map((row) => mapLedger(row as LedgerRow)),
        expenses: (financeResult.data ?? []).map((row) => mapFinance(row as FinanceRow)),
        rooms,
        month,
        tenants: tenants.map((tenant) => ({ id: tenant.id, name: tenant.name })),
      });
    },

    async getMonthlyLedger(month: MonthKey): Promise<MonthlyLedgerRow[]> {
      const [bills, rooms, tenants] = await Promise.all([
        this.listBills(month),
        fetchRooms(),
        this.listTenants(),
      ]);
      const roomById = new Map(rooms.map((room) => [room.id, room]));
      const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));
      return bills.map((bill) => {
        const sumKind = (kind: string): number =>
          bill.lines
            .filter((line) => line.kind === kind)
            .reduce((sum, line) => sum + line.amount, 0);
        return {
          roomNumber: roomById.get(bill.roomId)?.number ?? '',
          tenantName: tenantById.get(bill.tenantId)?.name ?? '',
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
      });
    },

    async getCashflow(months: MonthKey[]): Promise<CashflowRow[]> {
      const context = await propertyContext();
      const rows: CashflowRow[] = [];
      for (const month of months) {
        const [billsResult, ledgerResult, financeResult] = await Promise.all([
          client.from('bills').select('*').eq('property_id', context.id).eq('month', month),
          client.from('ledger_entries').select('*').eq('property_id', context.id).eq('month', month),
          client.from('finance_entries').select('*').eq('property_id', context.id),
        ]);
        if (billsResult.error) throw billsResult.error;
        if (ledgerResult.error) throw ledgerResult.error;
        if (financeResult.error) throw financeResult.error;

        const billed = cycleTotal((billsResult.data ?? []).map((row) => mapBill(row as BillRow)));
        const collected = ((ledgerResult.data ?? []) as LedgerRow[]).reduce(
          (sum, row) => sum + num(row.amount),
          0,
        );
        const expenses = ((financeResult.data ?? []) as FinanceRow[])
          .filter((row) => row.kind === 'expense' && row.date.slice(0, 7) === month)
          .reduce((sum, row) => sum + num(row.amount), 0);
        rows.push({ month, billed, collected, expenses, net: billed - expenses });
      }
      return rows;
    },

    // ---- demo ----
    async seedDemo(): Promise<void> {
      throw new Error('USE_SEED_SCRIPT');
    },
  };
}
