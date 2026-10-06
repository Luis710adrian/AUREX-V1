-- Until the scoped Portal is implemented, guests never read internal project/budget rows.
delete from public.permissions where role='client' and domain='projects';
create function public.is_client(t uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships where tenant_id=t and user_id=auth.uid() and role='client' and active);
$$;
alter table public.comments add column internal boolean not null default true;
drop policy read_rows on public.comments;
create policy read_rows on public.comments for select to authenticated using(public.allowed(tenant_id,'files') and public.scoped(tenant_id,project_id) and (not public.is_client(tenant_id) or (not internal and exists(select 1 from public.files f where f.id=comments.file_id and f.shared))));
drop policy read_rows on public.approvals;
create policy read_rows on public.approvals for select to authenticated using(public.allowed(tenant_id,'files') and public.scoped(tenant_id,project_id) and (not public.is_client(tenant_id) or (not internal and exists(select 1 from public.files f where f.id=approvals.file_id and f.shared))));
drop policy read_rows on public.notifications;
create policy read_rows on public.notifications for select to authenticated using(public.allowed(tenant_id,'projects') and public.scoped(tenant_id,project_id) and (user_id=auth.uid() or public.allowed(tenant_id,'admin')));
revoke execute on function public.is_client(uuid) from public,anon;
grant execute on function public.is_client(uuid) to authenticated;
