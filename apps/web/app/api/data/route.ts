import { NextResponse } from 'next/server';
import { modules } from '../../../../../packages/domain/catalog';
import { context } from '../../../lib/supabase';
import { fail } from '../../../lib/http';
export async function GET(request: Request) {
  try {
    const { client, tenant } = await context();
    const url = new URL(request.url);
    const table = url.searchParams.get('table') || 'leads';
    const entry = Object.values(modules).find((m) =>
      (m.tables as readonly string[]).includes(table),
    );
    if (!entry) throw new Error('UNKNOWN_TABLE');
    const { data: allowed } = await client.rpc('allowed', {
      t: tenant,
      d: entry.domain,
      writing: false,
    });
    if (!allowed) throw new Error('PERMISSION_DENIED');
    const { data, error } = await client
      .from(table)
      .select('*')
      .eq('tenant_id', tenant)
      .limit(100)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json({ rows: data });
  } catch (error) {
    return fail(error);
  }
}
