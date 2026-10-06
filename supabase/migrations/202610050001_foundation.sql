-- AUREX OS: PostgreSQL is the source of truth, not the browser.
create extension if not exists pgcrypto;
create type public.app_role as enum ('owner','operations','pm','analyst','field','sales','finance','client','auditor');
create table public.organizations_internal (id uuid primary key default gen_random_uuid(), name text not null, demo boolean not null default false, created_at timestamptz not null default now());
create table public.memberships (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, user_id uuid not null references auth.users, role public.app_role not null, active boolean not null default true, created_at timestamptz not null default now(), unique(tenant_id,user_id));
create table public.project_members (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, project_id uuid not null, user_id uuid not null references auth.users, unique(project_id,user_id));
create table public.permissions (role public.app_role not null, domain text not null, can_write boolean not null, primary key(role,domain));
insert into public.permissions
select r::public.app_role,d,w from (values
('owner','crm',true),('owner','projects',true),('owner','work',true),('owner','finance',true),('owner','research',true),('owner','marketing',true),('owner','data',true),('owner','files',true),('owner','admin',true),
('operations','crm',false),('operations','projects',true),('operations','work',true),('operations','research',true),('operations','files',true),
('pm','projects',true),('pm','work',true),('pm','research',true),('pm','files',true),
('analyst','projects',false),('analyst','work',true),('analyst','research',true),('analyst','files',true),
('field','projects',false),('field','work',true),('field','research',true),
('sales','crm',true),('sales','projects',false),('sales','marketing',true),('sales','files',true),
('finance','projects',false),('finance','work',false),('finance','finance',true),('finance','files',true),
('client','projects',false),('client','files',false),
('auditor','crm',false),('auditor','projects',false),('auditor','work',false),('auditor','finance',false),('auditor','research',false),('auditor','marketing',false),('auditor','data',false),('auditor','files',false)
) p(r,d,w);
create function public.allowed(t uuid,d text,writing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships m join public.permissions p on p.role=m.role where m.user_id=auth.uid() and m.tenant_id=t and m.active and p.domain=d and (not writing or p.can_write) and (m.role not in ('owner','finance') or coalesce(auth.jwt()->>'aal','aal1')='aal2'));
$$;
create function public.scoped(t uuid,p uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.tenant_id=t and m.active and (m.role in ('owner','operations','finance','sales','auditor') or exists(select 1 from public.project_members pm where pm.tenant_id=t and pm.project_id=p and pm.user_id=auth.uid())));
$$;
create table public.audit_events (id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.organizations_internal, actor_id uuid,entity text not null,record_id uuid not null,action text not null,old_data jsonb,new_data jsonb,created_at timestamptz not null default now());
create function public.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 insert into public.audit_events(tenant_id,actor_id,entity,record_id,action,old_data,new_data) values(coalesce(new.tenant_id,old.tenant_id),auth.uid(),tg_table_name,coalesce(new.id,old.id),tg_op,case when tg_op!='INSERT' then to_jsonb(old) end,case when tg_op!='DELETE' then to_jsonb(new) end);
 return coalesce(new,old); end;
$$;
create function public.touch_record() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); if tg_op='INSERT' and auth.uid() is not null then new.created_by=auth.uid(); end if; return new; end; $$;

create table public.accounts (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, name text not null check(length(name)>1), sector text, relationship text not null default 'prospect' check(relationship in ('prospect','client','archived')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.accounts(tenant_id,created_at);
alter table public.accounts enable row level security;
create trigger touch before insert or update on public.accounts for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.accounts for each row execute function public.audit_change();
create policy read_rows on public.accounts for select to authenticated using(public.allowed(tenant_id,'crm'));
create policy insert_rows on public.accounts for insert to authenticated with check(public.allowed(tenant_id,'crm',true));
create policy update_rows on public.accounts for update to authenticated using(public.allowed(tenant_id,'crm',true)) with check(public.allowed(tenant_id,'crm',true));

create table public.contacts (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, account_id uuid not null, name text not null, email text not null, consent boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.contacts(tenant_id,created_at);
alter table public.contacts enable row level security;
create trigger touch before insert or update on public.contacts for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.contacts for each row execute function public.audit_change();
create policy read_rows on public.contacts for select to authenticated using(public.allowed(tenant_id,'crm'));
create policy insert_rows on public.contacts for insert to authenticated with check(public.allowed(tenant_id,'crm',true));
create policy update_rows on public.contacts for update to authenticated using(public.allowed(tenant_id,'crm',true)) with check(public.allowed(tenant_id,'crm',true));
alter table public.contacts add foreign key(tenant_id,account_id) references public.accounts(tenant_id,id);

create table public.leads (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, account_id uuid not null, contact_id uuid not null, name text not null, source text not null, need text not null, owner_id uuid not null references auth.users, next_action text not null, status text not null default 'new' check(status in ('new','qualified','converted','lost')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.leads(tenant_id,created_at);
alter table public.leads enable row level security;
create trigger touch before insert or update on public.leads for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.leads for each row execute function public.audit_change();
create policy read_rows on public.leads for select to authenticated using(public.allowed(tenant_id,'crm'));
create policy insert_rows on public.leads for insert to authenticated with check(public.allowed(tenant_id,'crm',true));
create policy update_rows on public.leads for update to authenticated using(public.allowed(tenant_id,'crm',true)) with check(public.allowed(tenant_id,'crm',true));
alter table public.leads add foreign key(tenant_id,account_id) references public.accounts(tenant_id,id);
alter table public.leads add foreign key(tenant_id,contact_id) references public.contacts(tenant_id,id);

create table public.opportunities (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, lead_id uuid not null, account_id uuid not null, contact_id uuid not null, name text not null, service text not null, amount numeric(16,2) not null check(amount>0), currency text not null default 'MXN' check(currency in ('MXN','USD')), probability numeric(5,2) not null default 20 check(probability between 0 and 100), stage text not null default 'Qualified', owner_id uuid not null references auth.users, next_action text not null, close_date date not null, lost_reason text, unique(tenant_id,lead_id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.opportunities(tenant_id,created_at);
alter table public.opportunities enable row level security;
create trigger touch before insert or update on public.opportunities for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.opportunities for each row execute function public.audit_change();
create policy read_rows on public.opportunities for select to authenticated using(public.allowed(tenant_id,'crm'));
create policy insert_rows on public.opportunities for insert to authenticated with check(public.allowed(tenant_id,'crm',true));
create policy update_rows on public.opportunities for update to authenticated using(public.allowed(tenant_id,'crm',true)) with check(public.allowed(tenant_id,'crm',true));
alter table public.opportunities add foreign key(tenant_id,lead_id) references public.leads(tenant_id,id);
alter table public.opportunities add foreign key(tenant_id,account_id) references public.accounts(tenant_id,id);
alter table public.opportunities add foreign key(tenant_id,contact_id) references public.contacts(tenant_id,id);

create table public.opportunity_stage_history (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, opportunity_id uuid not null, from_stage text, to_stage text not null, reason text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.opportunity_stage_history(tenant_id,created_at);
alter table public.opportunity_stage_history enable row level security;
create trigger touch before insert or update on public.opportunity_stage_history for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.opportunity_stage_history for each row execute function public.audit_change();
create policy read_rows on public.opportunity_stage_history for select to authenticated using(public.allowed(tenant_id,'crm'));
alter table public.opportunity_stage_history add foreign key(tenant_id,opportunity_id) references public.opportunities(tenant_id,id);

create table public.proposals (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, opportunity_id uuid not null, name text not null, scope text not null, amount numeric(16,2) not null check(amount>0), version integer not null default 1, approved boolean not null default false, valid_until date not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.proposals(tenant_id,created_at);
alter table public.proposals enable row level security;
create trigger touch before insert or update on public.proposals for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.proposals for each row execute function public.audit_change();
create policy read_rows on public.proposals for select to authenticated using(public.allowed(tenant_id,'crm'));
alter table public.proposals add foreign key(tenant_id,opportunity_id) references public.opportunities(tenant_id,id);

create table public.contracts (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, opportunity_id uuid not null, account_id uuid not null, name text not null, scope text not null, fee numeric(16,2) not null check(fee>0), currency text not null default 'MXN', unique(tenant_id,opportunity_id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.contracts(tenant_id,created_at);
alter table public.contracts enable row level security;
create trigger touch before insert or update on public.contracts for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.contracts for each row execute function public.audit_change();
create policy read_rows on public.contracts for select to authenticated using(public.allowed(tenant_id,'crm'));
alter table public.contracts add foreign key(tenant_id,opportunity_id) references public.opportunities(tenant_id,id);
alter table public.contracts add foreign key(tenant_id,account_id) references public.accounts(tenant_id,id);

create table public.projects (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, opportunity_id uuid, account_id uuid not null, contract_id uuid, name text not null, owner_id uuid not null references auth.users, status text not null default 'active', currency text not null default 'MXN', fee numeric(16,2) not null check(fee>=0), budget numeric(16,2) not null check(budget>=0), costs_complete boolean not null default false, unique(tenant_id,opportunity_id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.projects(tenant_id,created_at);
alter table public.projects enable row level security;
create trigger touch before insert or update on public.projects for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.projects for each row execute function public.audit_change();
create policy read_rows on public.projects for select to authenticated using(public.allowed(tenant_id,'projects') and public.scoped(tenant_id,id));
create policy insert_rows on public.projects for insert to authenticated with check(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,id));
create policy update_rows on public.projects for update to authenticated using(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,id)) with check(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,id));
alter table public.projects add foreign key(tenant_id,opportunity_id) references public.opportunities(tenant_id,id);
alter table public.projects add foreign key(tenant_id,account_id) references public.accounts(tenant_id,id);
alter table public.projects add foreign key(tenant_id,contract_id) references public.contracts(tenant_id,id);

create table public.phases (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, project_id uuid not null, name text not null, position integer not null check(position between 1 and 6), gate_criteria text not null, approved_at timestamptz, approved_by uuid references auth.users, unique(project_id,position), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.phases(tenant_id,created_at);
alter table public.phases enable row level security;
create trigger touch before insert or update on public.phases for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.phases for each row execute function public.audit_change();
create policy read_rows on public.phases for select to authenticated using(public.allowed(tenant_id,'projects') and public.scoped(tenant_id,project_id));
create policy insert_rows on public.phases for insert to authenticated with check(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id));
create policy update_rows on public.phases for update to authenticated using(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id)) with check(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id));
alter table public.phases add foreign key(tenant_id,project_id) references public.projects(tenant_id,id);

create table public.milestones (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, project_id uuid not null, name text not null, due_date date not null, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.milestones(tenant_id,created_at);
alter table public.milestones enable row level security;
create trigger touch before insert or update on public.milestones for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.milestones for each row execute function public.audit_change();
create policy read_rows on public.milestones for select to authenticated using(public.allowed(tenant_id,'projects') and public.scoped(tenant_id,project_id));
create policy insert_rows on public.milestones for insert to authenticated with check(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id));
create policy update_rows on public.milestones for update to authenticated using(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id)) with check(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id));
alter table public.milestones add foreign key(tenant_id,project_id) references public.projects(tenant_id,id);

create table public.tasks (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, project_id uuid not null, phase_id uuid, name text not null, owner_id uuid not null references auth.users, status text not null default 'todo' check(status in ('todo','doing','blocked','done')), priority text not null default 'normal', due_date date not null, estimated_hours numeric(8,2) not null default 0 check(estimated_hours>=0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.tasks(tenant_id,created_at);
alter table public.tasks enable row level security;
create trigger touch before insert or update on public.tasks for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.tasks for each row execute function public.audit_change();
create policy read_rows on public.tasks for select to authenticated using(public.allowed(tenant_id,'projects') and public.scoped(tenant_id,project_id));
create policy insert_rows on public.tasks for insert to authenticated with check(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id));
create policy update_rows on public.tasks for update to authenticated using(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id)) with check(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id));
alter table public.tasks add foreign key(tenant_id,phase_id) references public.phases(tenant_id,id);
alter table public.tasks add foreign key(tenant_id,project_id) references public.projects(tenant_id,id);

create table public.role_cost_rates (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, user_id uuid not null references auth.users, cost_per_hour numeric(12,2) not null check(cost_per_hour>=0), effective_from date not null, unique(tenant_id,user_id,effective_from), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.role_cost_rates(tenant_id,created_at);
alter table public.role_cost_rates enable row level security;
create trigger touch before insert or update on public.role_cost_rates for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.role_cost_rates for each row execute function public.audit_change();
create policy read_rows on public.role_cost_rates for select to authenticated using(public.allowed(tenant_id,'finance'));
create policy insert_rows on public.role_cost_rates for insert to authenticated with check(public.allowed(tenant_id,'finance',true));
create policy update_rows on public.role_cost_rates for update to authenticated using(public.allowed(tenant_id,'finance',true)) with check(public.allowed(tenant_id,'finance',true));

create table public.time_entries (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, project_id uuid not null, task_id uuid not null, user_id uuid not null references auth.users, name text not null, minutes integer not null check(minutes>0 and minutes<=1440), billable boolean not null default true, work_date date not null, hourly_cost numeric(12,2) not null check(hourly_cost>=0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.time_entries(tenant_id,created_at);
alter table public.time_entries enable row level security;
create trigger touch before insert or update on public.time_entries for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.time_entries for each row execute function public.audit_change();
create policy read_rows on public.time_entries for select to authenticated using(public.allowed(tenant_id,'work') and public.scoped(tenant_id,project_id));
alter table public.time_entries add foreign key(tenant_id,task_id) references public.tasks(tenant_id,id);
alter table public.time_entries add foreign key(tenant_id,project_id) references public.projects(tenant_id,id);

create table public.project_budgets (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, project_id uuid not null, name text not null, amount numeric(16,2) not null check(amount>=0), unique(project_id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.project_budgets(tenant_id,created_at);
alter table public.project_budgets enable row level security;
create trigger touch before insert or update on public.project_budgets for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.project_budgets for each row execute function public.audit_change();
create policy read_rows on public.project_budgets for select to authenticated using(public.allowed(tenant_id,'finance') and public.scoped(tenant_id,project_id));
alter table public.project_budgets add foreign key(tenant_id,project_id) references public.projects(tenant_id,id);

create table public.expenses (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, project_id uuid not null, name text not null, amount numeric(16,2) not null check(amount>0), status text not null default 'pending' check(status in ('pending','approved','rejected')), spent_on date not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.expenses(tenant_id,created_at);
alter table public.expenses enable row level security;
create trigger touch before insert or update on public.expenses for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.expenses for each row execute function public.audit_change();
create policy read_rows on public.expenses for select to authenticated using(public.allowed(tenant_id,'finance') and public.scoped(tenant_id,project_id));
create policy insert_rows on public.expenses for insert to authenticated with check(public.allowed(tenant_id,'finance',true) and public.scoped(tenant_id,project_id));
create policy update_rows on public.expenses for update to authenticated using(public.allowed(tenant_id,'finance',true) and public.scoped(tenant_id,project_id)) with check(public.allowed(tenant_id,'finance',true) and public.scoped(tenant_id,project_id));
alter table public.expenses add foreign key(tenant_id,project_id) references public.projects(tenant_id,id);

create table public.invoices (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, project_id uuid not null, account_id uuid not null, name text not null, subtotal numeric(16,2) not null check(subtotal>0), tax numeric(16,2) not null default 0 check(tax>=0), currency text not null default 'MXN', issued_on date not null, due_date date not null, status text not null default 'issued' check(status in ('issued','partial','paid')), check(due_date>=issued_on), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.invoices(tenant_id,created_at);
alter table public.invoices enable row level security;
create trigger touch before insert or update on public.invoices for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.invoices for each row execute function public.audit_change();
create policy read_rows on public.invoices for select to authenticated using(public.allowed(tenant_id,'finance') and public.scoped(tenant_id,project_id));
alter table public.invoices add foreign key(tenant_id,account_id) references public.accounts(tenant_id,id);
alter table public.invoices add foreign key(tenant_id,project_id) references public.projects(tenant_id,id);

create table public.payments (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, project_id uuid not null, invoice_id uuid not null, name text not null, amount numeric(16,2) not null check(amount>0), paid_on date not null, method text not null, reference text not null, idempotency_key uuid not null, unique(tenant_id,idempotency_key), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.payments(tenant_id,created_at);
alter table public.payments enable row level security;
create trigger touch before insert or update on public.payments for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.payments for each row execute function public.audit_change();
create policy read_rows on public.payments for select to authenticated using(public.allowed(tenant_id,'finance') and public.scoped(tenant_id,project_id));
alter table public.payments add foreign key(tenant_id,invoice_id) references public.invoices(tenant_id,id);
alter table public.payments add foreign key(tenant_id,project_id) references public.projects(tenant_id,id);

create table public.notifications (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, project_id uuid not null, user_id uuid not null references auth.users, name text not null, read_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.notifications(tenant_id,created_at);
alter table public.notifications enable row level security;
create trigger touch before insert or update on public.notifications for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.notifications for each row execute function public.audit_change();
create policy read_rows on public.notifications for select to authenticated using(public.allowed(tenant_id,'projects') and public.scoped(tenant_id,project_id));
create policy insert_rows on public.notifications for insert to authenticated with check(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id));
create policy update_rows on public.notifications for update to authenticated using(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id)) with check(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id));
alter table public.notifications add foreign key(tenant_id,project_id) references public.projects(tenant_id,id);

create table public.kpi_definitions (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, name text not null, code text not null, formula text not null, version integer not null default 1, owner text not null, frequency text not null, target numeric, thresholds jsonb not null default '{}', drilldown text not null, unique(tenant_id,code), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.kpi_definitions(tenant_id,created_at);
alter table public.kpi_definitions enable row level security;
create trigger touch before insert or update on public.kpi_definitions for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.kpi_definitions for each row execute function public.audit_change();
create policy read_rows on public.kpi_definitions for select to authenticated using(public.allowed(tenant_id,'finance'));
create policy insert_rows on public.kpi_definitions for insert to authenticated with check(public.allowed(tenant_id,'finance',true));
create policy update_rows on public.kpi_definitions for update to authenticated using(public.allowed(tenant_id,'finance',true)) with check(public.allowed(tenant_id,'finance',true));

create table public.risks (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, project_id uuid not null, name text not null, probability integer not null check(probability between 1 and 5), impact integer not null check(impact between 1 and 5), owner_id uuid not null references auth.users, mitigation text not null, review_date date not null, status text not null default 'open', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.risks(tenant_id,created_at);
alter table public.risks enable row level security;
create trigger touch before insert or update on public.risks for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.risks for each row execute function public.audit_change();
create policy read_rows on public.risks for select to authenticated using(public.allowed(tenant_id,'projects') and public.scoped(tenant_id,project_id));
create policy insert_rows on public.risks for insert to authenticated with check(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id));
create policy update_rows on public.risks for update to authenticated using(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id)) with check(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id));
alter table public.risks add foreign key(tenant_id,project_id) references public.projects(tenant_id,id);

create table public.issues (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, project_id uuid not null, name text not null, impact text not null, action text not null, resolution text, status text not null default 'open', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.issues(tenant_id,created_at);
alter table public.issues enable row level security;
create trigger touch before insert or update on public.issues for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.issues for each row execute function public.audit_change();
create policy read_rows on public.issues for select to authenticated using(public.allowed(tenant_id,'projects') and public.scoped(tenant_id,project_id));
create policy insert_rows on public.issues for insert to authenticated with check(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id));
create policy update_rows on public.issues for update to authenticated using(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id)) with check(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id));
alter table public.issues add foreign key(tenant_id,project_id) references public.projects(tenant_id,id);

create table public.decisions (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, project_id uuid not null, name text not null, context text not null, alternatives text not null, approver_id uuid not null references auth.users, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.decisions(tenant_id,created_at);
alter table public.decisions enable row level security;
create trigger touch before insert or update on public.decisions for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.decisions for each row execute function public.audit_change();
create policy read_rows on public.decisions for select to authenticated using(public.allowed(tenant_id,'projects') and public.scoped(tenant_id,project_id));
create policy insert_rows on public.decisions for insert to authenticated with check(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id));
create policy update_rows on public.decisions for update to authenticated using(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id)) with check(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id));
alter table public.decisions add foreign key(tenant_id,project_id) references public.projects(tenant_id,id);

create table public.change_requests (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, project_id uuid not null, name text not null, hours numeric(8,2) not null check(hours>=0), cost numeric(16,2) not null check(cost>=0), impact text not null, status text not null default 'pending', created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.change_requests(tenant_id,created_at);
alter table public.change_requests enable row level security;
create trigger touch before insert or update on public.change_requests for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.change_requests for each row execute function public.audit_change();
create policy read_rows on public.change_requests for select to authenticated using(public.allowed(tenant_id,'projects') and public.scoped(tenant_id,project_id));
create policy insert_rows on public.change_requests for insert to authenticated with check(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id));
create policy update_rows on public.change_requests for update to authenticated using(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id)) with check(public.allowed(tenant_id,'projects',true) and public.scoped(tenant_id,project_id));
alter table public.change_requests add foreign key(tenant_id,project_id) references public.projects(tenant_id,id);

create table public.absences (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, user_id uuid not null references auth.users, name text not null, starts_on date not null, ends_on date not null, hours numeric(8,2) not null check(hours>0), check(ends_on>=starts_on), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.absences(tenant_id,created_at);
alter table public.absences enable row level security;
create trigger touch before insert or update on public.absences for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.absences for each row execute function public.audit_change();
create policy read_rows on public.absences for select to authenticated using(public.allowed(tenant_id,'work'));
create policy insert_rows on public.absences for insert to authenticated with check(public.allowed(tenant_id,'work',true) and user_id=auth.uid());
create policy update_rows on public.absences for update to authenticated using(public.allowed(tenant_id,'work',true) and user_id=auth.uid()) with check(public.allowed(tenant_id,'work',true) and user_id=auth.uid());

create table public.capacity_calendar (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, user_id uuid not null references auth.users, name text not null, week_start date not null, hours numeric(8,2) not null check(hours>=0), unique(tenant_id,user_id,week_start), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.capacity_calendar(tenant_id,created_at);
alter table public.capacity_calendar enable row level security;
create trigger touch before insert or update on public.capacity_calendar for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.capacity_calendar for each row execute function public.audit_change();
create policy read_rows on public.capacity_calendar for select to authenticated using(public.allowed(tenant_id,'work'));
create policy insert_rows on public.capacity_calendar for insert to authenticated with check(public.allowed(tenant_id,'work',true) and user_id=auth.uid());
create policy update_rows on public.capacity_calendar for update to authenticated using(public.allowed(tenant_id,'work',true) and user_id=auth.uid()) with check(public.allowed(tenant_id,'work',true) and user_id=auth.uid());

create table public.files (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, project_id uuid not null, name text not null, storage_path text not null, hash text not null, version integer not null default 1, shared boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.files(tenant_id,created_at);
alter table public.files enable row level security;
create trigger touch before insert or update on public.files for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.files for each row execute function public.audit_change();
create policy read_rows on public.files for select to authenticated using(public.allowed(tenant_id,'files') and public.scoped(tenant_id,project_id) and (not exists(select 1 from public.memberships m where m.tenant_id=files.tenant_id and m.user_id=auth.uid() and m.role='client') or shared));
create policy insert_rows on public.files for insert to authenticated with check(public.allowed(tenant_id,'files',true) and public.scoped(tenant_id,project_id) and (not exists(select 1 from public.memberships m where m.tenant_id=files.tenant_id and m.user_id=auth.uid() and m.role='client') or shared));
create policy update_rows on public.files for update to authenticated using(public.allowed(tenant_id,'files',true) and public.scoped(tenant_id,project_id) and (not exists(select 1 from public.memberships m where m.tenant_id=files.tenant_id and m.user_id=auth.uid() and m.role='client') or shared)) with check(public.allowed(tenant_id,'files',true) and public.scoped(tenant_id,project_id) and (not exists(select 1 from public.memberships m where m.tenant_id=files.tenant_id and m.user_id=auth.uid() and m.role='client') or shared));
alter table public.files add foreign key(tenant_id,project_id) references public.projects(tenant_id,id);

create table public.comments (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, project_id uuid not null, file_id uuid not null, name text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.comments(tenant_id,created_at);
alter table public.comments enable row level security;
create trigger touch before insert or update on public.comments for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.comments for each row execute function public.audit_change();
create policy read_rows on public.comments for select to authenticated using(public.allowed(tenant_id,'files') and public.scoped(tenant_id,project_id) and (not exists(select 1 from public.memberships m where m.tenant_id=comments.tenant_id and m.user_id=auth.uid() and m.role='client') or exists(select 1 from public.files f where f.id=file_id and f.shared)));
create policy insert_rows on public.comments for insert to authenticated with check(public.allowed(tenant_id,'files',true) and public.scoped(tenant_id,project_id) and (not exists(select 1 from public.memberships m where m.tenant_id=comments.tenant_id and m.user_id=auth.uid() and m.role='client') or exists(select 1 from public.files f where f.id=file_id and f.shared)));
create policy update_rows on public.comments for update to authenticated using(public.allowed(tenant_id,'files',true) and public.scoped(tenant_id,project_id) and (not exists(select 1 from public.memberships m where m.tenant_id=comments.tenant_id and m.user_id=auth.uid() and m.role='client') or exists(select 1 from public.files f where f.id=file_id and f.shared))) with check(public.allowed(tenant_id,'files',true) and public.scoped(tenant_id,project_id) and (not exists(select 1 from public.memberships m where m.tenant_id=comments.tenant_id and m.user_id=auth.uid() and m.role='client') or exists(select 1 from public.files f where f.id=file_id and f.shared)));
alter table public.comments add foreign key(tenant_id,file_id) references public.files(tenant_id,id);
alter table public.comments add foreign key(tenant_id,project_id) references public.projects(tenant_id,id);

create table public.approvals (id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.organizations_internal, project_id uuid not null, file_id uuid not null, name text not null, status text not null default 'pending' check(status in ('pending','approved','rejected')), internal boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users default auth.uid(), archived_at timestamptz, unique(tenant_id,id));
create index on public.approvals(tenant_id,created_at);
alter table public.approvals enable row level security;
create trigger touch before insert or update on public.approvals for each row execute function public.touch_record();
create trigger audit after insert or update or delete on public.approvals for each row execute function public.audit_change();
create policy read_rows on public.approvals for select to authenticated using(public.allowed(tenant_id,'files') and public.scoped(tenant_id,project_id) and (not exists(select 1 from public.memberships m where m.tenant_id=approvals.tenant_id and m.user_id=auth.uid() and m.role='client') or exists(select 1 from public.files f where f.id=file_id and f.shared)));
create policy insert_rows on public.approvals for insert to authenticated with check(public.allowed(tenant_id,'files',true) and public.scoped(tenant_id,project_id) and (not exists(select 1 from public.memberships m where m.tenant_id=approvals.tenant_id and m.user_id=auth.uid() and m.role='client') or exists(select 1 from public.files f where f.id=file_id and f.shared)));
create policy update_rows on public.approvals for update to authenticated using(public.allowed(tenant_id,'files',true) and public.scoped(tenant_id,project_id) and (not exists(select 1 from public.memberships m where m.tenant_id=approvals.tenant_id and m.user_id=auth.uid() and m.role='client') or exists(select 1 from public.files f where f.id=file_id and f.shared))) with check(public.allowed(tenant_id,'files',true) and public.scoped(tenant_id,project_id) and (not exists(select 1 from public.memberships m where m.tenant_id=approvals.tenant_id and m.user_id=auth.uid() and m.role='client') or exists(select 1 from public.files f where f.id=file_id and f.shared)));
alter table public.approvals add foreign key(tenant_id,file_id) references public.files(tenant_id,id);
alter table public.approvals add foreign key(tenant_id,project_id) references public.projects(tenant_id,id);

alter table public.project_members add foreign key(tenant_id,project_id) references public.projects(tenant_id,id);
alter table public.organizations_internal enable row level security;
alter table public.memberships enable row level security;
alter table public.project_members enable row level security;
alter table public.permissions enable row level security;
alter table public.audit_events enable row level security;
create policy own_tenants on public.organizations_internal for select to authenticated using(exists(select 1 from public.memberships m where m.tenant_id=organizations_internal.id and m.user_id=auth.uid() and m.active));
create policy own_membership on public.memberships for select to authenticated using(user_id=auth.uid());
create policy project_member_read on public.project_members for select to authenticated using(public.allowed(tenant_id,'projects') and public.scoped(tenant_id,project_id));
create policy project_member_write on public.project_members for insert to authenticated with check(public.allowed(tenant_id,'admin',true) and public.scoped(tenant_id,project_id));
create policy permission_read on public.permissions for select to authenticated using(true);
create policy audit_read on public.audit_events for select to authenticated using(public.allowed(tenant_id,'admin') or exists(select 1 from public.memberships m where m.tenant_id=audit_events.tenant_id and m.user_id=auth.uid() and m.role='auditor' and m.active));
grant usage on schema public to authenticated;
grant select,insert,update on all tables in schema public to authenticated;
revoke insert,update on public.audit_events,public.memberships,public.permissions,public.organizations_internal from authenticated;
