begin;
select plan(16);

select tests.create_supabase_user('t6_cli');
select tests.create_supabase_user('t6_pre');
select tests.create_supabase_user('t6_outro');

insert into public.categoria_servico (id, nome, icone_key)
values ('c6666666-0000-0000-0000-000000000001', 'T6 Eletrica', 'x');

-- Cenario A: contratacao AGENDADA (pronta pra iniciar)
insert into public.demandas_servico (id, cliente_id, categoria_id, titulo, descricao, status)
values ('d6666666-0000-0000-0000-000000000001', tests.get_supabase_uid('t6_cli'),
        'c6666666-0000-0000-0000-000000000001', 'Troca de disjuntor', 'x', 'CONTRATADA');
insert into public.propostas (id, demanda_id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b6666666-0000-0000-0000-000000000001', 'd6666666-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t6_pre'), tests.get_supabase_uid('t6_cli'),
        gen_random_uuid(), 400.00, 'troca disjuntor');
-- conversa_id da proposta acima nao referencia uma conversa real -- ok pra esses testes,
-- fn_iniciar_execucao/fn_concluir_execucao nunca leem propostas.conversa_id.
insert into public.contratacoes (id, demanda_id, proposta_id, titulo_servico, cliente_id, prestador_id, valor_total, status)
values ('e6666666-0000-0000-0000-000000000001', 'd6666666-0000-0000-0000-000000000001',
        'b6666666-0000-0000-0000-000000000001', 'Troca de disjuntor',
        tests.get_supabase_uid('t6_cli'), tests.get_supabase_uid('t6_pre'), 400.00, 'AGENDADA');

-- (1) authz iniciar: nao-prestador nao inicia
select tests.authenticate_as('t6_outro');
select throws_ok(
  $$ select public.fn_iniciar_execucao('e6666666-0000-0000-0000-000000000001') $$,
  'PT401', null, 'nao-prestador nao inicia (PT401)');
reset role;

-- (2) inicar: inexistente
select tests.authenticate_as('t6_pre');
select throws_ok(
  $$ select public.fn_iniciar_execucao('00000000-0000-0000-0000-0000000000ff') $$,
  'PT404', null, 'contratacao inexistente (PT404)');
reset role;

-- (3)+(4) iniciar: feliz
select tests.authenticate_as('t6_pre');
select lives_ok(
  $$ select public.fn_iniciar_execucao('e6666666-0000-0000-0000-000000000001') $$,
  'prestador inicia sem erro');
reset role;
select is((select status::text from public.contratacoes where id = 'e6666666-0000-0000-0000-000000000001'),
          'EM_ANDAMENTO', 'contratacao EM_ANDAMENTO');

-- (5) iniciar: idempotente
select tests.authenticate_as('t6_pre');
select lives_ok(
  $$ select public.fn_iniciar_execucao('e6666666-0000-0000-0000-000000000001') $$,
  '2a chamada idempotente (ja EM_ANDAMENTO)');
reset role;

-- (6) iniciar: conflito -- outra contratacao ainda AGUARDANDO_PAGAMENTO
insert into public.demandas_servico (id, cliente_id, categoria_id, titulo, descricao, status)
values ('d6666666-0000-0000-0000-000000000002', tests.get_supabase_uid('t6_cli'),
        'c6666666-0000-0000-0000-000000000001', 'Instalacao de tomada', 'x', 'CONTRATADA');
insert into public.propostas (id, demanda_id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b6666666-0000-0000-0000-000000000002', 'd6666666-0000-0000-0000-000000000002',
        tests.get_supabase_uid('t6_pre'), tests.get_supabase_uid('t6_cli'),
        gen_random_uuid(), 200.00, 'tomada nova');
insert into public.contratacoes (id, demanda_id, proposta_id, titulo_servico, cliente_id, prestador_id, valor_total, status)
values ('e6666666-0000-0000-0000-000000000002', 'd6666666-0000-0000-0000-000000000002',
        'b6666666-0000-0000-0000-000000000002', 'Instalacao de tomada',
        tests.get_supabase_uid('t6_cli'), tests.get_supabase_uid('t6_pre'), 200.00, 'AGUARDANDO_PAGAMENTO');

select tests.authenticate_as('t6_pre');
select throws_ok(
  $$ select public.fn_iniciar_execucao('e6666666-0000-0000-0000-000000000002') $$,
  'PT409', null, 'AGUARDANDO_PAGAMENTO nao inicia (PT409)');
reset role;

-- ============================================================================
-- fn_concluir_execucao (usa a contratacao e...01, ja EM_ANDAMENTO)
-- ============================================================================

-- (7) authz concluir: nao-prestador nao conclui
select tests.authenticate_as('t6_outro');
select throws_ok(
  $$ select public.fn_concluir_execucao('e6666666-0000-0000-0000-000000000001') $$,
  'PT401', null, 'nao-prestador nao conclui (PT401)');
reset role;

-- (8) concluir: inexistente
select tests.authenticate_as('t6_pre');
select throws_ok(
  $$ select public.fn_concluir_execucao('00000000-0000-0000-0000-0000000000ff') $$,
  'PT404', null, 'contratacao inexistente (PT404)');
reset role;

-- (9) concluir: conflito -- e...02 ainda AGUARDANDO_PAGAMENTO
select tests.authenticate_as('t6_pre');
select throws_ok(
  $$ select public.fn_concluir_execucao('e6666666-0000-0000-0000-000000000002') $$,
  'PT409', null, 'AGUARDANDO_PAGAMENTO nao conclui (PT409)');
reset role;

-- (10)-(14) concluir: feliz
select tests.authenticate_as('t6_pre');
select lives_ok(
  $$ select public.fn_concluir_execucao('e6666666-0000-0000-0000-000000000001') $$,
  'prestador conclui sem erro');
reset role;
select is((select status::text from public.contratacoes where id = 'e6666666-0000-0000-0000-000000000001'),
          'EM_ANDAMENTO', 'contratacao continua EM_ANDAMENTO (so o webhook conclui de verdade)');
select ok((select data_conclusao from public.contratacoes where id = 'e6666666-0000-0000-0000-000000000001') is not null,
          'data_conclusao preenchida');
select is((select valor::numeric from public.pagamentos
             where contratacao_id = 'e6666666-0000-0000-0000-000000000001' and tipo = 'FINAL'),
          200.00, 'pagamento FINAL = valor_final (metade de 400.00)');
select is((select status::text from public.pagamentos
             where contratacao_id = 'e6666666-0000-0000-0000-000000000001' and tipo = 'FINAL'),
          'PENDENTE', 'pagamento FINAL comeca PENDENTE');

-- (15)+(16) concluir: idempotente -- mesmo id de pagamento, mesmo se a
-- contratacao ja tivesse avancado por fora (aqui simulado so pela 2a chamada)
select tests.authenticate_as('t6_pre');
select is(
  (select public.fn_concluir_execucao('e6666666-0000-0000-0000-000000000001')),
  (select id from public.pagamentos where contratacao_id = 'e6666666-0000-0000-0000-000000000001' and tipo = 'FINAL'),
  '2a chamada devolve o mesmo pagamento_id');
reset role;
select is((select count(*)::int from public.pagamentos
             where contratacao_id = 'e6666666-0000-0000-0000-000000000001' and tipo = 'FINAL'),
          1, 'sem 2o pagamento FINAL');

select * from finish();
rollback;
