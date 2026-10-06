import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { context } from '../../../../lib/supabase';
import { fail } from '../../../../lib/http';
export async function GET() {
  try {
    const { client, tenant, role } = await context();
    if (role !== 'owner') throw new Error('PERMISSION_DENIED');
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error('INVITATION_SERVICE_NOT_CONFIGURED');
    const { data: members, error } = await client
      .from('memberships')
      .select('user_id,role,active')
      .eq('tenant_id', tenant)
      .limit(100);
    if (error) throw new Error(error.message);
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
      auth: { persistSession: false },
    });
    // Retrieve only identities referenced by this tenant, never a global user directory.
    const result = await Promise.all(
      (members || []).map(async (member) => {
        const { data, error } = await admin.auth.admin.getUserById(member.user_id);
        if (error) throw new Error('USER_DIRECTORY_UNAVAILABLE');
        return { ...member, email: data.user.email || 'Usuario sin email' };
      }),
    );
    return NextResponse.json({ members: result });
  } catch (error) {
    return fail(error);
  }
}
