create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login noinherit;
grant anon,authenticated,service_role to authenticator;
create role supabase_auth_admin login;
create schema auth authorization supabase_auth_admin;
create extension if not exists pgcrypto;
grant usage on schema public to supabase_auth_admin;
grant usage on schema auth to anon,authenticated,service_role;
create function auth.uid() returns uuid language sql stable as $$ select nullif(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub','')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
grant execute on function auth.uid(),auth.jwt() to anon,authenticated,service_role;
alter default privileges for role supabase_auth_admin in schema auth grant references on tables to postgres;

alter function auth.uid() owner to supabase_auth_admin;
alter function auth.jwt() owner to supabase_auth_admin;
