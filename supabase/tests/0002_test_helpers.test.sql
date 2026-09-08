begin;
select plan(4);

select lives_ok(
  $$ select tests.create_supabase_user('helper_a') $$,
  'create_supabase_user roda sem erro'
);

select isnt(
  tests.get_supabase_uid('helper_a'), null,
  'get_supabase_uid devolve o uuid do usuário criado'
);

select tests.authenticate_as('helper_a');
select is(
  current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
  tests.get_supabase_uid('helper_a')::text,
  'authenticate_as coloca o sub certo nas claims'
);

reset role;
select tests.clear_authentication();
-- Em Supabase hospedado o GUC request.jwt.claims é pré-declarado como '', então
-- current_setting(...) devolve '' (nunca NULL) após limpar; nullif normaliza.
select is(
  nullif(current_setting('request.jwt.claims', true), ''),
  null,
  'clear_authentication limpa as claims'
);

select * from finish();
rollback;
