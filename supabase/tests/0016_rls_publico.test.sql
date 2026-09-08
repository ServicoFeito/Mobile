begin;
select plan(4);

select tests.create_supabase_user('pub_a');
select tests.create_supabase_user('pub_b');

-- anon consegue ler o catálogo
select tests.clear_authentication();
set local role anon;
select ok(
  (select count(*) from public.categoria_servico) = 9,
  'anon lê categoria_servico'
);
reset role;

-- usuário A cria o próprio perfil_prestador
select tests.authenticate_as('pub_a');
select lives_ok(
  format($$ insert into public.perfil_prestador (usuario_id) values (%L) $$, tests.get_supabase_uid('pub_a')),
  'A insere o próprio perfil_prestador'
);

-- usuário B NÃO consegue criar perfil no nome de A
reset role;
select tests.authenticate_as('pub_b');
select throws_ok(
  format($$ insert into public.perfil_prestador (usuario_id) values (%L) $$, tests.get_supabase_uid('pub_a')),
  '42501',
  null,
  'B não insere perfil_prestador no id de A (RLS)'
);

-- B lê o perfil de A (descoberta)
select ok(
  (select count(*) from public.perfil_prestador where usuario_id = tests.get_supabase_uid('pub_a')) = 1,
  'B lê o perfil_prestador de A'
);

select * from finish();
rollback;
