begin;
select plan(3);

select has_table('public', 'propostas', 'tabela propostas existe');

select tests.create_supabase_user('prop_cli');
select tests.create_supabase_user('prop_pre');
insert into public.conversas (id, tipo, cliente_id, prestador_id)
values ('aaaaaaaa-0000-0000-0000-000000000010', 'DIRETA',
        tests.get_supabase_uid('prop_cli'), tests.get_supabase_uid('prop_pre'));
insert into public.propostas (conversa_id, prestador_id, cliente_id, valor)
values ('aaaaaaaa-0000-0000-0000-000000000010',
        tests.get_supabase_uid('prop_pre'), tests.get_supabase_uid('prop_cli'), 100.00);

select is(
  (select taxa_plataforma from public.propostas
   where conversa_id = 'aaaaaaaa-0000-0000-0000-000000000010'),
  20.00::numeric,
  'taxa_plataforma = 20% de 100'
);
select is(
  (select valor_liquido_prestador from public.propostas
   where conversa_id = 'aaaaaaaa-0000-0000-0000-000000000010'),
  80.00::numeric,
  'valor_liquido_prestador = 80% de 100'
);

select * from finish();
rollback;
