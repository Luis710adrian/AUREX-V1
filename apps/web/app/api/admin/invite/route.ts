import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { roles } from '../../../../../../packages/domain/catalog';
import { context } from '../../../../lib/supabase';
import { protect, fail } from '../../../../lib/http';
export async function POST(request: Request) {
  try {
    protect(request);
    const { client, tenant, role } = await context();
    if (role !== 'owner') throw new Error('PERMISSION_DENIED');
    const v = z.object({ email: z.email(), role: z.enum(roles) }).parse(await request.json());
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('INVITATION_SERVICE_NOT_CONFIGURED');
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
      auth: { persistSession: false },
    });
    const { data, error } = await admin.auth.admin.inviteUserByEmail(v.email, {
      redirectTo: new URL(
        new URL(request.url).protocol + '//' + request.headers.get('host') + '/invite',
      ).toString(),
    });
    if (error) throw new Error(error.message);
    const { error: memberError } = await client.rpc('assign_membership', {
      t: tenant,
      u: data.user.id,
      r: v.role,
    });
    if (memberError) throw new Error(memberError.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
