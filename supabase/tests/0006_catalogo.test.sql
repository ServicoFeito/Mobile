begin;
select plan(4);

select has_table('public', 'categoria_servico', 'tabela categoria_servico existe');
select is(
  (select count(*)::int from public.categoria_servico),
  9,
  'seed cria 9 categorias'
);
select is(
  (select count(*)::int from public.categoria_servico where nome is null),
  0,
  'nenhuma categoria com nome nulo'
);

-- PK composta impede duplicar o par prestador/categoria
select tests.create_supabase_user('cat_prest');
insert into public.perfil_prestador (usuario_id) values (tests.get_supabase_uid('cat_prest'));
insert into public.prestador_categoria (prestador_id, categoria_id)
  select tests.get_supabase_uid('cat_prest'), id from public.categoria_servico where nome = 'Limpeza';
select throws_ok(
  $$ insert into public.prestador_categoria (prestador_id, categoria_id)
     select tests.get_supabase_uid('cat_prest'), id from public.categoria_servico where nome = 'Limpeza' $$,
  '23505',
  null,
  'par prestador/categoria duplicado viola a PK composta'
);

select * from finish();
rollback;
