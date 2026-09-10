begin;
select plan(24);

select tests.create_supabase_user('t3_cli');
select tests.create_supabase_user('t3_pre');
select tests.create_supabase_user('t3_outro');

-- categoria_servico: colunas reais (id, nome unique, icone_key not null).
-- nome fora dos seeds para nao violar o unique.
insert into public.categoria_servico (id, nome, icone_key)
values ('c3333333-0000-0000-0000-000000000001', 'T3 Encanamento', 'x');

-- demanda alvo (fluxo feliz de aceite) + demanda isolada (cobertura de fn_recusar_proposta)
insert into public.demandas_servico (id, cliente_id, categoria_id, titulo, descricao, status)
values ('d3333333-0000-0000-0000-000000000001', tests.get_supabase_uid('t3_cli'),
        'c3333333-0000-0000-0000-000000000001', 'Vazamento', 'pia', 'ABERTA');
insert into public.demandas_servico (id, cliente_id, categoria_id, titulo, descricao, status)
values ('d3333333-0000-0000-0000-000000000002', tests.get_supabase_uid('t3_cli'),
        'c3333333-0000-0000-0000-000000000001', 'Torneira pingando', 'cozinha', 'ABERTA');

-- conversa DEMANDA da demanda alvo
insert into public.conversas (id, tipo, demanda_id, cliente_id, prestador_id)
values ('a3333333-0000-0000-0000-000000000001', 'DEMANDA',
        'd3333333-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t3_cli'), tests.get_supabase_uid('t3_pre'));
-- conversa DEMANDA da demanda isolada
insert into public.conversas (id, tipo, demanda_id, cliente_id, prestador_id)
values ('a3333333-0000-0000-0000-000000000002', 'DEMANDA',
        'd3333333-0000-0000-0000-000000000002',
        tests.get_supabase_uid('t3_cli'), tests.get_supabase_uid('t3_pre'));
-- conversa DIRETA (sem demanda) -> caminho demanda_id null
insert into public.conversas (id, tipo, cliente_id, prestador_id)
values ('a3333333-0000-0000-0000-000000000003', 'DIRETA',
        tests.get_supabase_uid('t3_cli'), tests.get_supabase_uid('t3_outro'));

-- proposta alvo + irma (mesma demanda_id)
insert into public.propostas (id, demanda_id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b3333333-0000-0000-0000-000000000001', 'd3333333-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t3_pre'), tests.get_supabase_uid('t3_cli'),
        'a3333333-0000-0000-0000-000000000001', 450.00, 'conserto completo');
insert into public.propostas (id, demanda_id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b3333333-0000-0000-0000-000000000002', 'd3333333-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t3_outro'), tests.get_supabase_uid('t3_cli'),
        'a3333333-0000-0000-0000-000000000001', 500.00, 'irma');
-- proposta ENVIADA da demanda isolada -> exercita o write path de fn_recusar_proposta
insert into public.propostas (id, demanda_id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b3333333-0000-0000-0000-000000000003', 'd3333333-0000-0000-0000-000000000002',
        tests.get_supabase_uid('t3_pre'), tests.get_supabase_uid('t3_cli'),
        'a3333333-0000-0000-0000-000000000002', 300.00, 'trocar a torneira');
-- proposta DIRETA (demanda_id null) -> titulo_servico vem do fallback da descricao
insert into public.propostas (id, demanda_id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b3333333-0000-0000-0000-000000000004', null,
        tests.get_supabase_uid('t3_outro'), tests.get_supabase_uid('t3_cli'),
        'a3333333-0000-0000-0000-000000000003', 200.00, 'reparo direto');

-- ============================================================================
-- fn_aceitar_proposta -- fluxo feliz (demanda)
-- ============================================================================

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

-- (3) feliz -- chamada real de aceite, como o cliente
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

-- (11) idempotencia -- 2a chamada tem de ver auth.uid() = cliente dentro do SECURITY DEFINER
select tests.authenticate_as('t3_cli');
select is(
  (select public.fn_aceitar_proposta('b3333333-0000-0000-0000-000000000001')),
  (select id from public.contratacoes where proposta_id = 'b3333333-0000-0000-0000-000000000001'),
  '2a chamada retorna a mesma contratacao (antes do check de demanda)');
select is((select count(*)::int from public.contratacoes where proposta_id = 'b3333333-0000-0000-0000-000000000001'),
          1, 'sem 2a contratacao');

-- (13) conflito: aceitar a irma ja RECUSADA
select throws_ok(
  $$ select public.fn_aceitar_proposta('b3333333-0000-0000-0000-000000000002') $$,
  'PT409', null, 'aceitar proposta RECUSADA (PT409)');

-- (14) recusar: idempotente em proposta ja RECUSADA (early return, sem write)
select lives_ok(
  $$ select public.fn_recusar_proposta('b3333333-0000-0000-0000-000000000002') $$,
  'fn_recusar_proposta idempotente em proposta ja RECUSADA');

-- ============================================================================
-- fn_aceitar_proposta -- guarda de 2a contratacao na mesma demanda (Plano 5)
-- ============================================================================

-- proposta nova, ENVIADA, na demanda d...01 que ja esta CONTRATADA
reset role;
insert into public.propostas (id, demanda_id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b3333333-0000-0000-0000-000000000006', 'd3333333-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t3_pre'), tests.get_supabase_uid('t3_cli'),
        'a3333333-0000-0000-0000-000000000001', 480.00, 'tentativa tardia');

select tests.authenticate_as('t3_cli');
select throws_ok(
  $$ select public.fn_aceitar_proposta('b3333333-0000-0000-0000-000000000006') $$,
  'PT409', null, 'aceitar 2a proposta numa demanda ja CONTRATADA (PT409)');
reset role;
select is((select count(*)::int from public.contratacoes
             where demanda_id = 'd3333333-0000-0000-0000-000000000001'),
          1, 'demanda CONTRATADA continua com uma unica contratacao');

-- ============================================================================
-- fn_recusar_proposta -- authz + write path (demanda isolada d...02, proposta b...03)
-- ============================================================================

-- (17) nao-cliente nao recusa
select tests.authenticate_as('t3_pre');
select throws_ok(
  $$ select public.fn_recusar_proposta('b3333333-0000-0000-0000-000000000003') $$,
  'PT401', null, 'nao-cliente nao recusa (PT401)');
reset role;

-- (18) recusar proposta inexistente
select tests.authenticate_as('t3_cli');
select throws_ok(
  $$ select public.fn_recusar_proposta('ffffffff-0000-0000-0000-000000000000') $$,
  'PT404', null, 'recusar proposta inexistente (PT404)');

-- (19)+(20) cliente recusa uma proposta ENVIADA -> RECUSADA (write path real)
select lives_ok(
  $$ select public.fn_recusar_proposta('b3333333-0000-0000-0000-000000000003') $$,
  'cliente recusa proposta ENVIADA sem erro');
reset role;
select is((select status::text from public.propostas where id = 'b3333333-0000-0000-0000-000000000003'),
          'RECUSADA', 'proposta recusada fica RECUSADA');

-- ============================================================================
-- fn_aceitar_proposta -- caminho DIRETA (demanda_id null)
-- ============================================================================

select tests.authenticate_as('t3_cli');
select lives_ok(
  $$ select public.fn_aceitar_proposta('b3333333-0000-0000-0000-000000000004') $$,
  'cliente aceita proposta DIRETA sem erro');
reset role;
select is((select titulo_servico from public.contratacoes
             where proposta_id = 'b3333333-0000-0000-0000-000000000004'),
          'reparo direto', 'DIRETA: titulo_servico vem do fallback da descricao da proposta');
select ok((select demanda_id from public.contratacoes
             where proposta_id = 'b3333333-0000-0000-0000-000000000004') is null,
          'DIRETA: contratacao sem demanda_id');
select is((select status::text from public.demandas_servico where id = 'd3333333-0000-0000-0000-000000000002'),
          'ABERTA', 'DIRETA: nenhuma demanda foi marcada CONTRATADA');

reset role;
select * from finish();
rollback;
