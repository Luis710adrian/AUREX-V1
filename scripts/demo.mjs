import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
const config = Object.fromEntries(
  readFileSync('apps/web/.env.local', 'utf8')
    .trim()
    .split('\n')
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
const url = new URL(config.NEXT_PUBLIC_SUPABASE_URL);
if (!['127.0.0.1', 'localhost'].includes(url.hostname))
  throw new Error('DEMO bootstrap is limited to local Supabase');
const info = {
  API_URL: config.NEXT_PUBLIC_SUPABASE_URL,
  SERVICE_ROLE_KEY: config.SUPABASE_SERVICE_ROLE_KEY,
};
const admin = createClient(info.API_URL, info.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const db = new pg.Client({ connectionString: config.DATABASE_URL });
await db.connect();
const tenant = '10000000-0000-4000-8000-000000000001';
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
const { data: userList, error: listError } = await admin.auth.admin.listUsers();
if (listError) throw listError;
const users = userList.users;
for (const role of [...roles, 'outsider']) {
  const email = role + '@aurex.demo';
  let user = users.find((u) => u.email === email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: config.AUREX_DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
  }

  await db.query(
    'insert into public.memberships(tenant_id,user_id,role) values($1,$2,$3) on conflict(tenant_id,user_id) do nothing',
    [
      role === 'outsider' ? '10000000-0000-4000-8000-000000000002' : tenant,
      user.id,
      role === 'outsider' ? 'sales' : role,
    ],
  );
  if (role === 'owner') {
    await db.query(
      "insert into public.role_cost_rates(tenant_id,user_id,cost_per_hour,effective_from) values($1,$2,500,'2020-01-01') on conflict do nothing",
      [tenant, user.id],
    );
    const { rows } = await db.query('select id from public.leads where tenant_id=$1', [tenant]);
    if (!rows.length) {
      await db.query('begin');
      await db.query('set local role authenticated');
      await db.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify({ sub: user.id, role: 'authenticated', aal: 'aal2' }),
      ]);
      const l = (
        await db.query(
          "select public.create_lead($1,'DEMO · Comercio del Valle','Contacto DEMO','contacto@example.invalid','Diagnóstico de experiencia de clientes','Referencia DEMO','Programar discovery') id",
          [tenant],
        )
      ).rows[0].id;
      const o = (
        await db.query(
          "select public.qualify_lead($1,$2,'Research & BI',100000,current_date+30) id",
          [tenant, l],
        )
      ).rows[0].id;
      await db.query(
        "select public.create_proposal($1,$2,'Diagnóstico, levantamiento y presentación ejecutiva DEMO',current_date+90)",
        [tenant, o],
      );
      let project;
      for (const stage of ['Discovery', 'Solution Designed', 'Proposal Sent', 'Negotiation', 'Won'])
        project = (
          await db.query('select public.advance_opportunity($1,$2,$3,$4) id', [
            tenant,
            o,
            stage,
            'Gate comercial validado DEMO',
          ])
        ).rows[0].id;
      await db.query(
        "insert into public.tasks(tenant_id,project_id,name,owner_id,due_date,estimated_hours) values($1,$2,'DEMO · Diagnóstico inicial',$3,current_date+7,8)",
        [tenant, project, user.id],
      );
      await db.query('commit');
    }
  }
}
await db.end();
console.log(
  'DEMO users and persistent dataset prepared; passwords remain in ignored local configuration.',
);
