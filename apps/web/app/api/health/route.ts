import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const configured = !!(url && key);
  let auth = false,
    database = false;
  if (url && key)
    try {
      const client = createClient(url, key, {
        auth: { persistSession: false },
        global: {
          fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(3000) }),
        },
      });
      const [response, result] = await Promise.all([
        fetch(`${url}/auth/v1/health`, {
          headers: { apikey: key },
          signal: AbortSignal.timeout(3000),
        }),
        client.rpc('database_health'),
      ]);
      auth = response.ok;
      database = !result.error && result.data === true;
    } catch {}
  return NextResponse.json(
    {
      application: 'AUREX OS',
      auth: auth ? 'reachable' : 'unavailable',
      database: database ? 'reachable' : 'unavailable',
      configured,
    },
    { status: auth && database ? 200 : 503 },
  );
}
