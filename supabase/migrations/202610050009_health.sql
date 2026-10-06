create function public.database_health() returns boolean language sql stable security invoker set search_path='' as $$ select true $$;
grant usage on schema public to anon;
grant execute on function public.database_health() to anon,authenticated,service_role;
