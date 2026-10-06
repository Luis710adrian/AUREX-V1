import { readFileSync, readdirSync } from 'node:fs';
import pg from 'pg';
const env = Object.fromEntries(
  readFileSync('apps/web/.env.local', 'utf8')
    .trim()
    .split('\n')
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const url = new URL(env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Local prepare only');
const db = new pg.Client({ connectionString: env.DATABASE_URL });
await db.connect();
// Role passwords are generated, parameterized and never logged.
const password = decodeURIComponent(url.password).replaceAll("'", "''");
await db.query(
  `alter role supabase_auth_admin password '${password}'; alter role authenticator password '${password}'; alter role supabase_auth_admin set search_path=auth,public; alter role supabase_auth_admin nocreaterole;`,
);
await db.query(
  'alter function auth.uid() owner to supabase_auth_admin; alter function auth.jwt() owner to supabase_auth_admin',
);
if (process.argv.includes('--roles-only')) {
  await db.end();
  process.exit(0);
}
await db.query(
  "create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub','')::uuid $$",
);
await db.query(
  'create schema if not exists aurex_migrations; create table if not exists aurex_migrations.applied(name text primary key, applied_at timestamptz default now())',
);
for (const file of readdirSync('supabase/migrations')
  .filter((n) => n.endsWith('.sql'))
  .sort()) {
  if ((await db.query('select 1 from aurex_migrations.applied where name=$1', [file])).rowCount)
    continue;
  // Auth owns and creates auth.users. Run migrations only after Auth health passes.
  await db.query('begin');
  try {
    await db.query(readFileSync('supabase/migrations/' + file, 'utf8'));
    await db.query('insert into aurex_migrations.applied(name) values($1)', [file]);
    await db.query('commit');
    console.log('Applied ' + file);
  } catch (e) {
    await db.query('rollback');
    throw e;
  }
}
if (!(await db.query('select 1 from public.organizations_internal limit 1')).rowCount)
  await db.query(readFileSync('supabase/seed.sql', 'utf8'));
await db.query("notify pgrst, 'reload schema'");
await db.end();
