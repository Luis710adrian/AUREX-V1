import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../lib/supabase';
import { protect, fail } from '../../../lib/http';
const input = z.discriminatedUnion('action', [
  z.object({ action: z.literal('login'), email: z.email(), password: z.string().min(8).max(100) }),
  z.object({
    action: z.literal('accept_invite'),
    access_token: z.string().min(100).max(10000),
    refresh_token: z.string().min(10).max(1000),
    password: z.string().min(12).max(100),
  }),
  z.object({ action: z.literal('logout') }),
  z.object({ action: z.literal('enroll') }),
  z.object({ action: z.literal('verify'), factorId: z.uuid(), code: z.string().regex(/^\d{6}$/) }),
]);
export async function POST(request: Request) {
  try {
    protect(request);
    const v = input.parse(await request.json());
    const client = await db();
    if (v.action === 'accept_invite') {
      const { error: sessionError } = await client.auth.setSession({
        access_token: v.access_token,
        refresh_token: v.refresh_token,
      });
      if (sessionError) throw new Error('INVITATION_EXPIRED');
      const { error } = await client.auth.updateUser({ password: v.password });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }
    if (v.action === 'login') {
      const { error } = await client.auth.signInWithPassword({
        email: v.email,
        password: v.password,
      });
      if (error) throw new Error('Credenciales inválidas');
      const { data } = await client.auth.mfa.listFactors();
      return NextResponse.json({ factorId: data?.totp.find((f) => f.status === 'verified')?.id });
    }
    if (v.action === 'logout') {
      await client.auth.signOut();
      return NextResponse.json({ ok: true });
    }
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) throw new Error('UNAUTHENTICATED');
    if (v.action === 'enroll') {
      const { data: factors } = await client.auth.mfa.listFactors();
      for (const factor of factors?.all || [])
        if (factor.status === 'unverified') await client.auth.mfa.unenroll({ factorId: factor.id });
      const { data, error } = await client.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'AUREX authenticator',
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ factorId: data.id, secret: data.totp.secret, uri: data.totp.uri });
    }
    const { error } = await client.auth.mfa.challengeAndVerify({
      factorId: v.factorId,
      code: v.code,
    });
    if (error) throw new Error('Código MFA inválido');
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
