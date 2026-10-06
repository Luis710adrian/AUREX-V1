import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const config = Object.fromEntries(
  readFileSync('apps/web/.env.local', 'utf8')
    .trim()
    .split('\n')
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const info = {
  API_URL: config.NEXT_PUBLIC_SUPABASE_URL,
  SERVICE_ROLE_KEY: config.SUPABASE_SERVICE_ROLE_KEY,
};
if (!['localhost', '127.0.0.1'].includes(new URL(info.API_URL).hostname))
  throw new Error('Test bootstrap is local-only');
const client = createClient(info.API_URL, info.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const {
  data: { users },
} = await client.auth.admin.listUsers();
const owner = users.find((u) => u.email === 'owner@aurex.demo');
if (owner) {
  const { data, error } = await client.auth.admin.mfa.listFactors({ userId: owner.id });
  if (error) throw error;
  for (const f of data.factors) {
    const { error } = await client.auth.admin.mfa.deleteFactor({ userId: owner.id, id: f.id });
    if (error) throw error;
  }
}
console.log('Local test MFA reset; no operational accounts affected.');
