-- Initial Owner bootstrap for NEW AUREX-STAGING only.
-- Requires exactly one confirmed Auth user and no existing organization/membership.
-- Contains no passwords, API keys, demo users or operational sample records.
begin;
set local search_path = public, extensions;
do $$
declare
  owner_id uuid;
  tenant_id uuid;
begin
  if (select count(*) from auth.users) <> 1 then
    raise exception 'Expected exactly one Auth user. Stop and verify the intended Owner.';
  end if;
  select id into owner_id from auth.users where email_confirmed_at is not null;
  if owner_id is null then
    raise exception 'Confirm the email of the initial Owner in Authentication before continuing.';
  end if;
  if exists(select 1 from public.organizations_internal)
     or exists(select 1 from public.memberships) then
    raise exception 'Organization already initialized. Do not rerun initial Owner setup.';
  end if;
  insert into public.organizations_internal(name,demo)
    values ('AUREX STAGING',false) returning id into tenant_id;
  insert into public.memberships(tenant_id,user_id,role,active)
    values (tenant_id,owner_id,'owner',true);
  insert into public.kpi_definitions(tenant_id,name,code,formula,owner,frequency,drilldown)
    select tenant_id,n,c,f,o,q,d from (values
('Facturación','invoiced','SUM(invoices.subtotal) por issued_on y moneda','Finanzas','diaria','/finance?table=invoices'),
('Cobros','collections','SUM(payments.amount) por paid_on y moneda de factura','Finanzas','diaria','/finance?table=payments'),
('Cuentas por cobrar','receivables','SUM(subtotal + tax - payments), saldo actual','Finanzas','diaria','/finance?table=invoice_balances'),
('Cartera vencida','overdue','SUM(balance) donde due_date < hoy','Finanzas','diaria','/finance?table=invoice_balances'),
('Pipeline ponderado','pipeline','SUM(amount * probability / 100), abiertas por close_date','Ventas','tiempo real','/crm?table=opportunities'),
('Proyectos activos','active_projects','COUNT(projects) donde status=active, saldo actual','Operaciones','diaria','/projects'),
('Horas','hours','SUM(minutes) / 60 por work_date','Operaciones','diaria','/work?table=time_entries'),
('Costo directo','direct_cost','SUM(horas * costo histórico) + gastos aprobados, acumulado','Finanzas','diaria','/finance?table=project_profitability')
)p(n,c,f,o,q,d);

end;
$$;
commit;
select 'AUREX Owner ready' as result;
