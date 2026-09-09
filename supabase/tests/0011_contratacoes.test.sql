begin;
select plan(5);

select has_table('public', 'contratacoes', 'tabela contratacoes existe');
select has_table('public', 'pagamentos', 'tabela pagamentos existe');

select tests.create_supabase_user('con_cli');
select tests.create_supabase_user('con_pre');
insert into public.conversas (id, tipo, cliente_id, prestador_id)
values ('aaaaaaaa-0000-0000-0000-000000000011', 'DIRETA',
        tests.get_supabase_uid('con_cli'), tests.get_supabase_uid('con_pre'));
insert into public.propostas (id, conversa_id, prestador_id, cliente_id, valor)
values ('bbbbbbbb-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000011',
        tests.get_supabase_uid('con_pre'), tests.get_supabase_uid('con_cli'), 300.00);
insert into public.contratacoes (proposta_id, titulo_servico, cliente_id, prestador_id, valor_total)
values ('bbbbbbbb-0000-0000-0000-000000000011', 'Pintura da sala',
        tests.get_supabase_uid('con_cli'), tests.get_supabase_uid('con_pre'), 300.00);

select is(
  (select valor_entrada from public.contratacoes where proposta_id = 'bbbbbbbb-0000-0000-0000-000000000011'),
  150.00::numeric, 'valor_entrada = 50% de 300');
select is(
  (select taxa_plataforma from public.contratacoes where proposta_id = 'bbbbbbbb-0000-0000-0000-000000000011'),
  60.00::numeric, 'taxa_plataforma = 20% de 300');

-- unique (contratacao_id, tipo): não pode haver 2 pagamentos ENTRADA na mesma contratação
insert into public.pagamentos (contratacao_id, valor, tipo)
select id, 150.00, 'ENTRADA' from public.contratacoes where proposta_id = 'bbbbbbbb-0000-0000-0000-000000000011';
select throws_ok(
  $$ insert into public.pagamentos (contratacao_id, valor, tipo)
     select id, 150.00, 'ENTRADA' from public.contratacoes
     where proposta_id = 'bbbbbbbb-0000-0000-0000-000000000011' $$,
  '23505',
  null,
  'segundo pagamento ENTRADA na mesma contratação viola unique'
);

select * from finish();
rollback;
