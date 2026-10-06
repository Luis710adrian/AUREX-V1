import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
// CLI output contains local secrets: capture in memory, never log it.
const result = JSON.parse(
  execFileSync('npx', ['supabase', 'status', '-o', 'json'], { encoding: 'utf8' }),
);
const file = 'apps/web/.env.local';
const previous = existsSync(file) ? readFileSync(file, 'utf8') : '';
const password =
  previous.match(/^AUREX_DEMO_PASSWORD=(.+)$/m)?.[1] || randomBytes(24).toString('base64url');
const values = {
  NEXT_PUBLIC_SUPABASE_URL: result.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: result.ANON_KEY,
  DATABASE_URL: result.DB_URL,
  AUREX_DEMO_PASSWORD: password,
};
if (!Object.values(values).every(Boolean))
  throw new Error('Local Supabase did not report the required configuration');
writeFileSync(
  file,
  Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n') + '\n',
  { mode: 0o600 },
);
console.log('Local configuration saved without logging keys or passwords.');
