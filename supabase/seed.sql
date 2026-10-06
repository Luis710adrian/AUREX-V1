-- Local development only. No operational AUREX data and no reusable passwords.
insert into public.organizations_internal(id,name,demo) values
('10000000-0000-4000-8000-000000000001','AUREX DEMO',true),
('10000000-0000-4000-8000-000000000002','Tenant aislado DEMO',true);
insert into public.kpi_definitions(tenant_id,name,code,formula,owner,frequency,drilldown)
select '10000000-0000-4000-8000-000000000001',n,c,f,o,q,d from (values
('Facturación','invoiced','SUM(invoices.subtotal) por issued_on y moneda','Finanzas','diaria','/finance?table=invoices'),
('Cobros','collections','SUM(payments.amount) por paid_on y moneda de factura','Finanzas','diaria','/finance?table=payments'),
('Cuentas por cobrar','receivables','SUM(subtotal + tax - payments), saldo actual','Finanzas','diaria','/finance?table=invoice_balances'),
('Cartera vencida','overdue','SUM(balance) donde due_date < hoy','Finanzas','diaria','/finance?table=invoice_balances'),
('Pipeline ponderado','pipeline','SUM(amount * probability / 100), abiertas por close_date','Ventas','tiempo real','/crm?table=opportunities'),
('Proyectos activos','active_projects','COUNT(projects) donde status=active, saldo actual','Operaciones','diaria','/projects'),
('Horas','hours','SUM(minutes) / 60 por work_date','Operaciones','diaria','/work?table=time_entries'),
('Costo directo','direct_cost','SUM(horas * costo histórico) + gastos aprobados, acumulado','Finanzas','diaria','/finance?table=project_profitability')
)p(n,c,f,o,q,d);
