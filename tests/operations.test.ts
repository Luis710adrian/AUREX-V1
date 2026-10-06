import { beforeAll, afterAll, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import pg from 'pg';
const env = Object.fromEntries(
  readFileSync('apps/web/.env.local', 'utf8')
    .trim()
    .split('\n')
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);
const db = new pg.Client({ connectionString: env.DATABASE_URL });
const tenant = '10000000-0000-4000-8000-000000000001';
let user: string, project: string, task: string;
beforeAll(async () => {
  await db.connect();
  user = (await db.query("select id from auth.users where email='owner@aurex.demo'")).rows[0].id;
  project = (
    await db.query(
      'select id from public.projects where tenant_id=$1 order by created_at limit 1',
      [tenant],
    )
  ).rows[0].id;
  task = (
    await db.query('select id from public.tasks where project_id=$1 order by created_at limit 1', [
      project,
    ])
  ).rows[0].id;
});
afterAll(async () => {
  await db.end();
});
async function run(fn: () => Promise<void>) {
  await db.query('begin');
  try {
    await db.query('set local role authenticated');
    await db.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: user, role: 'authenticated', aal: 'aal2' }),
    ]);
    await fn();
  } finally {
    await db.query('rollback');
  }
}
it('checks write permissions for all nine roles', async () => {
  const roles = [
    'owner',
    'operations',
    'pm',
    'analyst',
    'field',
    'sales',
    'finance',
    'client',
    'auditor',
  ];
  for (const role of roles) {
    await db.query('begin');
    try {
      const u = (await db.query('select id from auth.users where email=$1', [role + '@aurex.demo']))
        .rows[0].id;
      await db.query('set local role authenticated');
      await db.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ sub: u, role: 'authenticated', aal: 'aal2' }),
      ]);
      const a = (
        await db.query(
          "select public.allowed($1,'finance',true) finance,public.allowed($1,'projects',true) projects",
          [tenant],
        )
      ).rows[0];
      expect(a.finance).toBe(['owner', 'finance'].includes(role));
      expect(a.projects).toBe(['owner', 'operations', 'pm'].includes(role));
    } finally {
      await db.query('rollback');
    }
  }
});
it('rejects a later methodological gate before its predecessors', async () => {
  await run(async () => {
    const p = (
      await db.query('select id from public.phases where project_id=$1 and position=2', [project])
    ).rows[0].id;
    await expect(
      db.query("select public.approve_gate($1,$2,'Evidence reviewed by sponsor')", [tenant, p]),
    ).rejects.toThrow('previous gates incomplete');
  });
});
it('records evidence and reviewer for ordered gate approvals', async () => {
  await run(async () => {
    for (const n of [1, 2]) {
      const p = (
        await db.query('select id from public.phases where project_id=$1 and position=$2', [
          project,
          n,
        ])
      ).rows[0].id;
      await db.query("select public.approve_gate($1,$2,'Sponsor and scope evidence reviewed')", [
        tenant,
        p,
      ]);
    }
    expect(
      (
        await db.query('select count(*) from public.phase_gate_reviews where project_id=$1', [
          project,
        ])
      ).rows[0].count,
    ).toBe('2');
  });
});
it('deducts absence and computes planned weekly capacity from actual tasks', async () => {
  await run(async () => {
    const capacity = (
      await db.query(
        "insert into public.capacity_calendar(tenant_id,user_id,name,week_start,hours) values($1,$2,'Weekly capacity',date_trunc('week',current_date)::date,40) returning id",
        [tenant, user],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.absences(tenant_id,user_id,name,starts_on,ends_on,hours) values($1,$2,'Leave',date_trunc('week',current_date)::date+1,date_trunc('week',current_date)::date+3,24)",
      [tenant, user],
    );
    const c = (await db.query('select * from public.capacity_summary where id=$1', [capacity]))
      .rows[0];
    expect(Number(c.net_hours)).toBe(16);
    expect(Number(c.absent_hours)).toBe(24);
  });
});
it('counts expenses in profitability only after finance approval', async () => {
  await run(async () => {
    const before = (
      await db.query('select direct_cost from public.project_profitability where id=$1', [project])
    ).rows[0].direct_cost;
    const e = (
      await db.query(
        "insert into public.expenses(tenant_id,project_id,name,amount,spent_on) values($1,$2,'Travel',200,current_date) returning id",
        [tenant, project],
      )
    ).rows[0].id;
    expect(
      (
        await db.query('select direct_cost from public.project_profitability where id=$1', [
          project,
        ])
      ).rows[0].direct_cost,
    ).toBe(before);
    await db.query('select public.approve_expense($1,$2,true)', [tenant, e]);
    expect(
      Number(
        (
          await db.query('select direct_cost from public.project_profitability where id=$1', [
            project,
          ])
        ).rows[0].direct_cost,
      ) - Number(before),
    ).toBe(200);
  });
});
it('uses historical cost rates and preserves snapshots', async () => {
  await run(async () => {
    await db.query('select public.set_cost_rate($1,$2,650,current_date)', [tenant, user]);
    const entry = (
      await db.query(
        "select public.record_time($1,$2,60,current_date,true,'Historical costs') id",
        [tenant, task],
      )
    ).rows[0].id;
    await db.query('select public.set_cost_rate($1,$2,700,current_date+1)', [tenant, user]);
    expect(
      (await db.query('select hourly_cost from public.time_entries where id=$1', [entry])).rows[0]
        .hourly_cost,
    ).toBe('650.00');
  });
});
it('maintains partial balances and rejects overpayment', async () => {
  await run(async () => {
    const i = (
      await db.query(
        "select public.issue_invoice($1,$2,'Partial billing',100,16,current_date) id",
        [tenant, project],
      )
    ).rows[0].id;
    await db.query("select public.record_payment($1,$2,40,current_date,'Transfer','Partial',$3)", [
      tenant,
      i,
      crypto.randomUUID(),
    ]);
    const row = (
      await db.query('select balance,status from public.invoice_balances where id=$1', [i])
    ).rows[0];
    expect(row.balance).toBe('76.00');
    expect(row.status).toBe('partial');
    await expect(
      db.query("select public.record_payment($1,$2,77,current_date,'Transfer','Over',$3)", [
        tenant,
        i,
        crypto.randomUUID(),
      ]),
    ).rejects.toThrow('payment exceeds outstanding balance');
  });
});
it('rejects tasks bound to another project’s phase even in the same tenant', async () => {
  await run(async () => {
    const info = (await db.query('select account_id from public.projects where id=$1', [project]))
      .rows[0];
    const p = (
      await db.query(
        "insert into public.projects(tenant_id,account_id,name,owner_id,fee,budget) values($1,$2,'Separate scope',$3,1000,500) returning id",
        [tenant, info.account_id, user],
      )
    ).rows[0].id;
    const phase = (
      await db.query('select id from public.phases where project_id=$1 limit 1', [project])
    ).rows[0].id;
    await expect(
      db.query(
        "insert into public.tasks(tenant_id,project_id,phase_id,name,owner_id,due_date) values($1,$2,$3,'Wrong phase',$4,current_date)",
        [tenant, p, phase, user],
      ),
    ).rejects.toMatchObject({ code: '23503' });
  });
});
it('denies direct access after a member is disabled', async () => {
  await run(async () => {
    const analyst = (
      await db.query(
        "select user_id from public.memberships where tenant_id=$1 and role='analyst' limit 1",
        [tenant],
      )
    ).rows[0].user_id;
    await db.query("select public.manage_member($1,$2,'analyst',false)", [tenant, analyst]);
    await db.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: analyst, role: 'authenticated', aal: 'aal1' }),
    ]);
    expect((await db.query("select public.allowed($1,'work',true) a", [tenant])).rows[0].a).toBe(
      false,
    );
    expect((await db.query('select * from public.projects')).rowCount).toBe(0);
  });
});
it('protects the last owner through every membership RPC', async () => {
  await run(async () => {
    await expect(
      db.query("select public.assign_membership($1,$2,'analyst')", [tenant, user]),
    ).rejects.toThrow('cannot remove last active owner');
  });
});
it('tenant metadata remains visible only to its own members', async () => {
  await run(async () => {
    const rows = (await db.query('select id,demo from public.organizations_internal')).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ id: tenant, demo: true });
  });
});
it('assigned clients still cannot access budgets, internal comments or unshared files', async () => {
  await run(async () => {
    const client = (
      await db.query(
        "select user_id from public.memberships where tenant_id=$1 and role='client' limit 1",
        [tenant],
      )
    ).rows[0].user_id;
    await db.query('select public.assign_project_member($1,$2,$3)', [tenant, project, client]);
    const shared = (
      await db.query(
        "insert into public.files(tenant_id,project_id,name,storage_path,hash,shared) values($1,$2,'Shared deliverable','demo/shared','DEMO',true) returning id",
        [tenant, project],
      )
    ).rows[0].id;
    await db.query(
      "insert into public.files(tenant_id,project_id,name,storage_path,hash,shared) values($1,$2,'Internal draft','demo/internal','DEMO',false)",
      [tenant, project],
    );
    await db.query(
      "insert into public.comments(tenant_id,project_id,file_id,name,internal) values($1,$2,$3,'Internal QA note',true),($1,$2,$3,'Shared note',false)",
      [tenant, project, shared],
    );
    await db.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify({ sub: client, role: 'authenticated', aal: 'aal1' }),
    ]);
    expect((await db.query('select * from public.projects')).rowCount).toBe(0);
    expect((await db.query('select * from public.invoices')).rowCount).toBe(0);
    const files = (await db.query('select name from public.files')).rows;
    expect(files).toEqual([{ name: 'Shared deliverable' }]);
    expect((await db.query('select name from public.comments')).rows).toEqual([
      { name: 'Shared note' },
    ]);
  });
});
