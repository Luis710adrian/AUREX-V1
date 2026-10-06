-- Lock immutable business transitions behind the transactional RPC API.
drop policy if exists insert_rows on public.opportunities;
drop policy if exists update_rows on public.opportunities;
drop policy if exists insert_rows on public.leads;
drop policy if exists update_rows on public.leads;
create function public.guard_update() returns trigger language plpgsql set search_path='' as $$ begin
 if new.tenant_id<>old.tenant_id or new.id<>old.id or new.created_by is distinct from old.created_by or new.created_at<>old.created_at then raise exception 'immutable identity fields'; end if;
 if tg_table_name='projects' and (to_jsonb(new)->'fee' is distinct from to_jsonb(old)->'fee' or to_jsonb(new)->'budget' is distinct from to_jsonb(old)->'budget' or to_jsonb(new)->'costs_complete' is distinct from to_jsonb(old)->'costs_complete') and auth.uid() is not null and not public.allowed(new.tenant_id,'finance',true) then raise exception 'finance permission required' using errcode='42501'; end if;
 return new;
end; $$;
do $$ declare t text;begin for t in select c.table_name from information_schema.columns c join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name where c.table_schema='public' and c.column_name='updated_at' and t.table_type='BASE TABLE' loop execute format('create trigger guard_update before update on public.%I for each row execute function public.guard_update()',t);end loop;end;$$;
create function public.guard_member_owner() returns trigger language plpgsql security definer set search_path='' as $$
declare u uuid; begin
 u=coalesce((to_jsonb(new)->>'owner_id')::uuid,(to_jsonb(new)->>'user_id')::uuid);
 if u is not null and not exists(select 1 from public.memberships where tenant_id=new.tenant_id and user_id=u and active) then raise exception 'owner must belong to tenant'; end if;
 return new;
end;$$;
do $$ declare t text;begin foreach t in array array['leads','opportunities','projects','tasks','risks','project_members','role_cost_rates','time_entries','absences','capacity_calendar'] loop execute format('create trigger guard_member before insert or update on public.%I for each row execute function public.guard_member_owner()',t);end loop;end;$$;
-- A task/phase or time entry cannot point to a different project in the same tenant.
alter table public.tasks add unique(tenant_id,project_id,id);
alter table public.phases add unique(tenant_id,project_id,id);
alter table public.tasks add foreign key(tenant_id,project_id,phase_id) references public.phases(tenant_id,project_id,id);
alter table public.time_entries add foreign key(tenant_id,project_id,task_id) references public.tasks(tenant_id,project_id,id);
alter table public.invoices add unique(tenant_id,project_id,id);
alter table public.payments add foreign key(tenant_id,project_id,invoice_id) references public.invoices(tenant_id,project_id,id);
create function public.no_audit_mutation() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'audit is append-only'; end; $$;
create trigger append_only before update or delete on public.audit_events for each row execute function public.no_audit_mutation();
create trigger audit after insert or update or delete on public.memberships for each row execute function public.audit_change();
create trigger audit after insert or update or delete on public.project_members for each row execute function public.audit_change();
create or replace view public.project_profitability with(security_invoker=true) as
select p.id,p.tenant_id,p.name,p.currency,p.fee,p.budget,p.costs_complete,
 coalesce(t.cost,0)+coalesce(e.cost,0) direct_cost,
 case when p.costs_complete and p.fee>0 then round((p.fee-coalesce(t.cost,0)-coalesce(e.cost,0))/p.fee*100,2) end margin_percent,p.created_at
from public.projects p left join(select project_id,sum(minutes::numeric/60*hourly_cost) cost from public.time_entries group by project_id)t on t.project_id=p.id
left join(select project_id,sum(amount) cost from public.expenses where status='approved' group by project_id)e on e.project_id=p.id;
revoke execute on all functions in schema public from public,anon;
grant execute on all functions in schema public to authenticated;
