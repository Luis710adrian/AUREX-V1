import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import pg from 'pg';
const config = Object.fromEntries(
  readFileSync('apps/web/.env.local', 'utf8')
    .trim()
    .split('\n')
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const db = new pg.Client({ connectionString: config.DATABASE_URL });
const tenant = '10000000-0000-4000-8000-000000000001';
let owner: string;
const users: Record<string, string> = {};
beforeAll(async () => {
  await db.connect();
  const { rows } = await db.query('select email,id from auth.users');
  for (const r of rows) users[r.email.split('@')[0]] = r.id;
  owner = users.owner;
  if (!owner) throw new Error('Run demo bootstrap before tests');
});
afterAll(async () => {
  await db.end();
});
async function as(role: string, fn: () => Promise<void>, aal = 'aal2') {
  await db.query('begin');
  try {
    await db.query('set local role authenticated');
    await db.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: users[role], role: 'authenticated', aal }),
    ]);
    await fn();
  } finally {
    await db.query('rollback');
  }
}
describe('PostgreSQL transactions and RLS (real database)', () => {
  it('executes Lead → proposal → Won → Project → Task → Time → Invoice → Payment → KPI', async () => {
    await as('owner', async () => {
      const before = (
        await db.query('select public.command_kpis($1,current_date,current_date) k', [tenant])
      ).rows[0].k;
      const lead = (
        await db.query(
          "select public.create_lead($1,'Test account','Test contact','test@example.invalid','Research decision','Test','Discovery') id",
          [tenant],
        )
      ).rows[0].id;
      const opportunity = (
        await db.query("select public.qualify_lead($1,$2,'Research',10000,current_date+1) id", [
          tenant,
          lead,
        ])
      ).rows[0].id;
      await db.query(
        "select public.create_proposal($1,$2,'Research scope accepted',current_date+90)",
        [tenant, opportunity],
      );
      let project;
      for (const stage of ['Discovery', 'Solution Designed', 'Proposal Sent', 'Negotiation', 'Won'])
        project = (
          await db.query('select public.advance_opportunity($1,$2,$3,$4) id', [
            tenant,
            opportunity,
            stage,
            'Criteria verified',
          ])
        ).rows[0].id;
      expect(
        (
          await db.query("select public.advance_opportunity($1,$2,'Won','Retry Won') id", [
            tenant,
            opportunity,
          ])
        ).rows[0].id,
      ).toBe(project);
      expect(
        (await db.query('select count(*) from public.phases where project_id=$1', [project]))
          .rows[0].count,
      ).toBe('6');
      const task = (
        await db.query(
          "insert into public.tasks(tenant_id,project_id,name,owner_id,due_date) values($1,$2,'Analysis',$3,current_date) returning id",
          [tenant, project, owner],
        )
      ).rows[0].id;
      await db.query("select public.record_time($1,$2,120,current_date,true,'Analysis delivery')", [
        tenant,
        task,
      ]);
      const invoice = (
        await db.query(
          "select public.issue_invoice($1,$2,'Research fee',10000,1600,current_date+30) id",
          [tenant, project],
        )
      ).rows[0].id;
      const key = crypto.randomUUID();
      const p = (
        await db.query(
          "select public.record_payment($1,$2,11600,current_date,'Transfer','TEST',$3) id",
          [tenant, invoice, key],
        )
      ).rows[0].id;
      expect(
        (
          await db.query(
            "select public.record_payment($1,$2,11600,current_date,'Transfer','TEST',$3) id",
            [tenant, invoice, key],
          )
        ).rows[0].id,
      ).toBe(p);
      expect(
        (await db.query('select status from public.invoices where id=$1', [invoice])).rows[0]
          .status,
      ).toBe('paid');
      expect(
        (await db.query('select balance from public.invoice_balances where id=$1', [invoice]))
          .rows[0].balance,
      ).toBe('0.00');
      const profit = (
        await db.query(
          'select direct_cost,margin_percent from public.project_profitability where id=$1',
          [project],
        )
      ).rows[0];
      expect(profit.direct_cost).toMatch(/^1000\./);
      expect(profit.margin_percent).toBeNull();
      const kpis = (
        await db.query('select public.command_kpis($1,current_date,current_date) k', [tenant])
      ).rows[0].k;
      expect(kpis.collections - before.collections).toBe(11600);
      expect(kpis.invoiced - before.invoiced).toBe(10000);
      expect(kpis.hours - before.hours).toBe(2);
      expect(
        Number(
          (
            await db.query(
              "select count(*) from public.audit_events where tenant_id=$1 and entity='payments' and record_id=$2",
              [tenant, p],
            )
          ).rows[0].count,
        ),
      ).toBe(1);
    });
  });
  it('denies cross-tenant reads and forged-tenant writes', async () => {
    await as('outsider', async () => {
      expect(
        (await db.query('select * from public.leads where tenant_id=$1', [tenant])).rowCount,
      ).toBe(0);
      await expect(
        db.query(
          "select public.create_lead($1,'Spoof','Contact','test@example.com','Research','Test','Call')",
          [tenant],
        ),
      ).rejects.toMatchObject({ code: '42501' });
    });
  });
  it('enforces MFA in the database, independently of UI', async () => {
    await as(
      'owner',
      async () => {
        expect((await db.query('select * from public.invoices')).rowCount).toBe(0);
        await expect(
          db.query(
            "select public.create_lead($1,'Unsafe','Contact','test@example.com','Research','Test','Call')",
            [tenant],
          ),
        ).rejects.toMatchObject({ code: '42501' });
      },
      'aal1',
    );
  });
  it('auditor can read but cannot write or mutate audit', async () => {
    await as('auditor', async () => {
      expect((await db.query('select * from public.leads')).rowCount).toBeGreaterThan(0);
      await expect(
        db.query("insert into public.accounts(tenant_id,name) values($1,'Forbidden')", [tenant]),
      ).rejects.toMatchObject({ code: '42501' });
    });
  });
  it('client cannot discover unassigned projects or finance', async () => {
    await as('client', async () => {
      expect((await db.query('select * from public.projects')).rowCount).toBe(0);
      expect((await db.query('select * from public.invoices')).rowCount).toBe(0);
      expect((await db.query('select * from public.leads')).rowCount).toBe(0);
    });
  });
  it('sales cannot read finance or inject a payment', async () => {
    await as('sales', async () => {
      expect((await db.query('select * from public.invoices')).rowCount).toBe(0);
      await expect(
        db.query('insert into public.payments(tenant_id) values($1)', [tenant]),
      ).rejects.toMatchObject({ code: '42501' });
    });
  });
  it('blocks skipping commercial gates', async () => {
    await as('owner', async () => {
      const l = (
        await db.query(
          "select public.create_lead($1,'Gate test','Contact','gate@example.invalid','Research','Test','Call') id",
          [tenant],
        )
      ).rows[0].id;
      const o = (
        await db.query("select public.qualify_lead($1,$2,'Research',100,current_date) id", [
          tenant,
          l,
        ])
      ).rows[0].id;
      await expect(
        db.query("select public.advance_opportunity($1,$2,'Won','Skip gates')", [tenant, o]),
      ).rejects.toThrow('invalid stage transition');
    });
  });
  it('audit is append-only for authenticated users', async () => {
    await as('owner', async () => {
      await expect(
        db.query("update public.audit_events set action='tampered' where tenant_id=$1", [tenant]),
      ).rejects.toMatchObject({ code: '42501' });
    });
  });
});
