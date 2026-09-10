begin;
select plan(14);

select tests.create_supabase_user('t3_cli');
select tests.create_supabase_user('t3_pre');
select tests.create_supabase_user('t3_outro');

-- categoria_servico: colunas reais (id, nome unique, icone_key not null).
-- nome fora dos seeds para nao violar o unique.
insert into public.categoria_servico (id, nome, icone_key)
values ('c3333333-0000-0000-0000-000000000001', 'T3 Encanamento', 'x');

insert into public.demandas_servico (id, cliente_id, categoria_id, titulo, descricao, status)
values ('d3333333-0000-0000-0000-000000000001', tests.get_supabase_uid('t3_cli'),
        'c3333333-0000-0000-0000-000000000001', 'Vazamento', 'pia', 'ABERTA');

insert into public.conversas (id, tipo, demanda_id, cliente_id, prestador_id)
values ('a3333333-0000-0000-0000-000000000001', 'DEMANDA',
        'd3333333-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t3_cli'), tests.get_supabase_uid('t3_pre'));

-- proposta alvo + irma (mesma demanda_id)
insert into public.propostas (id, demanda_id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b3333333-0000-0000-0000-000000000001', 'd3333333-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t3_pre'), tests.get_supabase_uid('t3_cli'),
        'a3333333-0000-0000-0000-000000000001', 450.00, 'conserto completo');
insert into public.propostas (id, demanda_id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b3333333-0000-0000-0000-000000000002', 'd3333333-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t3_outro'), tests.get_supabase_uid('t3_cli'),
        'a3333333-0000-0000-0000-000000000001', 500.00, 'irma');

-- (1) authz: quem nao e o cliente nao aceita
select tests.authenticate_as('t3_pre');
select throws_ok(
  $$ select public.fn_aceitar_proposta('b3333333-0000-0000-0000-000000000001') $$,
  'PT401', null, 'nao-cliente nao aceita (PT401)');
reset role;

-- (2) inexistente (auth.uid() = cliente para nao cair em PT401 antes do PT404)
select tests.authenticate_as('t3_cli');
select throws_ok(
  $$ select public.fn_aceitar_proposta('00000000-0000-0000-0000-0000000000ff') $$,
  'PT404', null, 'proposta inexistente (PT404)');

-- (3) feliz — chamada real de aceite, como o cliente
select lives_ok(
  $$ select public.fn_aceitar_proposta('b3333333-0000-0000-0000-000000000001') $$,
  'cliente aceita sem erro');

-- inspecao de estado: volta ao papel de migracao (sem RLS) para ler linhas de
-- outras partes (ex.: notificacao do prestador).
reset role;

select is((select status::text from public.propostas where id = 'b3333333-0000-0000-0000-000000000001'),
          'ACEITA', 'proposta alvo ACEITA');
select is((select status::text from public.propostas where id = 'b3333333-0000-0000-0000-000000000002'),
          'RECUSADA', 'irma da mesma demanda RECUSADA');
select is((select count(*)::int from public.contratacoes where proposta_id = 'b3333333-0000-0000-0000-000000000001'),
          1, 'uma contratacao criada');
select is((select valor_total from public.contratacoes where proposta_id = 'b3333333-0000-0000-0000-000000000001'),
          450.00, 'valor_total = valor da proposta');
select is((select status::text from public.demandas_servico where id = 'd3333333-0000-0000-0000-000000000001'),
          'CONTRATADA', 'demanda CONTRATADA');
select is((select count(*)::int from public.mensagens
             where conversa_id = 'a3333333-0000-0000-0000-000000000001' and tipo = 'CONTRATO_GERADO'),
          1, 'mensagem CONTRATO_GERADO inserida');
select is((select count(*)::int from public.notificacoes
             where usuario_id = tests.get_supabase_uid('t3_pre') and tipo = 'CONTRATACAO'),
          1, 'notificacao para o prestador');

-- (4) idempotencia — 2a chamada tem de ver auth.uid() = cliente dentro do SECURITY DEFINER
select tests.authenticate_as('t3_cli');
select is(
  (select public.fn_aceitar_proposta('b3333333-0000-0000-0000-000000000001')),
  (select id from public.contratacoes where proposta_id = 'b3333333-0000-0000-0000-000000000001'),
  '2a chamada retorna a mesma contratacao');
select is((select count(*)::int from public.contratacoes where proposta_id = 'b3333333-0000-0000-0000-000000000001'),
          1, 'sem 2a contratacao');

-- (5) conflito: aceitar a irma ja RECUSADA
select throws_ok(
  $$ select public.fn_aceitar_proposta('b3333333-0000-0000-0000-000000000002') $$,
  'PT409', null, 'aceitar proposta RECUSADA (PT409)');

-- (6) recusar: idempotente em proposta ja RECUSADA
select lives_ok(
  $$ select public.fn_recusar_proposta('b3333333-0000-0000-0000-000000000002') $$,
  'fn_recusar_proposta idempotente em proposta ja RECUSADA');

reset role;
select * from finish();
rollback;
