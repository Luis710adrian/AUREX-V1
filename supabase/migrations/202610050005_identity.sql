create function public.assign_membership(t uuid,u uuid,r public.app_role) returns uuid language plpgsql security definer set search_path='' as $$
declare member uuid;begin
 perform public.require_access(t,'admin');
 insert into public.memberships(tenant_id,user_id,role) values(t,u,r) on conflict(tenant_id,user_id) do update set role=excluded.role,active=true returning id into member;
 return member;
end;$$;
create function public.assign_project_member(t uuid,p uuid,u uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare member uuid;begin
 perform public.require_access(t,'projects',p);
 if not exists(select 1 from public.memberships where tenant_id=t and user_id=auth.uid() and role in ('owner','operations','pm') and active) then raise exception 'assignment permission required' using errcode='42501';end if;
 insert into public.project_members(tenant_id,project_id,user_id) values(t,p,u) on conflict(project_id,user_id) do update set user_id=excluded.user_id returning id into member;
 return member;
end;$$;
alter table public.files add unique(tenant_id,project_id,id);
alter table public.comments add foreign key(tenant_id,project_id,file_id) references public.files(tenant_id,project_id,id);
alter table public.approvals add foreign key(tenant_id,project_id,file_id) references public.files(tenant_id,project_id,id);
revoke execute on all functions in schema public from public,anon;
grant execute on all functions in schema public to authenticated;
