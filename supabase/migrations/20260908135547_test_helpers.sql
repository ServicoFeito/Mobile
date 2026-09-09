-- Schema de apoio a testes pgTAP.
-- Enviado a todos os ambientes. anon/authenticated recebem USAGE no schema e EXECUTE
-- APENAS nos dois helpers read-only (get_supabase_uid, rls_enabled), porque os testes
-- RLS impersonam esses papéis. create_supabase_user / authenticate_as /
-- clear_authentication ficam sem EXECUTE para anon/authenticated e para PUBLIC —
-- só o papel de migração/runner (postgres) os chama.
-- TODO(release-prod): schema tests NÃO deve chegar em prod via migration history —
-- ver docs/superpowers/plans/2026-09-08-fundacao-checklist-operacional.md.
create schema if not exists tests;

create or replace function tests.create_supabase_user(identifier text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := extensions.gen_random_uuid();
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data)
  values (v_id, identifier || '@test.local', 'authenticated', 'authenticated',
          json_build_object('identifier', identifier))
  -- auth.users só tem índice único parcial em email (users_email_partial_key,
  -- WHERE is_sso_user = false); o arbiter do ON CONFLICT precisa do mesmo predicado.
  on conflict (email) where (is_sso_user = false) do nothing;
  return (select id from auth.users where email = identifier || '@test.local' limit 1);
end;
$$;

create or replace function tests.get_supabase_uid(identifier text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select id from auth.users where email = identifier || '@test.local' limit 1;
$$;

-- security invoker (sem "security definer"): Postgres proíbe alterar o parâmetro
-- "role" dentro de uma função security definer. Por isso a leitura de auth.users é
-- delegada ao helper SECURITY DEFINER tests.get_supabase_uid — assim authenticate_as
-- funciona mesmo quando o papel corrente já é anon/authenticated (idioma basejump:
-- clear_authentication() -> authenticate_as('b'), ou authenticate_as encadeado).
create or replace function tests.authenticate_as(identifier text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  v_id := tests.get_supabase_uid(identifier);
  if v_id is null then
    raise exception 'usuário de teste "%" não existe (chame tests.create_supabase_user primeiro)', identifier;
  end if;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_id::text, 'role', 'authenticated',
                      'email', identifier || '@test.local')::text,
    true);
end;
$$;

create or replace function tests.clear_authentication()
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', null, true);
end;
$$;

create or replace function tests.rls_enabled(schema_name text, table_name text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select coalesce(bool_and(c.relrowsecurity), false)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = schema_name and c.relname = table_name;
$$;

-- PUBLIC perde EXECUTE nos 5 helpers já criados (o revoke abaixo) e nos futuros
-- (o alter default privileges). anon/authenticated ganham USAGE no schema e EXECUTE
-- só nos dois helpers read-only usados durante os testes RLS impersonados.
revoke execute on all functions in schema tests from public, anon, authenticated;
alter default privileges in schema tests revoke execute on functions from public;
grant usage on schema tests to anon, authenticated;
grant execute on function tests.get_supabase_uid(text) to anon, authenticated;
grant execute on function tests.rls_enabled(text, text) to anon, authenticated;
