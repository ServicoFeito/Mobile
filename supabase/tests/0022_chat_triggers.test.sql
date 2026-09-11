begin;
select plan(9);

select tests.create_supabase_user('t1_cli');
select tests.create_supabase_user('t1_pre');

-- categoria + demanda (para a proposta ter demanda_id)
insert into public.categoria_servico (id, nome, icone_key)
values ('c1111111-0000-0000-0000-000000000001', 'T1 Pintura', 'paint');
insert into public.demandas_servico (id, cliente_id, categoria_id, titulo, descricao)
values ('d1111111-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t1_cli'),
        'c1111111-0000-0000-0000-000000000001', 'Pintar sala', 'duas paredes');

insert into public.conversas (id, tipo, demanda_id, cliente_id, prestador_id)
values ('a1111111-0000-0000-0000-000000000001', 'DEMANDA',
        'd1111111-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t1_cli'), tests.get_supabase_uid('t1_pre'));

-- (A) mensagem de TEXTO do cliente bump nao_lidas_prestador
insert into public.mensagens (conversa_id, remetente_id, tipo, corpo)
values ('a1111111-0000-0000-0000-000000000001', tests.get_supabase_uid('t1_cli'), 'TEXTO', 'oi tudo bem?');

select is(
  (select nao_lidas_prestador from public.conversas where id = 'a1111111-0000-0000-0000-000000000001'),
  1, 'mensagem do cliente incrementa nao_lidas_prestador');
select is(
  (select nao_lidas_cliente from public.conversas where id = 'a1111111-0000-0000-0000-000000000001'),
  0, 'mensagem do cliente NAO incrementa nao_lidas_cliente');
select is(
  (select ultima_mensagem from public.conversas where id = 'a1111111-0000-0000-0000-000000000001'),
  'oi tudo bem?', 'ultima_mensagem = corpo do TEXTO');
select isnt(
  (select data_ultima_mensagem from public.conversas where id = 'a1111111-0000-0000-0000-000000000001'),
  null, 'data_ultima_mensagem preenchida');

-- (B) mensagem do prestador bump nao_lidas_cliente
insert into public.mensagens (conversa_id, remetente_id, tipo, corpo)
values ('a1111111-0000-0000-0000-000000000001', tests.get_supabase_uid('t1_pre'), 'TEXTO', 'tudo, vamos ver');
select is(
  (select nao_lidas_cliente from public.conversas where id = 'a1111111-0000-0000-0000-000000000001'),
  1, 'mensagem do prestador incrementa nao_lidas_cliente');

-- (C) handle_new_proposta insere a mensagem PROPOSTA
insert into public.propostas (id, demanda_id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b1111111-0000-0000-0000-000000000001',
        'd1111111-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t1_pre'), tests.get_supabase_uid('t1_cli'),
        'a1111111-0000-0000-0000-000000000001', 300.00, 'faco por 300');

select is(
  (select count(*)::int from public.mensagens
    where conversa_id = 'a1111111-0000-0000-0000-000000000001'
      and tipo = 'PROPOSTA' and proposta_id = 'b1111111-0000-0000-0000-000000000001'),
  1, 'handle_new_proposta cria 1 mensagem PROPOSTA com proposta_id');
select is(
  (select corpo from public.mensagens
    where proposta_id = 'b1111111-0000-0000-0000-000000000001' and tipo = 'PROPOSTA'),
  'faco por 300', 'corpo da mensagem PROPOSTA = descricao da proposta');
select is(
  (select ultima_mensagem from public.conversas where id = 'a1111111-0000-0000-0000-000000000001'),
  '💼 Proposta', 'resumo da conversa para mensagem PROPOSTA usa o rotulo por tipo');
select is(
  (select total_propostas from public.demandas_servico where id = 'd1111111-0000-0000-0000-000000000001'),
  1, 'handle_new_proposta incrementa total_propostas');

select * from finish();
rollback;
