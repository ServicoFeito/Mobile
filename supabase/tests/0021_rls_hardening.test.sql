begin;
select plan(19);

-- ==========================================================================
-- setup (papel runner/owner: bypassa RLS e grants por coluna)
-- ==========================================================================
select tests.create_supabase_user('h_cli');
select tests.create_supabase_user('h_pre');
select tests.create_supabase_user('h_out');   -- forasteiro / cliente puro (sem perfil_prestador)

insert into public.perfil_prestador (usuario_id, chave_pix, preco_base)
values (tests.get_supabase_uid('h_pre'), 'pix-secreta-123', 123.45);

-- conversa -> trigger F-I9 popula participantes_conversa automaticamente
insert into public.conversas (id, tipo, cliente_id, prestador_id)
values ('a1a1a1a1-0000-0000-0000-000000000021', 'DIRETA',
        tests.get_supabase_uid('h_cli'), tests.get_supabase_uid('h_pre'));

insert into public.propostas (id, conversa_id, prestador_id, cliente_id, valor)
values ('b2b2b2b2-0000-0000-0000-000000000021', 'a1a1a1a1-0000-0000-0000-000000000021',
        tests.get_supabase_uid('h_pre'), tests.get_supabase_uid('h_cli'), 100.01);

insert into public.contratacoes (id, proposta_id, titulo_servico, cliente_id, prestador_id, valor_total)
values ('c3c3c3c3-0000-0000-0000-000000000021', 'b2b2b2b2-0000-0000-0000-000000000021',
        'Servico 21', tests.get_supabase_uid('h_cli'), tests.get_supabase_uid('h_pre'), 100.01);

insert into public.mensagens (id, conversa_id, remetente_id, corpo)
values ('e5e5e5e5-0000-0000-0000-000000000021', 'a1a1a1a1-0000-0000-0000-000000000021',
        tests.get_supabase_uid('h_cli'), 'mensagem original');

-- ==========================================================================
-- F-I9 — trigger on_conversa_created popula exatamente 2 participantes
-- ==========================================================================
select is(
  (select count(*)::int from public.participantes_conversa
   where conversa_id = 'a1a1a1a1-0000-0000-0000-000000000021'),
  2,
  'F-I9: insert em conversas gera exatamente 2 participantes'
);
select is(
  (select array_agg(papel order by papel) from public.participantes_conversa
   where conversa_id = 'a1a1a1a1-0000-0000-0000-000000000021'),
  array['CLIENTE', 'PRESTADOR']::text[],
  'F-I9: papeis CLIENTE + PRESTADOR'
);

-- ==========================================================================
-- F-C3 — 50/50 de contratacoes soma valor_total EXATAMENTE
-- ==========================================================================
select is(
  (select valor_entrada from public.contratacoes where id = 'c3c3c3c3-0000-0000-0000-000000000021'),
  50.01::numeric,
  'F-C3: valor_entrada = round(100.01 * 0.50, 2) = 50.01'
);
select is(
  (select valor_final from public.contratacoes where id = 'c3c3c3c3-0000-0000-0000-000000000021'),
  50.00::numeric,
  'F-C3: valor_final = 100.01 - 50.01 = 50.00'
);
select is(
  (select valor_entrada + valor_final from public.contratacoes where id = 'c3c3c3c3-0000-0000-0000-000000000021'),
  100.01::numeric,
  'F-C3: valor_entrada + valor_final = valor_total (sem centavo perdido)'
);

-- ==========================================================================
-- F-I7 — perfis_publicos só expõe quem tem perfil_prestador (INNER join)
-- ==========================================================================
select has_view('public', 'perfis_publicos', 'F-I7: view perfis_publicos existe');
select is(
  (select count(*)::int from public.perfis_publicos where usuario_id = tests.get_supabase_uid('h_out')),
  0,
  'F-I7: usuario sem perfil_prestador NAO aparece em perfis_publicos'
);
select is(
  (select count(*)::int from public.perfis_publicos where usuario_id = tests.get_supabase_uid('h_pre')),
  1,
  'F-I7: usuario com perfil_prestador aparece em perfis_publicos'
);

-- ==========================================================================
-- F-C1 — chave_pix / cnpj_mei nao vazam para authenticated (grant por coluna)
-- F-C2 — forasteiro nao se auto-inclui numa conversa
-- ==========================================================================
select tests.authenticate_as('h_out');

select throws_ok(
  $$ select chave_pix from public.perfil_prestador $$,
  '42501', null,
  'F-C1: authenticated recebe 42501 ao ler chave_pix'
);
select lives_ok(
  $$ select preco_base from public.perfil_prestador $$,
  'F-C1: authenticated le preco_base normalmente'
);
select throws_ok(
  format($$ insert into public.participantes_conversa (conversa_id, usuario_id, papel)
            values ('a1a1a1a1-0000-0000-0000-000000000021', %L, 'CLIENTE') $$,
         tests.get_supabase_uid('h_out')),
  '42501', null,
  'F-C2: nao-parte nao insere em participantes_conversa'
);

-- ==========================================================================
-- F-I8b — dono edita o proprio perfil em usuarios (colunas restritas)
-- ==========================================================================
select lives_ok(
  format($$ update public.usuarios set nome = 'Novo Nome' where id = %L $$,
         tests.get_supabase_uid('h_out')),
  'F-I8b: dono atualiza o proprio usuarios.nome'
);
select throws_ok(
  format($$ update public.usuarios set status_conta = 'Banida' where id = %L $$,
         tests.get_supabase_uid('h_out')),
  '42501', null,
  'F-I8b: dono NAO altera usuarios.status_conta (sem grant de coluna)'
);

-- ==========================================================================
-- F-I4 — so o prestador altera a proposta
-- ==========================================================================
reset role;
select tests.authenticate_as('h_cli');
with upd as (
  update public.propostas set valor = 1
  where id = 'b2b2b2b2-0000-0000-0000-000000000021'
  returning 1
)
select is((select count(*)::int from upd), 0,
  'F-I4: cliente NAO altera a proposta (0 linhas afetadas)');

reset role;
select tests.authenticate_as('h_pre');
with upd as (
  update public.propostas set valor = 150
  where id = 'b2b2b2b2-0000-0000-0000-000000000021'
  returning 1
)
select is((select count(*)::int from upd), 1,
  'F-I4: prestador altera a propria proposta (1 linha afetada)');

-- ==========================================================================
-- F-I10 — destinatario marca `lida`; nao reescreve `corpo`
-- ==========================================================================
reset role;
select tests.authenticate_as('h_pre');   -- participante, NAO e o remetente (h_cli)
with upd as (
  update public.mensagens set lida = true
  where id = 'e5e5e5e5-0000-0000-0000-000000000021'
  returning 1
)
select is((select count(*)::int from upd), 1,
  'F-I10: participante nao-remetente marca a mensagem como lida');
select throws_ok(
  $$ update public.mensagens set corpo = 'reescrito' where id = 'e5e5e5e5-0000-0000-0000-000000000021' $$,
  '42501', null,
  'F-I10: participante nao-remetente NAO reescreve corpo'
);

-- ==========================================================================
-- F-I6 — avaliacao exige contratacao CONCLUIDA da qual voce foi parte (RB10)
-- ==========================================================================
reset role;
select tests.authenticate_as('h_cli');
select throws_ok(
  format($$ insert into public.avaliacoes (contratacao_id, avaliador_id, prestador_id, nota)
            values ('c3c3c3c3-0000-0000-0000-000000000021', %L, %L, 5) $$,
         tests.get_supabase_uid('h_cli'), tests.get_supabase_uid('h_pre')),
  '42501', null,
  'F-I6: contratacao nao-CONCLUIDA barra a avaliacao'
);

reset role;
update public.contratacoes set status = 'CONCLUIDA'
where id = 'c3c3c3c3-0000-0000-0000-000000000021';

select tests.authenticate_as('h_cli');
select lives_ok(
  format($$ insert into public.avaliacoes (contratacao_id, avaliador_id, prestador_id, nota)
            values ('c3c3c3c3-0000-0000-0000-000000000021', %L, %L, 5) $$,
         tests.get_supabase_uid('h_cli'), tests.get_supabase_uid('h_pre')),
  'F-I6: parte de contratacao CONCLUIDA consegue avaliar'
);

select * from finish();
rollback;
