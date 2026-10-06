import { NextResponse } from 'next/server';
const buckets = new Map<string, { n: number; expires: number }>();
export function protect(request: Request) {
  if (
    request.headers.get('origin') !==
    new URL(new URL(request.url).protocol + '//' + request.headers.get('host')).origin
  )
    throw new Error('ORIGIN_DENIED');
  const now = Date.now();
  if (buckets.size > 10000) for (const [k, v] of buckets) if (v.expires < now) buckets.delete(k);
  const key = (request.headers.get('x-forwarded-for') || 'local') + new URL(request.url).pathname;
  const b = buckets.get(key);
  if (b && b.expires > now) {
    if (++b.n > 60) throw new Error('RATE_LIMIT');
  } else buckets.set(key, { n: 1, expires: now + 60000 });
}
export function fail(error: unknown) {
  const message = error instanceof Error ? error.message : 'INTERNAL_ERROR';
  const status =
    message === 'UNAUTHENTICATED'
      ? 401
      : message === 'RATE_LIMIT'
        ? 429
        : ['PERMISSION_DENIED', 'MFA_REQUIRED', 'ORIGIN_DENIED'].includes(message)
          ? 403
          : message === 'SUPABASE_NOT_CONFIGURED'
            ? 503
            : 400;
  console.error(
    JSON.stringify({
      event: 'request_failed',
      category: status === 400 ? 'validation_or_db' : message,
      status,
    }),
  );
  return NextResponse.json({ error: message }, { status });
}
