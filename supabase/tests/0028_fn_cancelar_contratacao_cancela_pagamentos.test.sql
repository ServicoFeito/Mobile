-- Plano 6 — fn_cancelar_contratacao tambem cancela os pagamentos ainda abertos.
-- Teste aditivo: cobre SO a linha nova (update em public.pagamentos). O
-- comportamento geral da funcao continua coberto por 0026.
begin;
select plan(3);

select tests.create_supabase_user('t7_cli');
select tests.create_supabase_user('t7_pre');

insert into public.categoria_servico (id, nome, icone_key)
values ('c7777777-0000-0000-0000-000000000001', 'T7 Pintura', 'x');

insert into public.demandas_servico (id, cliente_id, categoria_id, titulo, descricao, status)
values ('d7777777-0000-0000-0000-000000000001', tests.get_supabase_uid('t7_cli'),
        'c7777777-0000-0000-0000-000000000001', 'Pintar sala', 'x', 'CONTRATADA');
insert into public.conversas (id, tipo, demanda_id, cliente_id, prestador_id)
values ('a7777777-0000-0000-0000-000000000001', 'DEMANDA',
        'd7777777-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t7_cli'), tests.get_supabase_uid('t7_pre'));
insert into public.propostas (id, demanda_id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b7777777-0000-0000-0000-000000000001', 'd7777777-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t7_pre'), tests.get_supabase_uid('t7_cli'),
        'a7777777-0000-0000-0000-000000000001', 800.00, 'pinto a sala');
insert into public.contratacoes (id, demanda_id, proposta_id, titulo_servico, cliente_id, prestador_id, valor_total, status)
values ('e7777777-0000-0000-0000-000000000001', 'd7777777-0000-0000-0000-000000000001',
        'b7777777-0000-0000-0000-000000000001', 'Pintar sala',
        tests.get_supabase_uid('t7_cli'), tests.get_supabase_uid('t7_pre'), 800.00, 'AGUARDANDO_PAGAMENTO');

-- Pagamento de entrada ja com QR gerado (PROCESSANDO) na hora do cancelamento.
insert into public.pagamentos (id, contratacao_id, valor, tipo, status)
values ('f7777777-0000-0000-0000-000000000001', 'e7777777-0000-0000-0000-000000000001',
        240.00, 'ENTRADA', 'PROCESSANDO');

select tests.authenticate_as('t7_cli');
select lives_ok(
  $$ select public.fn_cancelar_contratacao('e7777777-0000-0000-0000-000000000001') $$,
  'cliente cancela sem erro');
reset role;

select is((select status::text from public.pagamentos where id = 'f7777777-0000-0000-0000-000000000001'),
          'CANCELADO', 'pagamento PROCESSANDO vira CANCELADO');
select is((select status::text from public.contratacoes where id = 'e7777777-0000-0000-0000-000000000001'),
          'CANCELADA', 'contratacao segue CANCELADA (nada mais quebrou)');

select * from finish();
rollback;
