drop policy own_tenants on public.organizations_internal;
create policy own_tenants on public.organizations_internal for select to authenticated using(exists(select 1 from public.memberships m where m.tenant_id=organizations_internal.id and m.user_id=auth.uid() and m.active));
drop policy own_membership on public.memberships;
create policy own_membership on public.memberships for select to authenticated using(user_id=auth.uid() or public.allowed(tenant_id,'admin'));
