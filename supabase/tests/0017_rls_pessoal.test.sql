begin;
select plan(4);

select tests.create_supabase_user('pes_a');
select tests.create_supabase_user('pes_b');

-- A só vê a própria linha em usuarios
select tests.authenticate_as('pes_a');
select is(
  (select count(*)::int from public.usuarios),
  1,
  'A enxerga apenas a própria linha em usuarios'
);
select is(
  (select id from public.usuarios),
  tests.get_supabase_uid('pes_a'),
  'a linha visível para A é a de A'
);

-- A insere endereço próprio; não consegue inserir para B
select lives_ok(
  format($$ insert into public.enderecos_usuario (usuario_id, identificacao) values (%L, 'Casa') $$,
         tests.get_supabase_uid('pes_a')),
  'A insere endereço próprio'
);
select throws_ok(
  format($$ insert into public.enderecos_usuario (usuario_id, identificacao) values (%L, 'Casa') $$,
         tests.get_supabase_uid('pes_b')),
  '42501',
  null,
  'A não insere endereço para B (RLS)'
);

select * from finish();
rollback;
