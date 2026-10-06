import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
export async function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('SUPABASE_NOT_CONFIGURED');
  const jar = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return jar.getAll();
      },
      setAll(items) {
        try {
          items.forEach(({ name, value, options }) =>
            jar.set(name, value, {
              ...options,
              httpOnly: true,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
            }),
          );
        } catch {
          /* Server components cannot set cookies; API routes refresh sessions. */
        }
      },
    },
  });
}
export async function context() {
  const client = await db();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) throw new Error('UNAUTHENTICATED');
  const { data: member, error: membershipError } = await client
    .from('memberships')
    .select('tenant_id,role')
    .eq('user_id', user.id)
    .eq('active', true)
    .limit(1)
    .single();
  if (membershipError || !member) throw new Error('PERMISSION_DENIED');
  if (['owner', 'finance'].includes(member.role)) {
    const { data } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel !== 'aal2') throw new Error('MFA_REQUIRED');
  }
  return { client, user, tenant: member.tenant_id as string, role: member.role as string };
}

export async function workspaceContext() {
  try {
    return await context();
  } catch (error) {
    const m = error instanceof Error ? error.message : 'INTERNAL_ERROR';
    if (
      ['UNAUTHENTICATED', 'MFA_REQUIRED', 'PERMISSION_DENIED', 'SUPABASE_NOT_CONFIGURED'].includes(
        m,
      )
    )
      redirect('/login?reason=' + encodeURIComponent(m));
    throw error;
  }
}
