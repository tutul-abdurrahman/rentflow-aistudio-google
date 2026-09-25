/**
 * RentFlow — read-only live smoke test.
 *
 * Usage: npx tsx --env-file=.env scripts/smoke-live.mts
 *
 * Signs in as the owner with the ANON key (RLS applies), wraps that same
 * client in createSupabaseRepository, and asserts the §9 August figures.
 * It never writes: every call is a read/derive.
 */

import { createClient } from '@supabase/supabase-js';
import { createSupabaseRepository } from '../src/lib/repository/supabase.ts';

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const ownerEmail = process.env.OWNER_EMAIL;
const ownerPassword = process.env.OWNER_PASSWORD;

if (!url || !anonKey || !ownerEmail || !ownerPassword) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / OWNER_EMAIL / OWNER_PASSWORD');
  process.exit(1);
}

const client = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const repo = createSupabaseRepository(client);

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'PASS' : 'FAIL'} · ${label} · got ${JSON.stringify(actual)} · expected ${JSON.stringify(expected)}`,
  );
}

// ---- RLS: signed out, the owner's rows must be invisible ----
const signedOut = await repo.listBills('2026-08');
check('signed-out listBills(2026-08).length', signedOut.length, 0);

// ---- sign in as the owner ----
const { error: signInError } = await client.auth.signInWithPassword({
  email: ownerEmail,
  password: ownerPassword,
});
if (signInError) throw signInError;
const { data: sessionData } = await client.auth.getSession();
if (!sessionData.session) throw new Error('no session after sign-in');
console.log(`signed in as ${ownerEmail} (${sessionData.session.user.id})`);

// ---- active month + bills ----
const activeMonth = await repo.getActiveMonth();
check('getActiveMonth()', activeMonth, '2026-08');

const bills = await repo.listBills('2026-08');
check('listBills(2026-08).length', bills.length, 5);

const rooms = await repo.listRooms();
const numberByRoomId = new Map(rooms.map((room) => [room.id, room.number]));
const billRooms = bills.map((bill) => numberByRoomId.get(bill.roomId) ?? '');
check('no bill for room 106', billRooms.includes('106'), false);
console.log(`  bill rooms: ${billRooms.join(', ')}`);

// ---- dashboard ----
const dashboard = await repo.getDashboard('2026-08');
check('dashboard.dueTotal', dashboard.dueTotal, 25823);
check('dashboard.collectedTotal', dashboard.collectedTotal, 42200);
check('dashboard.expenseTotal', dashboard.expenseTotal, 9400);
check('dashboard.vacantRooms', dashboard.vacantRooms, 1);
check('dashboard.totalRooms', dashboard.totalRooms, 6);
console.log(
  `  dashboard: due=${dashboard.dueTotal} collected=${dashboard.collectedTotal} expense=${dashboard.expenseTotal} vacant=${dashboard.vacantRooms}/${dashboard.totalRooms}`,
);
console.log(
  `  dueList: ${dashboard.dueList.map((row) => `${row.roomNumber}:${row.amount}`).join(', ')}`,
);

// ---- monthly ledger ----
const monthlyLedger = await repo.getMonthlyLedger('2026-08');
check('getMonthlyLedger(2026-08).length', monthlyLedger.length, 5);
check(
  'monthly ledger paperRefs',
  monthlyLedger.every((row) => /^RF-202608-\d+$/.test(row.paperRef)),
  true,
);
console.log(`  ledger refs: ${monthlyLedger.map((row) => row.paperRef).join(', ')}`);

// ---- carried dues entering August (derived from the July ledger) ----
const prevDue = await repo.getPrevDueByRoom('2026-08');
const roomIdByNumber = new Map(rooms.map((room) => [room.number, room.id]));
check('prev due room 102', prevDue.get(roomIdByNumber.get('102') ?? ''), 4200);
check('prev due room 103', prevDue.get(roomIdByNumber.get('103') ?? ''), 2500);
check('prev due room 105', prevDue.get(roomIdByNumber.get('105') ?? ''), 4900);

console.log(failures === 0 ? 'SMOKE OK' : `SMOKE FAILED (${failures})`);
process.exit(failures === 0 ? 0 : 1);
