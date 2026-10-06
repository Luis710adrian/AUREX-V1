import { randomBytes, createHmac } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
const file = 'infra/local/.env';
if (
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !['localhost', '127.0.0.1'].includes(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname)
)
  throw new Error('Hosted configuration supplied; local bootstrap is not applicable');
function read(path) {
  return existsSync(path)
    ? Object.fromEntries(
        readFileSync(path, 'utf8')
          .trim()
          .split('\n')
          .map((l) => {
            const i = l.indexOf('=');
            return [l.slice(0, i), l.slice(i + 1)];
          }),
      )
    : {};
}
const existing = read(file);
const DB_PASSWORD = existing.DB_PASSWORD || randomBytes(24).toString('hex');
const JWT_SECRET = existing.JWT_SECRET || randomBytes(48).toString('hex');
const sign = (role) => {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({
      role,
      iss: 'supabase',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400 * 365,
    }),
  ).toString('base64url');
  return `${head}.${body}.${createHmac('sha256', JWT_SECRET).update(`${head}.${body}`).digest('base64url')}`;
};
writeFileSync(file, `DB_PASSWORD=${DB_PASSWORD}\nJWT_SECRET=${JWT_SECRET}\n`, { mode: 0o600 });
const previous = read('apps/web/.env.local');
if (
  previous.NEXT_PUBLIC_SUPABASE_URL &&
  !['localhost', '127.0.0.1'].includes(new URL(previous.NEXT_PUBLIC_SUPABASE_URL).hostname)
)
  throw new Error('Refusing to overwrite hosted configuration');
const values = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: sign('anon'),
  SUPABASE_SERVICE_ROLE_KEY: sign('service_role'),
  DATABASE_URL: `postgresql://postgres:${DB_PASSWORD}@127.0.0.1:54322/postgres`,
  AUREX_DEMO_PASSWORD: previous.AUREX_DEMO_PASSWORD || randomBytes(24).toString('base64url'),
};
writeFileSync(
  'apps/web/.env.local',
  Object.entries({ ...previous, ...values })
    .map(([k, v]) => `${k}=${v}`)
    .join('\n') + '\n',
  { mode: 0o600 },
);
console.log('Local credentials generated in ignored files. No values logged.');
