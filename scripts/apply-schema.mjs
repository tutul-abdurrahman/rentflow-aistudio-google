/**
 * RentFlow — apply supabase/schema.sql to the Supabase Postgres database.
 *
 * Usage: node --env-file=.env scripts/apply-schema.mjs
 * Tries the direct db host first, then the IPv4 session pooler.
 * Idempotent: schema.sql uses create-if-not-exists + drop-if-exists policies.
 */

import { readFileSync } from 'node:fs';
import pg from 'pg';

const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
const directHost = process.env.SUPABASE_DB_HOST;
const dbName = process.env.SUPABASE_DB_NAME || 'postgres';
const dbUser = process.env.SUPABASE_DB_USER || 'postgres';

if (!ref || !password || !directHost) {
  console.error('Missing SUPABASE_PROJECT_REF / SUPABASE_DB_PASSWORD / SUPABASE_DB_HOST in .env');
  process.exit(1);
}

const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');

const candidates = [
  { host: directHost, port: 5432, user: dbUser, ssl: { rejectUnauthorized: false }, label: 'direct' },
  {
    host: `aws-0-ap-south-1.pooler.supabase.com`,
    port: 5432,
    user: `postgres.${ref}`,
    ssl: { rejectUnauthorized: false },
    label: 'pooler-ap-south-1',
  },
  {
    host: `aws-0-ap-southeast-1.pooler.supabase.com`,
    port: 5432,
    user: `postgres.${ref}`,
    ssl: { rejectUnauthorized: false },
    label: 'pooler-ap-southeast-1',
  },
];

let client = null;
for (const cfg of candidates) {
  try {
    const c = new pg.Client({ ...cfg, password, database: dbName, connectionTimeoutMillis: 8000 });
    await c.connect();
    console.log(`connected via ${cfg.label}`);
    client = c;
    break;
  } catch (err) {
    console.log(`${cfg.label} failed: ${err.message}`);
  }
}
if (!client) {
  console.error('Could not connect to the database via any route.');
  process.exit(1);
}

await client.query(sql);
const { rows } = await client.query(
  `select table_name from information_schema.tables
   where table_schema = 'public' order by table_name`,
);
console.log('tables:', rows.map((r) => r.table_name).join(', '));
const pol = await client.query(
  `select count(*)::int as n from pg_policies where schemaname = 'public'`,
);
console.log(`policies: ${pol.rows[0].n}`);
await client.end();
console.log('schema applied.');
