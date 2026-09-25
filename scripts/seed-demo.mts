/**
 * RentFlow — seed the LIVE Supabase project with the §9 canonical demo data.
 *
 * Usage: npx tsx --env-file=.env scripts/seed-demo.mts
 * Server-side only: uses SUPABASE_SERVICE_ROLE_KEY (never shipped to the app).
 * Idempotent: refuses to run when the owner already has a property — it never
 * duplicates or rewrites a live dataset.
 *
 * Every value comes from buildDemoState() (engine-computed) or the documented
 * §9 fixtures. Nothing here hardcodes a derived money figure.
 */

import { createClient } from '@supabase/supabase-js';
import { buildDemoState, DEMO_MONTH } from '../src/lib/seed/demo.ts';
import type { Room, Tenant } from '../src/lib/types.ts';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerEmail = process.env.OWNER_EMAIL;

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}
if (!ownerEmail) {
  console.error('Missing OWNER_EMAIL in .env');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---- owner ----
const { data: userList, error: userError } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 200,
});
if (userError) throw userError;
const owner = userList.users.find((user) => user.email?.toLowerCase() === ownerEmail.toLowerCase());
if (!owner) {
  console.error(`owner account not found for ${ownerEmail} — run scripts/create-owner.mjs first`);
  process.exit(1);
}

// ---- idempotent guard ----
const { data: existing, error: guardError } = await admin
  .from('properties')
  .select('id')
  .eq('owner_id', owner.id)
  .limit(1);
if (guardError) throw guardError;
if (existing && existing.length > 0) {
  console.log(`seed skipped: property already exists for ${ownerEmail} (${existing[0].id})`);
  process.exit(0);
}

const state = buildDemoState();

// ---- property ----
const { data: propertyRow, error: propertyError } = await admin
  .from('properties')
  .insert({
    owner_id: owner.id,
    name: state.property.name,
    address: state.property.address,
    owner_name: state.property.ownerName,
    owner_phone: state.property.ownerPhone,
    electricity_rate: state.property.electricityRate,
    waste_fee: state.property.wasteFee,
    water_split_rule: state.property.waterSplitRule,
    mid_month_rule: state.property.midMonthRule,
    created_at: state.property.createdAt,
  })
  .select()
  .single();
if (propertyError) throw propertyError;
const propertyId = propertyRow.id as string;

// ---- rooms (102–107) ----
const { error: roomError } = await admin.from('rooms').insert(
  state.rooms.map((room: Room) => ({
    property_id: propertyId,
    owner_id: owner.id,
    number: room.number,
    rent: room.rent,
    status: room.status,
    sort_order: room.sortOrder,
  })),
);
if (roomError) throw roomError;
const { data: roomRows, error: roomReadError } = await admin
  .from('rooms')
  .select('id, number')
  .eq('property_id', propertyId);
if (roomReadError) throw roomReadError;
const roomIdByNumber = new Map<string, string>(
  (roomRows ?? []).map((row) => [row.number as string, row.id as string]),
);
const demoRoomById = new Map(state.rooms.map((room: Room) => [room.id, room]));
function roomDbId(demoRoomId: string): string {
  const number = demoRoomById.get(demoRoomId)?.number;
  const id = number ? roomIdByNumber.get(number) : undefined;
  if (!id) throw new Error(`room mapping missing for ${demoRoomId}`);
  return id;
}

// ---- tenants (incl. archived শামীম) ----
const { error: tenantError } = await admin.from('tenants').insert(
  state.tenants.map((tenant: Tenant) => ({
    property_id: propertyId,
    owner_id: owner.id,
    name: tenant.name,
    phone: tenant.phone,
    room_id: tenant.roomId ? roomDbId(tenant.roomId) : null,
    status: tenant.status,
    move_in_date: tenant.moveInDate || null,
    move_out_date: tenant.moveOutDate ?? null,
    move_out_resolution: tenant.moveOutResolution ?? null,
    move_out_note: tenant.moveOutNote ?? null,
    created_at: tenant.createdAt,
  })),
);
if (tenantError) throw tenantError;
const { data: tenantRows, error: tenantReadError } = await admin
  .from('tenants')
  .select('id, name')
  .eq('property_id', propertyId);
if (tenantReadError) throw tenantReadError;
const tenantIdByName = new Map<string, string>(
  (tenantRows ?? []).map((row) => [row.name as string, row.id as string]),
);
const demoTenantById = new Map(state.tenants.map((tenant: Tenant) => [tenant.id, tenant]));
function tenantDbId(demoTenantId: string): string {
  const name = demoTenantById.get(demoTenantId)?.name;
  const id = name ? tenantIdByName.get(name) : undefined;
  if (!id) throw new Error(`tenant mapping missing for ${demoTenantId}`);
  return id;
}

// ---- meter readings (August entry UNSHIFTED — the seed keeps design prev/current) ----
const meterEntry = state.meterEntries.get(DEMO_MONTH);
if (!meterEntry) throw new Error(`missing ${DEMO_MONTH} meter entry in demo state`);
const meterRows = meterEntry.rooms.map((room) => ({
  property_id: propertyId,
  owner_id: owner.id,
  month: DEMO_MONTH,
  room_id: roomIdByNumber.get(room.roomNumber) ?? null,
  utility: 'electricity',
  previous: room.previous,
  current: room.current,
}));
meterRows.push({
  property_id: propertyId,
  owner_id: owner.id,
  month: DEMO_MONTH,
  room_id: null,
  utility: 'water',
  previous: meterEntry.water.previous,
  current: meterEntry.water.current,
});
const { error: meterError } = await admin.from('meter_readings').insert(meterRows);
if (meterError) throw meterError;

// ---- bills: July opening papers + August papers (lines/paper_ref/status/paid_amount) ----
const { data: billRows, error: billError } = await admin
  .from('bills')
  .insert(
    state.bills.map((bill) => ({
      property_id: propertyId,
      owner_id: owner.id,
      month: bill.month,
      room_id: roomDbId(bill.roomId),
      tenant_id: tenantDbId(bill.tenantId),
      lines: bill.lines,
      utilities_total: bill.utilitiesTotal,
      total: bill.total,
      paper_ref: bill.paperRef,
      status: bill.status,
      paid_amount: bill.paidAmount,
      created_at: bill.createdAt,
    })),
  )
  .select('id, paper_ref');
if (billError) throw billError;
const billIdByPaperRef = new Map<string, string>(
  (billRows ?? []).map((row) => [row.paper_ref as string, row.id as string]),
);
const billIdByDemoId = new Map<string, string>(
  state.bills.map((bill) => {
    const id = billIdByPaperRef.get(bill.paperRef);
    if (!id) throw new Error(`bill mapping missing for ${bill.paperRef}`);
    return [bill.id, id];
  }),
);

// ---- ledger: July payments (opening cycle) + August payments ----
const { error: ledgerError } = await admin.from('ledger_entries').insert(
  state.ledger.map((entry) => ({
    property_id: propertyId,
    owner_id: owner.id,
    bill_id: billIdByDemoId.get(entry.billId) ?? null,
    tenant_id: tenantDbId(entry.tenantId),
    month: entry.month,
    amount: entry.amount,
    paid_at: entry.paidAt,
    method: entry.method ?? null,
    note: entry.note ?? null,
    created_at: entry.createdAt,
  })),
);
if (ledgerError) throw ledgerError;

// ---- adjustments (none in the demo dataset) ----
if (state.adjustments.length > 0) {
  const { error } = await admin.from('adjustments').insert(
    state.adjustments.map((adjustment) => ({
      property_id: propertyId,
      owner_id: owner.id,
      month: adjustment.month,
      room_id: roomDbId(adjustment.roomId),
      label: adjustment.label,
      amount: adjustment.amount,
      note: adjustment.note ?? null,
      created_at: adjustment.createdAt,
    })),
  );
  if (error) throw error;
}

// ---- loan (নাফিসা · 5×1000 · 2 paid · add-to-bill ON) ----
const { error: loanError } = await admin.from('loans').insert(
  state.loans.map((loan) => ({
    property_id: propertyId,
    owner_id: owner.id,
    tenant_id: tenantDbId(loan.tenantId),
    total_amount: loan.totalAmount,
    installment_count: loan.installmentCount,
    installment_amount: loan.installmentAmount,
    paid_installments: loan.paidInstallments,
    add_to_bill: loan.addToBill,
    status: loan.status,
    note: loan.note ?? null,
    created_at: loan.createdAt,
    cancelled_at: loan.cancelledAt ?? null,
  })),
);
if (loanError) throw loanError;

// ---- finance entries (28's ব্যয় খাত · total ৳9,400) ----
const { error: financeError } = await admin.from('finance_entries').insert(
  state.finance.map((entry) => ({
    property_id: propertyId,
    owner_id: owner.id,
    kind: entry.kind,
    category: entry.category,
    amount: entry.amount,
    date: entry.date,
    note: entry.note ?? null,
    created_at: entry.createdAt,
  })),
);
if (financeError) throw financeError;

// ---- verify counts ----
console.log(`seeded property ${propertyId} for ${ownerEmail}`);
const tables = [
  'properties',
  'rooms',
  'tenants',
  'meter_readings',
  'bills',
  'ledger_entries',
  'loans',
  'finance_entries',
  'adjustments',
] as const;
for (const table of tables) {
  const { count, error } = await admin
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('owner_id', owner.id);
  if (error) throw error;
  console.log(`  ${table}: ${count}`);
}
console.log('seed complete.');
