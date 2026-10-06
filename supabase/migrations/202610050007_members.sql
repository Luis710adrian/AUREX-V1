create function public.manage_member(t uuid,u uuid,r public.app_role,enabled boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.memberships;begin
 perform public.require_access(t,'admin');
 select * into strict m from public.memberships where tenant_id=t and user_id=u for update;
 if m.role='owner' and (r!='owner' or not enabled) and (select count(*) from public.memberships where tenant_id=t and role='owner' and active)<=1 then raise exception 'cannot remove last active owner';end if;
 update public.memberships set role=r,active=enabled where id=m.id;return m.id;
end;$$;
revoke execute on function public.manage_member(uuid,uuid,public.app_role,boolean) from public,anon;
grant execute on function public.manage_member(uuid,uuid,public.app_role,boolean) to authenticated;
