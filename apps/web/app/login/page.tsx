'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
export default function Login() {
  const router = useRouter();
  const [factor, setFactor] = useState('');
  const [secret, setSecret] = useState('');
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function request(values: Record<string, string>) {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login">
      <div className="brand">
        AUREX<span>OS / SECURE ACCESS</span>
      </div>
      <h1>Acceso a la operación</h1>
      <p>Autenticación segura. Dirección y Finanzas requieren MFA.</p>
      {!signed ? (
        <form
          method="post"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const d = await request({
              action: 'login',
              email: String(f.get('email')),
              password: String(f.get('password')),
            });
            if (d) {
              setSigned(true);
              setFactor(d.factorId || '');
            }
          }}
        >
          <label>
            Email
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={8}
              required
            />
          </label>
          <button disabled={busy}>Iniciar sesión</button>
        </form>
      ) : (
        <div>
          {!factor && (
            <>
              <p>La sesión está autenticada. Activa MFA si tu rol lo requiere.</p>
              <button
                disabled={busy}
                onClick={async () => {
                  const d = await request({ action: 'enroll' });
                  if (d) {
                    setFactor(d.factorId);
                    setSecret(d.secret);
                  }
                }}
              >
                Configurar MFA
              </button>
              <Link className="button" href="/command">
                Continuar
              </Link>
            </>
          )}
          {factor && (
            <form
              method="post"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const d = await request({
                  action: 'verify',
                  factorId: factor,
                  code: String(f.get('code')),
                });
                if (d) {
                  router.push('/command');
                  router.refresh();
                }
              }}
            >
              {secret && (
                <p>
                  Agrega esta clave a tu autenticador:{' '}
                  <code data-testid="totp-secret">{secret}</code>
                </p>
              )}
              <label>
                Código MFA
                <input
                  name="code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  autoComplete="one-time-code"
                  required
                />
              </label>
              <button disabled={busy}>Verificar MFA</button>
            </form>
          )}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <p className="muted">
        No se registran usuarios públicamente. La organización debe invitarte y asignarte permisos.
      </p>
    </main>
  );
}
