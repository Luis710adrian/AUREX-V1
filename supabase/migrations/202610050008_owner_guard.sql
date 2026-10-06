create function public.guard_last_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.role='owner' and old.active and (new.role!='owner' or not new.active) then
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(old.tenant_id::text,0));
 if not exists(select 1 from public.memberships where tenant_id=old.tenant_id and role='owner' and active and id!=old.id) then raise exception 'cannot remove last active owner';end if;
 end if;return new;
end;$$;
create trigger guard_last_owner before update on public.memberships for each row execute function public.guard_last_owner();
revoke execute on function public.guard_last_owner() from public,anon;
grant execute on function public.guard_last_owner() to authenticated;
