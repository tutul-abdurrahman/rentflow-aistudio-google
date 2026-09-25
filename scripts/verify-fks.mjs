// Verify tenant FKs are restrict, not cascade. Usage: node --env-file=.env scripts/verify-fks.mjs
import pg from 'pg';

const client = new pg.Client({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const r = await client.query(
  `select conrelid::regclass::text as tbl, conname, confdeltype
   from pg_constraint
   where contype = 'f' and conname like '%tenant_id_fkey'
   order by conrelid::regclass::text`,
);
for (const row of r.rows) {
  console.log(`${row.tbl} · ${row.conname} · delete=${row.confdeltype === 'r' ? 'RESTRICT ✓' : row.confdeltype}`);
}
await client.end();
