-- Schema de apoio a testes pgTAP.
-- Enviado a todos os ambientes; anon/authenticated recebem USAGE/EXECUTE porque os
-- testes RLS impersonam esses papéis (padrão basejump supabase_test_helpers).
-- TODO(release-prod): mover para mecanismo local-only quando houver deploy de prod.
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
-- "role" dentro de uma função security definer.
create or replace function tests.authenticate_as(identifier text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where email = identifier || '@test.local' limit 1;
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

-- Os testes RLS chamam tests.* enquanto impersonam anon/authenticated, então esses
-- papéis precisam de USAGE no schema e EXECUTE nas funções. public continua sem EXECUTE.
grant usage on schema tests to anon, authenticated;
alter default privileges in schema tests revoke execute on functions from public;
grant execute on all functions in schema tests to anon, authenticated;
