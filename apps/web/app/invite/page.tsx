'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
export default function Invite() {
  const router = useRouter();
  const [token, setToken] = useState<{ access_token: string; refresh_token: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const h = new URLSearchParams(location.hash.slice(1));
    const access_token = h.get('access_token'),
      refresh_token = h.get('refresh_token');
    history.replaceState(null, '', location.pathname);
    queueMicrotask(() => {
      if (access_token && refresh_token) setToken({ access_token, refresh_token });
      else setError('El enlace es inválido o ha expirado. Solicita una nueva invitación.');
    });
  }, []);
  return (
    <main className="login">
      <div className="brand">
        AUREX<span>OS / INVITACIÓN SEGURA</span>
      </div>
      <h1>Activa tu acceso</h1>
      <p>Configura una contraseña. Los roles sensibles también requieren MFA.</p>
      {token && (
        <form
          method="post"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              const password = String(new FormData(e.currentTarget).get('password'));
              const r = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'accept_invite', ...token, password }),
              });
              if (!r.ok) throw new Error((await r.json()).error);
              setToken(null);
              router.push('/login');
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Error de conexión');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Nueva contraseña
            <input
              name="password"
              type="password"
              minLength={12}
              maxLength={100}
              autoComplete="new-password"
              required
            />
          </label>
          <button disabled={busy}>Activar acceso</button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
