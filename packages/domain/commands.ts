import { z } from 'zod';
import { roles } from './catalog';
const uuid = z.uuid();
const text = z.string().trim().min(2).max(2000);
const day = z.iso.date();
const amount = z.coerce
  .number()
  .positive()
  .max(1e12)
  .refine(
    (n) => Number.isInteger(n * 100 + 1e-6) || Math.abs(n * 100 - Math.round(n * 100)) < 1e-5,
    'Usa hasta dos decimales',
  );
const command = <T extends string, S extends z.ZodRawShape>(action: T, shape: S) =>
  z.object({ action: z.literal(action), ...shape });
export const commands = z.discriminatedUnion('action', [
  command('manage_member', { u: uuid, r: z.enum(roles), enabled: z.boolean() }),
  command('assign_project_member', { p: uuid, u: uuid }),
  command('approve_gate', { p: uuid, evidence: z.string().trim().min(10).max(5000) }),
  command('approve_expense', { e: uuid, approved: z.boolean() }),
  command('attest_costs', { p: uuid, complete: z.boolean() }),
  command('set_cost_rate', { u: uuid, rate: z.coerce.number().nonnegative(), effective: day }),
  command('create_capacity', {
    week_start: day,
    hours: z.coerce.number().min(0).max(168),
    name: text,
  }),
  command('create_absence', {
    starts_on: day,
    ends_on: day,
    hours: z.coerce.number().positive(),
    name: text,
  }),
  command('create_lead', {
    company: text,
    contact: text,
    email: z.email(),
    need: text,
    source: text,
    next_action: text,
  }),
  command('qualify_lead', { l: uuid, service: text, amount, close_date: day }),
  command('create_proposal', { o: uuid, scope: text, valid_until: day }),
  command('advance_opportunity', {
    o: uuid,
    target: z.enum([
      'Discovery',
      'Solution Designed',
      'Proposal Sent',
      'Negotiation',
      'Won',
      'Lost',
    ]),
    reason: text,
  }),
  command('record_time', {
    task: uuid,
    minutes: z.coerce.number().int().min(1).max(1440),
    work_date: day,
    billable: z.boolean(),
    description: text,
  }),
  command('issue_invoice', {
    p: uuid,
    concept: text,
    subtotal: amount,
    tax: z.coerce.number().min(0).max(1e12),
    due: day,
  }),
  command('record_payment', {
    i: uuid,
    amount,
    paid_on: day,
    method: text,
    reference: text,
    key: uuid,
  }),
  command('create_task', {
    project_id: uuid,
    name: text,
    due_date: day,
    estimated_hours: z.coerce.number().nonnegative(),
  }),
  command('create_milestone', { project_id: uuid, name: text, due_date: day }),
  command('update_task', { id: uuid, status: z.enum(['todo', 'doing', 'blocked', 'done']) }),
  command('create_risk', {
    project_id: uuid,
    name: text,
    probability: z.coerce.number().int().min(1).max(5),
    impact: z.coerce.number().int().min(1).max(5),
    mitigation: text,
    review_date: day,
  }),
  command('create_issue', { project_id: uuid, name: text, impact: text, action_text: text }),
  command('create_expense', { project_id: uuid, name: text, amount, spent_on: day }),
]);
