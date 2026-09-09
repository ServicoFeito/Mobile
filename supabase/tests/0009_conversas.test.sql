begin;
select plan(4);

select has_table('public', 'conversas', 'tabela conversas existe');
select has_table('public', 'participantes_conversa', 'tabela participantes_conversa existe');
select has_table('public', 'mensagens', 'tabela mensagens existe');

-- check constraint: tipo DEMANDA exige demanda_id
select tests.create_supabase_user('conv_cli');
select tests.create_supabase_user('conv_pre');
select throws_ok(
  format(
    $$ insert into public.conversas (tipo, cliente_id, prestador_id)
       values ('DEMANDA', %L, %L) $$,
    tests.get_supabase_uid('conv_cli'), tests.get_supabase_uid('conv_pre')
  ),
  '23514',
  null,
  'conversa DEMANDA sem demanda_id viola a check constraint'
);

select * from finish();
rollback;
