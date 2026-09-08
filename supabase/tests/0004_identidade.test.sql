begin;
select plan(4);

select has_table('public', 'usuarios', 'tabela usuarios existe');
select col_default_is('public', 'usuarios', 'status_conta', 'Ativa', 'status_conta default Ativa');
select hasnt_column('public', 'usuarios', 'senha', 'usuarios NÃO tem coluna senha');

-- o trigger em auth.users deve materializar uma linha em public.usuarios
select tests.create_supabase_user('ident_a');
select is(
  (select count(*)::int from public.usuarios where id = tests.get_supabase_uid('ident_a')),
  1,
  'inserir em auth.users cria linha em public.usuarios'
);

select * from finish();
rollback;
