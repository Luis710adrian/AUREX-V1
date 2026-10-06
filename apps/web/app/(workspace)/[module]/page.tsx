import Link from 'next/link';
import { notFound } from 'next/navigation';
import { modules, type ModuleKey, type Row } from '../../../../../packages/domain/catalog';
import { workspaceContext } from '../../../lib/supabase';
import { MemberManager } from '../../../components/MemberManager';
import { InviteForm } from '../../../components/InviteForm';
import { BrandNetwork } from '../../../components/BrandNetwork';
import { Operation, Records } from '../../../components/Operations';
export default async function Module({
  params,
  searchParams,
}: {
  params: Promise<{ module: string }>;
  searchParams: Promise<{ table?: string; from?: string; to?: string }>;
}) {
  const { module } = await params;
  const filters = await searchParams;
  const { client, tenant, role } = await workspaceContext();
  const { data: permissions } = await client
    .from('permissions')
    .select('domain,can_write')
    .eq('role', role);
  const domains = permissions?.map((p) => p.domain) || [];
  const canWrite = (d: string) => permissions?.some((p) => p.domain === d && p.can_write);
  if (module === 'command') {
    const today = new Date().toISOString().slice(0, 10);
    const from = filters.from || today.slice(0, 8) + '01';
    const to = filters.to || today;
    const { data: values, error } = domains.includes('finance')
      ? await client.rpc('command_kpis', { t: tenant, start_on: from, end_on: to, money: 'MXN' })
      : { data: null, error: null };
    const kpis = [
      ['invoiced', 'Facturación', 'invoices'],
      ['collections', 'Cobros', 'payments'],
      ['receivables', 'Cuentas por cobrar', 'invoice_balances'],
      ['overdue', 'Cartera vencida', 'invoice_balances'],
      ['pipeline', 'Pipeline ponderado', 'opportunities'],
      ['active_projects', 'Proyectos activos', 'projects'],
      ['hours', 'Horas registradas', 'time_entries'],
      ['direct_cost', 'Costo directo', 'project_profitability'],
    ];
    return (
      <>
        <section className="hero">
          <BrandNetwork />
          <p className="eyebrow">OPERATING INTELLIGENCE / 00</p>
          <h1>
            Command Center<span>El negocio, en perspectiva.</span>
          </h1>
          <p>La operación alimenta cada decisión. Datos persistidos, fuentes trazables.</p>
        </section>
        <form className="filters">
          <label>
            Desde
            <input type="date" name="from" defaultValue={from} required />
          </label>
          <label>
            Hasta
            <input type="date" name="to" defaultValue={to} required />
          </label>
          <button>Aplicar rango</button>
        </form>
        {error ? (
          <p role="alert">No se pudieron calcular los KPIs: {error.message}</p>
        ) : values ? (
          <div className="kpis">
            {kpis.map(([key, label, table]) => (
              <Link
                href={`/${table === 'opportunities' ? 'crm' : table === 'projects' ? 'projects' : table === 'time_entries' ? 'work' : 'finance'}?table=${table}`}
                className="kpi"
                key={key}
              >
                <span>{label}</span>
                <strong>
                  {values[key] === null
                    ? 'Sin permiso'
                    : new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(
                        values[key] ?? 0,
                      )}
                </strong>
                <small>
                  {['active_projects', 'hours'].includes(key) ? 'Periodo / registros' : 'MXN'} · Ver
                  fuente ↗
                </small>
              </Link>
            ))}
          </div>
        ) : (
          <p className="empty">
            Los KPIs financieros requieren permisos de Finanzas. Abre tus proyectos y tareas desde
            la navegación.
          </p>
        )}
        <section className="panel">
          <h2>Entrega por fases</h2>
          <p>
            Núcleo en validación. Research Ops, Marketing, Data Hub, Portal e IA están pendientes y
            no muestran métricas simuladas.
          </p>
          <div className="status-list">
            <span>Research Ops · pendiente</span>
            <span>Social connectors · pending</span>
            <span>AUREX AI · desactivado</span>
          </div>
        </section>
      </>
    );
  }
  if (!(module in modules)) notFound();
  const config = modules[module as ModuleKey];
  if (!domains.includes(config.domain))
    return (
      <section className="panel">
        <h1>Acceso restringido</h1>
        <p role="alert">Tu rol no tiene permisos para este módulo.</p>
      </section>
    );
  const table =
    filters.table && (config.tables as readonly string[]).includes(filters.table)
      ? filters.table
      : config.tables[0];
  const { data: rows, error } = await client
    .from(table)
    .select('*')
    .eq('tenant_id', tenant)
    .order('created_at', { ascending: false })
    .limit(100);
  const getOptions = async (t: string) => {
    const { data } = await client.from(t).select('id,name').eq('tenant_id', tenant).limit(100);
    return data || [];
  };
  const [leads, opps, projects, tasks, invoices, phases, expenses] = await Promise.all(
    ['leads', 'opportunities', 'projects', 'tasks', 'invoices', 'phases', 'expenses'].map(
      getOptions,
    ),
  );
  const options = (key: string, label: string, opts: { id: string; name: string }[]) => ({
    key,
    label,
    options: opts,
  });
  const field = (key: string, label: string, type = 'text') => ({ key, label, type });
  return (
    <>
      <p className="eyebrow">AUREX OS / {module.toUpperCase()}</p>
      <h1>{config.name}</h1>
      <p className="muted">
        Cada registro conserva tenant, autor e historial. Hasta 100 registros recientes.
      </p>
      {module === 'admin' && role === 'owner' && <MemberManager />}
      <div className="tabs">
        {config.tables.map((t) => (
          <Link
            key={t}
            href={`/${module}?table=${t}`}
            aria-current={t === table ? 'page' : undefined}
          >
            {t}
          </Link>
        ))}
      </div>
      {canWrite(config.domain) && (
        <section className="actions">
          {module === 'admin' && role === 'owner' && <InviteForm />}
          {module === 'crm' && (
            <>
              <Operation
                title="Nuevo lead"
                action="create_lead"
                fields={[
                  field('company', 'Empresa'),
                  field('contact', 'Contacto'),
                  field('email', 'Email', 'email'),
                  field('need', 'Necesidad'),
                  field('source', 'Origen'),
                  field('next_action', 'Siguiente acción'),
                ]}
              />
              <Operation
                title="Calificar lead"
                action="qualify_lead"
                fields={[
                  options('l', 'Lead', leads),
                  field('service', 'Servicio'),
                  field('amount', 'Valor MXN', 'number'),
                  field('close_date', 'Fecha de cierre', 'date'),
                ]}
              />
              <Operation
                title="Crear propuesta"
                action="create_proposal"
                fields={[
                  options('o', 'Oportunidad', opps),
                  field('scope', 'Alcance'),
                  field('valid_until', 'Vigencia', 'date'),
                ]}
              />
              <Operation
                title="Cambiar etapa"
                action="advance_opportunity"
                fields={[
                  options('o', 'Oportunidad', opps),
                  options(
                    'target',
                    'Etapa',
                    [
                      'Discovery',
                      'Solution Designed',
                      'Proposal Sent',
                      'Negotiation',
                      'Won',
                      'Lost',
                    ].map((s) => ({ id: s, name: s })),
                  ),
                  field('reason', 'Motivo'),
                ]}
              />
            </>
          )}
          {module === 'projects' && (
            <>
              <Operation
                title="Aprobar gate"
                action="approve_gate"
                fields={[
                  options('p', 'Fase', phases),
                  field('evidence', 'Evidencia de criterios cumplidos'),
                ]}
              />
              <Operation
                title="Nueva tarea"
                action="create_task"
                fields={[
                  options('project_id', 'Proyecto', projects),
                  field('name', 'Tarea'),
                  field('due_date', 'Vencimiento', 'date'),
                  field('estimated_hours', 'Horas estimadas', 'number'),
                ]}
              />
              <Operation
                title="Nuevo hito"
                action="create_milestone"
                fields={[
                  options('project_id', 'Proyecto', projects),
                  field('name', 'Hito'),
                  field('due_date', 'Vencimiento', 'date'),
                ]}
              />
              <Operation
                title="Actualizar tarea"
                action="update_task"
                fields={[
                  options('id', 'Tarea', tasks),
                  options(
                    'status',
                    'Estado',
                    ['todo', 'doing', 'blocked', 'done'].map((s) => ({ id: s, name: s })),
                  ),
                ]}
              />
              <Operation
                title="Nuevo riesgo"
                action="create_risk"
                fields={[
                  options('project_id', 'Proyecto', projects),
                  field('name', 'Riesgo'),
                  field('probability', 'Probabilidad 1–5', 'number'),
                  field('impact', 'Impacto 1–5', 'number'),
                  field('mitigation', 'Mitigación'),
                  field('review_date', 'Revisión', 'date'),
                ]}
              />
              <Operation
                title="Nueva incidencia"
                action="create_issue"
                fields={[
                  options('project_id', 'Proyecto', projects),
                  field('name', 'Incidencia'),
                  field('impact', 'Impacto'),
                  field('action_text', 'Acción'),
                ]}
              />
            </>
          )}
          {module === 'work' && (
            <>
              <Operation
                title="Capacidad semanal"
                action="create_capacity"
                fields={[
                  field('name', 'Nombre'),
                  field('week_start', 'Semana', 'date'),
                  field('hours', 'Horas disponibles', 'number'),
                ]}
              />
              <Operation
                title="Registrar ausencia"
                action="create_absence"
                fields={[
                  field('name', 'Motivo'),
                  field('starts_on', 'Desde', 'date'),
                  field('ends_on', 'Hasta', 'date'),
                  field('hours', 'Horas de ausencia', 'number'),
                ]}
              />
              <Operation
                title="Registrar horas"
                action="record_time"
                hidden={{ billable: true }}
                fields={[
                  options('task', 'Tarea', tasks),
                  field('minutes', 'Minutos', 'number'),
                  field('work_date', 'Fecha', 'date'),
                  field('description', 'Descripción'),
                ]}
              />
            </>
          )}
          {module === 'finance' && (
            <>
              <Operation
                title="Aprobar gasto"
                action="approve_expense"
                hidden={{ approved: true }}
                fields={[options('e', 'Gasto', expenses)]}
              />
              <Operation
                title="Confirmar costos completos"
                action="attest_costs"
                hidden={{ complete: true }}
                fields={[options('p', 'Proyecto', projects)]}
              />
              <Operation
                title="Emitir factura"
                action="issue_invoice"
                fields={[
                  options('p', 'Proyecto', projects),
                  field('concept', 'Concepto'),
                  field('subtotal', 'Subtotal MXN', 'number'),
                  field('tax', 'Impuestos', 'number'),
                  field('due', 'Vencimiento', 'date'),
                ]}
              />
              <Operation
                title="Registrar pago"
                action="record_payment"
                fields={[
                  options('i', 'Factura', invoices),
                  field('amount', 'Monto', 'number'),
                  field('paid_on', 'Fecha', 'date'),
                  field('method', 'Método'),
                  field('reference', 'Referencia'),
                ]}
              />
              <Operation
                title="Registrar gasto"
                action="create_expense"
                fields={[
                  options('project_id', 'Proyecto', projects),
                  field('name', 'Concepto'),
                  field('amount', 'Monto', 'number'),
                  field('spent_on', 'Fecha', 'date'),
                ]}
              />
            </>
          )}
        </section>
      )}
      {error ? (
        <p role="alert">Error al cargar: {error.message}</p>
      ) : (
        <Records table={table} rows={(rows || []) as Row[]} />
      )}
    </>
  );
}
