create table public.phase_gate_reviews (
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.organizations_internal,
 project_id uuid not null,phase_id uuid not null,name text not null,evidence text not null check(length(evidence)>=10),
 approved_by uuid not null references auth.users,created_by uuid references auth.users default auth.uid(),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),archived_at timestamptz,
 foreign key(tenant_id,project_id,phase_id) references public.phases(tenant_id,project_id,id),unique(phase_id)
);
alter table public.phase_gate_reviews enable row level security;
create policy gate_read on public.phase_gate_reviews for select to authenticated using(public.allowed(tenant_id,'projects') and public.scoped(tenant_id,project_id));
grant select on public.phase_gate_reviews to authenticated;
create trigger audit after insert on public.phase_gate_reviews for each row execute function public.audit_change();
-- Direct writes cannot bypass the gate transaction.
drop policy insert_rows on public.phases;
drop policy update_rows on public.phases;
create function public.approve_gate(t uuid,p uuid,evidence text) returns uuid language plpgsql security definer set search_path='' as $$
declare phase public.phases;r uuid;
begin
 select * into strict phase from public.phases where tenant_id=t and id=p for update;
 perform public.require_access(t,'projects',phase.project_id);
 if not exists(select 1 from public.memberships where tenant_id=t and user_id=auth.uid() and role in ('owner','operations','pm') and active) then raise exception 'reviewer permission required' using errcode='42501'; end if;
 if length(trim(evidence))<10 then raise exception 'gate evidence required'; end if;
 if exists(select 1 from public.phases where tenant_id=t and project_id=phase.project_id and position<phase.position and approved_at is null) then raise exception 'previous gates incomplete'; end if;
 select id into r from public.phase_gate_reviews where phase_id=p;
 if r is not null then return r; end if;
 insert into public.phase_gate_reviews(tenant_id,project_id,phase_id,name,evidence,approved_by) values(t,phase.project_id,p,'Gate aprobado: '||phase.name,evidence,auth.uid()) returning id into r;
 update public.phases set approved_at=now(),approved_by=auth.uid() where id=p;
 return r;
end;$$;
create function public.approve_expense(t uuid,e uuid,approved boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare expense public.expenses;
begin
 perform public.require_access(t,'finance');select * into strict expense from public.expenses where tenant_id=t and id=e for update;
 if expense.status!='pending' then raise exception 'expense already reviewed'; end if;
 update public.expenses set status=case when approved then 'approved' else 'rejected' end where id=e;
 return e;
end;$$;
-- Status may only be changed by the approval RPC (definer), not a direct REST edit.
drop policy update_rows on public.expenses;
drop policy insert_rows on public.expenses;
create policy expense_draft on public.expenses for insert to authenticated with check(public.allowed(tenant_id,'finance',true) and public.scoped(tenant_id,project_id) and status='pending');
create function public.set_cost_rate(t uuid,u uuid,rate numeric,effective date) returns uuid language plpgsql security definer set search_path='' as $$
declare r uuid;begin
 perform public.require_access(t,'finance');
 insert into public.role_cost_rates(tenant_id,user_id,cost_per_hour,effective_from) values(t,u,rate,effective) returning id into r;return r;
end;$$;
drop policy update_rows on public.role_cost_rates;
create function public.attest_costs(t uuid,p uuid,complete boolean) returns uuid language plpgsql security definer set search_path='' as $$
begin perform public.require_access(t,'finance',p);update public.projects set costs_complete=complete where id=p and tenant_id=t;if not found then raise exception 'project not found';end if;return p;end;$$;
create view public.ar_aging with(security_invoker=true) as
select tenant_id,currency,
 sum(balance) filter(where days_overdue=0) current_balance,
 sum(balance) filter(where days_overdue between 1 and 30) overdue_1_30,
 sum(balance) filter(where days_overdue between 31 and 60) overdue_31_60,
 sum(balance) filter(where days_overdue between 61 and 90) overdue_61_90,
 sum(balance) filter(where days_overdue>90) overdue_90_plus
from public.invoice_balances where balance>0 group by tenant_id,currency;
create view public.capacity_summary with(security_invoker=true) as
select c.id,c.tenant_id,c.user_id,c.name,c.week_start,c.created_at,c.hours available_hours,
 coalesce(a.absent_hours,0) absent_hours,
 greatest(c.hours-coalesce(a.absent_hours,0),0) net_hours,
 coalesce(t.planned_hours,0) planned_hours,coalesce(e.actual_hours,0) actual_hours
from public.capacity_calendar c
left join lateral(select sum(hours * (least(ends_on,c.week_start+6)-greatest(starts_on,c.week_start)+1)::numeric/(ends_on-starts_on+1)) absent_hours from public.absences where tenant_id=c.tenant_id and user_id=c.user_id and starts_on<=c.week_start+6 and ends_on>=c.week_start)a on true
left join lateral(select sum(estimated_hours) planned_hours from public.tasks where tenant_id=c.tenant_id and owner_id=c.user_id and due_date between c.week_start and c.week_start+6 and status!='done')t on true
left join lateral(select sum(minutes)::numeric/60 actual_hours from public.time_entries where tenant_id=c.tenant_id and user_id=c.user_id and work_date between c.week_start and c.week_start+6)e on true;
grant select on public.ar_aging,public.capacity_summary to authenticated;
revoke execute on all functions in schema public from public,anon;
grant execute on all functions in schema public to authenticated;
