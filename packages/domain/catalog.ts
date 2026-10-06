export const roles = [
  'owner',
  'operations',
  'pm',
  'analyst',
  'field',
  'sales',
  'finance',
  'client',
  'auditor',
] as const;
export const modules = {
  crm: {
    name: 'CRM & Revenue',
    domain: 'crm',
    tables: ['leads', 'opportunities', 'proposals', 'contracts', 'contacts', 'accounts'],
  },
  clients: { name: 'Clientes', domain: 'crm', tables: ['accounts', 'contacts'] },
  projects: {
    name: 'Proyectos',
    domain: 'projects',
    tables: [
      'projects',
      'phases',
      'phase_gate_reviews',
      'milestones',
      'tasks',
      'risks',
      'issues',
      'decisions',
      'change_requests',
    ],
  },
  work: {
    name: 'Trabajo & Equipo',
    domain: 'work',
    tables: ['tasks', 'time_entries', 'capacity_summary', 'capacity_calendar', 'absences'],
  },
  finance: {
    name: 'Finanzas',
    domain: 'finance',
    tables: [
      'invoices',
      'payments',
      'invoice_balances',
      'project_profitability',
      'expenses',
      'project_budgets',
      'role_cost_rates',
      'kpi_definitions',
    ],
  },
  files: { name: 'Entregables', domain: 'files', tables: ['files', 'comments', 'approvals'] },
  admin: { name: 'Admin & Auditoría', domain: 'admin', tables: ['audit_events', 'memberships'] },
} as const;
export type ModuleKey = keyof typeof modules;
export type Row = Record<string, string | number | boolean | null>;
export const stages = [
  'Qualified',
  'Discovery',
  'Solution Designed',
  'Proposal Sent',
  'Negotiation',
  'Won',
] as const;
