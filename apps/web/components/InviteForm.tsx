'use client';
import { useState } from 'react';
import { roles } from '../../../packages/domain/catalog';
export function InviteForm() {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <details className="operation">
      <summary>Invitar usuario</summary>
      <form
        method="post"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setStatus('');
          const f = new FormData(e.currentTarget);
          try {
            const r = await fetch('/api/admin/invite', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: f.get('email'), role: f.get('role') }),
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error);
            setStatus('Invitación registrada. Revisa el correo del destinatario.');
          } catch (e) {
            setStatus(e instanceof Error ? e.message : 'Error de conexión');
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Email del usuario
          <input type="email" name="email" required />
        </label>
        <label htmlFor="invite-role">Rol</label>
        <select id="invite-role" name="role" defaultValue="analyst">
          {roles.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <button disabled={busy}>Enviar invitación</button>
        {status && <p role="status">{status}</p>}
      </form>
    </details>
  );
}
