create function public.require_access(t uuid,d text,p uuid default null) returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.allowed(t,d,true) or (p is not null and not public.scoped(t,p)) then raise exception 'permission denied' using errcode='42501'; end if;
end; $$;
create function public.create_lead(t uuid,company text,contact text,email text,need text,source text,next_action text) returns uuid language plpgsql security definer set search_path='' as $$
declare a uuid;c uuid;l uuid;
begin
 perform public.require_access(t,'crm');
 if length(trim(company))<2 or length(trim(contact))<2 or email not like '%@%.%' or length(trim(need))<3 or length(trim(source))<2 or length(trim(next_action))<2 then raise exception 'invalid lead'; end if;
 insert into public.accounts(tenant_id,name) values(t,trim(company)) returning id into a;
 insert into public.contacts(tenant_id,account_id,name,email) values(t,a,trim(contact),lower(trim(email))) returning id into c;
 insert into public.leads(tenant_id,account_id,contact_id,name,source,need,owner_id,next_action) values(t,a,c,company,source,need,auth.uid(),next_action) returning id into l;
 return l;
end; $$;
create function public.qualify_lead(t uuid,l uuid,service text,amount numeric,close_date date) returns uuid language plpgsql security definer set search_path='' as $$
declare lead public.leads;o uuid;
begin
 perform public.require_access(t,'crm');
 select * into strict lead from public.leads where id=l and tenant_id=t for update;
 select id into o from public.opportunities where tenant_id=t and lead_id=l;
 if o is not null then return o; end if;
 if amount<=0 or length(trim(service))<2 or close_date is null then raise exception 'invalid opportunity'; end if;
 insert into public.opportunities(tenant_id,lead_id,account_id,contact_id,name,service,amount,owner_id,next_action,close_date) values(t,l,lead.account_id,lead.contact_id,lead.name,service,amount,lead.owner_id,lead.next_action,close_date) returning id into o;
 insert into public.opportunity_stage_history(tenant_id,opportunity_id,to_stage,reason) values(t,o,'Qualified','Lead calificado');
 update public.leads set status='converted' where id=l;
 return o;
end; $$;
create function public.create_proposal(t uuid,o uuid,scope text,valid_until date) returns uuid language plpgsql security definer set search_path='' as $$
declare opp public.opportunities;p uuid;
begin
 perform public.require_access(t,'crm');
 select * into strict opp from public.opportunities where id=o and tenant_id=t for update;
 if opp.stage in ('Won','Lost') or length(trim(scope))<5 or valid_until<current_date then raise exception 'invalid proposal'; end if;
 insert into public.proposals(tenant_id,opportunity_id,name,scope,amount,version,valid_until,approved) values(t,o,'Propuesta · '||opp.name,scope,opp.amount,(select coalesce(max(version),0)+1 from public.proposals where opportunity_id=o),valid_until,true) returning id into p;
 return p;
end; $$;
create function public.advance_opportunity(t uuid,o uuid,target text,reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare opp public.opportunities;p uuid;c uuid;proposal public.proposals;n integer;sequence text[]:=array['Qualified','Discovery','Solution Designed','Proposal Sent','Negotiation','Won'];
begin
 perform public.require_access(t,'crm');
 select * into strict opp from public.opportunities where id=o and tenant_id=t for update;
 if target='Won' and opp.stage='Won' then select id into p from public.projects where tenant_id=t and opportunity_id=o; return p; end if;
 if opp.stage in ('Won','Lost') or length(trim(reason))<3 then raise exception 'closed opportunity or reason missing'; end if;
 if target!='Lost' and array_position(sequence,target) is distinct from array_position(sequence,opp.stage)+1 then raise exception 'invalid stage transition'; end if;
 if target in ('Proposal Sent','Negotiation','Won') then
 select * into proposal from public.proposals where tenant_id=t and opportunity_id=o and approved and valid_until>=current_date order by version desc limit 1;
 if proposal.id is null then raise exception 'approved valid proposal required'; end if;
 end if;
 update public.opportunities set stage=target,probability=case target when 'Won' then 100 when 'Lost' then 0 when 'Discovery' then 35 when 'Solution Designed' then 50 when 'Proposal Sent' then 65 when 'Negotiation' then 85 else probability end,lost_reason=case when target='Lost' then reason end where id=o;
 insert into public.opportunity_stage_history(tenant_id,opportunity_id,from_stage,to_stage,reason) values(t,o,opp.stage,target,reason);
 if target='Won' then
 update public.accounts set relationship='client' where id=opp.account_id and tenant_id=t;
 insert into public.contracts(tenant_id,opportunity_id,account_id,name,scope,fee,currency) values(t,o,opp.account_id,'Contrato · '||opp.name,proposal.scope,proposal.amount,opp.currency) returning id into c;
 insert into public.projects(tenant_id,opportunity_id,account_id,contract_id,name,owner_id,fee,budget,currency) values(t,o,opp.account_id,c,opp.name,opp.owner_id,proposal.amount,round(proposal.amount*0.7,2),opp.currency) returning id into p;
 insert into public.project_members(tenant_id,project_id,user_id) values(t,p,opp.owner_id);
 insert into public.project_budgets(tenant_id,project_id,name,amount) values(t,p,'Baseline v1',round(proposal.amount*0.7,2));
 for n in 1..6 loop
 insert into public.phases(tenant_id,project_id,position,name,gate_criteria) values(t,p,n,(array['Diagnóstico inicial','Diseño del estudio','Levantamiento','Análisis estratégico','Priorización','Presentación ejecutiva'])[n],(array['Problem statement, sponsor, decisión objetivo y fuentes aprobados','Scope baseline, cronograma, presupuesto e instrumento aprobados','Muestra cerrada, evidencias y QA completos','Dataset congelado y hallazgos revisados','Matriz, responsables, impacto y riesgos revisados','Entregables aprobados, sesión y acta de decisiones'])[n]);
 end loop;
 insert into public.notifications(tenant_id,project_id,user_id,name) values(t,p,opp.owner_id,'Proyecto creado desde oportunidad ganada');
 end if;
 return coalesce(p,o);
end; $$;
create function public.record_time(t uuid,task uuid,minutes integer,work_date date,billable boolean,description text) returns uuid language plpgsql security definer set search_path='' as $$
declare item public.tasks;rate numeric;entry uuid;
begin
 select * into strict item from public.tasks where id=task and tenant_id=t;
 perform public.require_access(t,'work',item.project_id);
 if not exists(select 1 from public.project_members where tenant_id=t and project_id=item.project_id and user_id=auth.uid()) then raise exception 'project membership required' using errcode='42501'; end if;
 select cost_per_hour into rate from public.role_cost_rates where tenant_id=t and user_id=auth.uid() and effective_from<=work_date order by effective_from desc limit 1;
 if rate is null then raise exception 'effective cost rate missing'; end if;
 if length(trim(description))<3 then raise exception 'description required'; end if;
 insert into public.time_entries(tenant_id,project_id,task_id,user_id,name,minutes,billable,work_date,hourly_cost) values(t,item.project_id,task,auth.uid(),description,minutes,billable,work_date,rate) returning id into entry;
 return entry;
end; $$;
create function public.issue_invoice(t uuid,p uuid,concept text,subtotal numeric,tax numeric,due date) returns uuid language plpgsql security definer set search_path='' as $$
declare project public.projects;i uuid;
begin
 perform public.require_access(t,'finance',p);
 select * into strict project from public.projects where tenant_id=t and id=p;
 if length(trim(concept))<3 then raise exception 'concept required'; end if;
 insert into public.invoices(tenant_id,project_id,account_id,name,subtotal,tax,currency,issued_on,due_date) values(t,p,project.account_id,concept,subtotal,tax,project.currency,current_date,due) returning id into i;
 return i;
end; $$;
create function public.record_payment(t uuid,i uuid,amount numeric,paid_on date,method text,reference text,key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare invoice public.invoices;paid numeric;p uuid;existing public.payments;
begin
 perform public.require_access(t,'finance');
 select * into strict invoice from public.invoices where id=i and tenant_id=t for update;
 select * into existing from public.payments where tenant_id=t and idempotency_key=key;
 if existing.id is not null then
 if existing.invoice_id!=i or existing.amount!=amount or existing.paid_on!=paid_on or existing.method!=method or existing.reference!=reference then raise exception 'idempotency key conflict'; end if;
 return existing.id;
 end if;
 if length(trim(method))<2 or length(trim(reference))<2 or amount<=0 or paid_on>current_date then raise exception 'invalid payment'; end if;
 select coalesce(sum(x.amount),0) into paid from public.payments x where x.invoice_id=i;
 if paid+amount>invoice.subtotal+invoice.tax then raise exception 'payment exceeds outstanding balance'; end if;
 insert into public.payments(tenant_id,project_id,invoice_id,name,amount,paid_on,method,reference,idempotency_key) values(t,invoice.project_id,i,'Pago · '||reference,amount,paid_on,method,reference,key) returning id into p;
 update public.invoices set status=case when paid+amount=invoice.subtotal+invoice.tax then 'paid' else 'partial' end where id=i;
 return p;
end; $$;
-- Invoker views preserve row-level security. No cross-currency sums.
create view public.invoice_balances with(security_invoker=true) as
select i.*,coalesce(p.paid,0) paid,i.subtotal+i.tax-coalesce(p.paid,0) balance,greatest(current_date-i.due_date,0) days_overdue
from public.invoices i left join (select invoice_id,sum(amount) paid from public.payments group by invoice_id) p on p.invoice_id=i.id;
create view public.project_profitability with(security_invoker=true) as
select p.id,p.tenant_id,p.name,p.currency,p.fee,p.budget,p.costs_complete,
 coalesce(t.cost,0)+coalesce(e.cost,0) direct_cost,
 case when p.costs_complete and p.fee>0 then round((p.fee-coalesce(t.cost,0)-coalesce(e.cost,0))/p.fee*100,2) end margin_percent
from public.projects p left join(select project_id,sum(minutes::numeric/60*hourly_cost) cost from public.time_entries group by project_id)t on t.project_id=p.id
left join(select project_id,sum(amount) cost from public.expenses where status='approved' group by project_id)e on e.project_id=p.id;
create function public.command_kpis(t uuid,start_on date,end_on date,money text default 'MXN') returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 if not public.allowed(t,'finance') then raise exception 'finance permission required' using errcode='42501'; end if;
 if end_on<start_on then raise exception 'invalid date range'; end if;
 select jsonb_build_object(
 'invoiced',coalesce((select sum(subtotal) from public.invoices where tenant_id=t and currency=money and issued_on between start_on and end_on),0),
 'collections',coalesce((select sum(p.amount) from public.payments p join public.invoices i on i.id=p.invoice_id where p.tenant_id=t and i.currency=money and p.paid_on between start_on and end_on),0),
 'receivables',coalesce((select sum(balance) from public.invoice_balances where tenant_id=t and currency=money),0),
 'overdue',coalesce((select sum(balance) from public.invoice_balances where tenant_id=t and currency=money and due_date<current_date),0),
 'pipeline',case when public.allowed(t,'crm') then coalesce((select sum(amount*probability/100) from public.opportunities where tenant_id=t and currency=money and stage not in ('Won','Lost') and close_date between start_on and end_on),0) else null end,
 'active_projects',(select count(*) from public.projects where tenant_id=t and currency=money and status='active'),
 'hours',coalesce((select sum(e.minutes)::numeric/60 from public.time_entries e join public.projects p on p.id=e.project_id where e.tenant_id=t and p.currency=money and work_date between start_on and end_on),0),
 'direct_cost',coalesce((select sum(direct_cost) from public.project_profitability where tenant_id=t and currency=money),0)
 ) into result;
 return result;
end; $$;
grant select on public.invoice_balances,public.project_profitability to authenticated;
-- Functions are inaccessible anonymously; every security-definer RPC checks membership.
revoke execute on all functions in schema public from public,anon;
grant execute on all functions in schema public to authenticated;
