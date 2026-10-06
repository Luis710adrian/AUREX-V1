'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Row } from '../../../packages/domain/catalog';
type Field = {
  key: string;
  label: string;
  type?: string;
  options?: { id: string; name: string }[];
  value?: string;
};
export function Operation({
  title,
  action,
  fields,
  hidden = {},
}: {
  title: string;
  action: string;
  fields: Field[];
  hidden?: Record<string, string | boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();
  return (
    <details className="operation" open={open}>
      <summary
        onClick={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
      >
        {title}
      </summary>
      <form
        method="post"
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          setDone(false);
          setBusy(true);
          const form = e.currentTarget;
          const payload: Record<string, string | number | boolean> = { action, ...hidden };
          new FormData(form).forEach((v, k) => (payload[k] = String(v)));
          if (action === 'record_payment') payload.key = crypto.randomUUID();
          try {
            const r = await fetch('/api/actions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            const data = await r.json();
            if (!r.ok) throw new Error(data.error);
            setDone(true);
            form.reset();
            startTransition(() => router.refresh());
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Error de conexión');
          } finally {
            setBusy(false);
          }
        }}
      >
        {fields.map((f) => (
          <div className="field" key={f.key}>
            <label htmlFor={`${action}-${f.key}`}>{f.label}</label>
            {f.options ? (
              <select id={`${action}-${f.key}`} name={f.key} required defaultValue="">
                <option value="" disabled>
                  Selecciona…
                </option>
                {f.options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`${action}-${f.key}`}
                name={f.key}
                type={f.type || 'text'}
                required
                defaultValue={f.value}
                step={f.type === 'number' ? '0.01' : undefined}
              />
            )}
          </div>
        ))}
        <button disabled={busy || refreshing}>
          {busy || refreshing ? 'Guardando…' : 'Guardar'}
        </button>
        {error && <p role="alert">{error}</p>}
        {done && !refreshing && <p role="status">Registro guardado.</p>}
      </form>
    </details>
  );
}
export function Records({ rows, table }: { rows: Row[]; table: string }) {
  if (!rows.length)
    return <div className="empty">No hay registros. Crea el primero para iniciar el flujo.</div>;
  const excluded = ['tenant_id', 'created_by', 'archived_at', 'updated_at'];
  const keys = Object.keys(rows[0])
    .filter((k) => !excluded.includes(k))
    .slice(0, 10);
  return (
    <div className="table-wrap">
      <table>
        <caption>
          {table} · últimos {rows.length} registros
        </caption>
        <thead>
          <tr>
            {keys.map((k) => (
              <th scope="col" key={k}>
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row.id)}>
              {keys.map((k) => (
                <td key={k} title={String(row[k] ?? '')}>
                  {typeof row[k] === 'object' ? JSON.stringify(row[k]) : String(row[k] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
