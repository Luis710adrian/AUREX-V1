'use client';
import { useEffect, useState } from 'react';
import { roles } from '../../../packages/domain/catalog';
type Member = { user_id: string; email: string; role: (typeof roles)[number]; active: boolean };
export function MemberManager() {
  const [members, setMembers] = useState<Member[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(''),
    [status, setStatus] = useState('');
  useEffect(() => {
    let live = true;
    fetch('/api/admin/members')
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (live) setMembers(d.members);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  async function save(member: Member, enabled: boolean) {
    setSaving(member.user_id);
    setError('');
    setStatus('');
    try {
      const r = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manage_member',
          u: member.user_id,
          r: member.role,
          enabled,
        }),
      });
      const d = await r.json();
      if (!r.ok)
        throw new Error(
          d.error === 'cannot remove last active owner'
            ? 'Debe permanecer al menos un Owner activo.'
            : d.error,
        );
      setMembers((m) =>
        m.map((row) => (row.user_id === member.user_id ? { ...row, active: enabled } : row)),
      );
      setStatus('Permisos actualizados y auditados.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión');
    } finally {
      setSaving('');
    }
  }
  return (
    <section className="panel">
      <h2>Equipo y acceso</h2>
      <p>Permisos del tenant actual. Los cambios se validan en servidor y quedan auditados.</p>
      {loading && <p role="status">Cargando miembros…</p>}
      {error && <p role="alert">{error}</p>}
      {status && <p role="status">{status}</p>}
      {!loading && !members.length && !error && <p>No hay miembros.</p>}
      <div className="table-wrap">
        <table>
          <caption>Hasta 100 miembros de esta organización</caption>
          <thead>
            <tr>
              <th scope="col">Usuario</th>
              <th scope="col">Rol</th>
              <th scope="col">Acceso</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.user_id}>
                <td>{m.email}</td>
                <td>
                  <label className="sr-only" htmlFor={'member-' + m.user_id}>
                    Rol de {m.email}
                  </label>
                  <select
                    id={'member-' + m.user_id}
                    value={m.role}
                    onChange={(e) =>
                      setMembers((rows) =>
                        rows.map((row) =>
                          row.user_id === m.user_id
                            ? { ...row, role: e.target.value as Member['role'] }
                            : row,
                        ),
                      )
                    }
                  >
                    {roles.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td>{m.active ? 'Activo' : 'Bloqueado'}</td>
                <td>
                  <button disabled={!!saving} onClick={() => save(m, m.active)}>
                    Guardar rol
                  </button>{' '}
                  <button disabled={!!saving} onClick={() => save(m, !m.active)}>
                    {m.active ? 'Bloquear' : 'Reactivar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
