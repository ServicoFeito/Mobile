begin;
select plan(15);

select tests.create_supabase_user('t5_cli');
select tests.create_supabase_user('t5_pre');
select tests.create_supabase_user('t5_outro');

insert into public.categoria_servico (id, nome, icone_key)
values ('c5555555-0000-0000-0000-000000000001', 'T5 Marcenaria', 'x');

-- Cenario A (feliz, DEMANDA): demanda ja CONTRATADA + contratacao AGUARDANDO_PAGAMENTO
insert into public.demandas_servico (id, cliente_id, categoria_id, titulo, descricao, status)
values ('d5555555-0000-0000-0000-000000000001', tests.get_supabase_uid('t5_cli'),
        'c5555555-0000-0000-0000-000000000001', 'Estante sob medida', 'x', 'CONTRATADA');
insert into public.conversas (id, tipo, demanda_id, cliente_id, prestador_id)
values ('a5555555-0000-0000-0000-000000000001', 'DEMANDA',
        'd5555555-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t5_cli'), tests.get_supabase_uid('t5_pre'));
insert into public.propostas (id, demanda_id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b5555555-0000-0000-0000-000000000001', 'd5555555-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t5_pre'), tests.get_supabase_uid('t5_cli'),
        'a5555555-0000-0000-0000-000000000001', 500.00, 'faco a estante');
insert into public.contratacoes (id, demanda_id, proposta_id, titulo_servico, cliente_id, prestador_id, valor_total, status)
values ('e5555555-0000-0000-0000-000000000001', 'd5555555-0000-0000-0000-000000000001',
        'b5555555-0000-0000-0000-000000000001', 'Estante sob medida',
        tests.get_supabase_uid('t5_cli'), tests.get_supabase_uid('t5_pre'), 500.00, 'AGUARDANDO_PAGAMENTO');

-- (1) authz: quem nao e cliente nem prestador nao cancela
select tests.authenticate_as('t5_outro');
select throws_ok(
  $$ select public.fn_cancelar_contratacao('e5555555-0000-0000-0000-000000000001') $$,
  'PT401', null, 'nao-parte nao cancela (PT401)');
reset role;

-- (2) inexistente
select tests.authenticate_as('t5_cli');
select throws_ok(
  $$ select public.fn_cancelar_contratacao('00000000-0000-0000-0000-0000000000ff') $$,
  'PT404', null, 'contratacao inexistente (PT404)');
reset role;

-- (3) feliz: prestador cancela
select tests.authenticate_as('t5_pre');
select lives_ok(
  $$ select public.fn_cancelar_contratacao('e5555555-0000-0000-0000-000000000001') $$,
  'prestador cancela sem erro');
reset role;

select is((select status::text from public.contratacoes where id = 'e5555555-0000-0000-0000-000000000001'),
          'CANCELADA', 'contratacao CANCELADA');
select is((select status::text from public.demandas_servico where id = 'd5555555-0000-0000-0000-000000000001'),
          'ABERTA', 'demanda volta pra ABERTA');
select is((select status::text from public.propostas where id = 'b5555555-0000-0000-0000-000000000001'),
          'CANCELADA', 'proposta tambem fica CANCELADA');
select is((select count(*)::int from public.mensagens
             where conversa_id = 'a5555555-0000-0000-0000-000000000001' and tipo = 'SISTEMA'),
          1, 'mensagem SISTEMA inserida');
select is((select corpo from public.mensagens
             where conversa_id = 'a5555555-0000-0000-0000-000000000001' and tipo = 'SISTEMA'),
          'Contratação cancelada.', 'corpo da mensagem SISTEMA');
select is((select count(*)::int from public.notificacoes
             where usuario_id = tests.get_supabase_uid('t5_cli') and tipo = 'CONTRATACAO'
               and referencia_id = 'e5555555-0000-0000-0000-000000000001'),
          1, 'notificacao pra quem NAO cancelou (cliente)');

-- (4) idempotente: 2a chamada nao lanca e nao duplica a mensagem
select tests.authenticate_as('t5_cli');
select lives_ok(
  $$ select public.fn_cancelar_contratacao('e5555555-0000-0000-0000-000000000001') $$,
  '2a chamada idempotente');
reset role;
select is((select count(*)::int from public.mensagens
             where conversa_id = 'a5555555-0000-0000-0000-000000000001' and tipo = 'SISTEMA'),
          1, 'sem 2a mensagem SISTEMA (idempotencia)');

-- Cenario B (conflito): contratacao ja alem de AGUARDANDO_PAGAMENTO
reset role;
insert into public.demandas_servico (id, cliente_id, categoria_id, titulo, descricao, status)
values ('d5555555-0000-0000-0000-000000000002', tests.get_supabase_uid('t5_cli'),
        'c5555555-0000-0000-0000-000000000001', 'Armario', 'x', 'CONTRATADA');
insert into public.conversas (id, tipo, demanda_id, cliente_id, prestador_id)
values ('a5555555-0000-0000-0000-000000000002', 'DEMANDA',
        'd5555555-0000-0000-0000-000000000002',
        tests.get_supabase_uid('t5_cli'), tests.get_supabase_uid('t5_pre'));
insert into public.propostas (id, demanda_id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b5555555-0000-0000-0000-000000000002', 'd5555555-0000-0000-0000-000000000002',
        tests.get_supabase_uid('t5_pre'), tests.get_supabase_uid('t5_cli'),
        'a5555555-0000-0000-0000-000000000002', 300.00, 'armario');
insert into public.contratacoes (id, demanda_id, proposta_id, titulo_servico, cliente_id, prestador_id, valor_total, status)
values ('e5555555-0000-0000-0000-000000000002', 'd5555555-0000-0000-0000-000000000002',
        'b5555555-0000-0000-0000-000000000002', 'Armario',
        tests.get_supabase_uid('t5_cli'), tests.get_supabase_uid('t5_pre'), 300.00, 'AGENDADA');

select tests.authenticate_as('t5_cli');
select throws_ok(
  $$ select public.fn_cancelar_contratacao('e5555555-0000-0000-0000-000000000002') $$,
  'PT409', null, 'contratacao ja AGENDADA nao cancela (PT409)');
reset role;

-- Cenario C (DIRETA): sem demanda_id
reset role;
insert into public.conversas (id, tipo, cliente_id, prestador_id)
values ('a5555555-0000-0000-0000-000000000003', 'DIRETA',
        tests.get_supabase_uid('t5_cli'), tests.get_supabase_uid('t5_pre'));
insert into public.propostas (id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b5555555-0000-0000-0000-000000000003',
        tests.get_supabase_uid('t5_pre'), tests.get_supabase_uid('t5_cli'),
        'a5555555-0000-0000-0000-000000000003', 150.00, 'servico direto');
insert into public.contratacoes (proposta_id, titulo_servico, cliente_id, prestador_id, valor_total, status)
values ('b5555555-0000-0000-0000-000000000003', 'servico direto',
        tests.get_supabase_uid('t5_cli'), tests.get_supabase_uid('t5_pre'), 150.00, 'AGUARDANDO_PAGAMENTO');

select tests.authenticate_as('t5_cli');
select lives_ok(
  format($$ select public.fn_cancelar_contratacao(
    (select id from public.contratacoes where proposta_id = 'b5555555-0000-0000-0000-000000000003')
  ) $$),
  'cancela contratacao DIRETA sem erro');
reset role;
select is((select status::text from public.contratacoes where proposta_id = 'b5555555-0000-0000-0000-000000000003'),
          'CANCELADA', 'contratacao DIRETA CANCELADA');
select is((select count(*)::int from public.mensagens
             where conversa_id = 'a5555555-0000-0000-0000-000000000003' and tipo = 'SISTEMA'),
          1, 'mensagem SISTEMA na conversa DIRETA');

select * from finish();
rollback;
