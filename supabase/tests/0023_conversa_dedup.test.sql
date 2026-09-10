begin;
select plan(4);

select tests.create_supabase_user('t2_cli');
select tests.create_supabase_user('t2_pre');

insert into public.categoria_servico (id, nome, icone_key)
values ('c2222222-0000-0000-0000-000000000001', 'T2 Eletrica', 'bolt');
insert into public.demandas_servico (id, cliente_id, categoria_id, titulo, descricao)
values ('d2222222-0000-0000-0000-000000000001', tests.get_supabase_uid('t2_cli'),
        'c2222222-0000-0000-0000-000000000001', 'Troca de tomada', 'x');
insert into public.demandas_servico (id, cliente_id, categoria_id, titulo, descricao)
values ('d2222222-0000-0000-0000-000000000002', tests.get_supabase_uid('t2_cli'),
        'c2222222-0000-0000-0000-000000000001', 'Outra demanda', 'y');

-- (1) 2a conversa DEMANDA com o mesmo (demanda, prestador) viola o indice
insert into public.conversas (tipo, demanda_id, cliente_id, prestador_id)
values ('DEMANDA', 'd2222222-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t2_cli'), tests.get_supabase_uid('t2_pre'));
select throws_ok(
  format($$ insert into public.conversas (tipo, demanda_id, cliente_id, prestador_id)
            values ('DEMANDA', 'd2222222-0000-0000-0000-000000000001', %L, %L) $$,
         tests.get_supabase_uid('t2_cli'), tests.get_supabase_uid('t2_pre')),
  '23505', null, '2a conversa DEMANDA do mesmo (demanda, prestador) viola o indice');

-- (2) 2a conversa DIRETA com o mesmo (cliente, prestador) viola o indice
insert into public.conversas (tipo, cliente_id, prestador_id)
values ('DIRETA', tests.get_supabase_uid('t2_cli'), tests.get_supabase_uid('t2_pre'));
select throws_ok(
  format($$ insert into public.conversas (tipo, cliente_id, prestador_id)
            values ('DIRETA', %L, %L) $$,
         tests.get_supabase_uid('t2_cli'), tests.get_supabase_uid('t2_pre')),
  '23505', null, '2a conversa DIRETA do mesmo par viola o indice');

-- (3) uma DIRETA e uma DEMANDA do mesmo par coexistem (indices sao parciais por tipo)
select is(
  (select count(*)::int from public.conversas
     where cliente_id = tests.get_supabase_uid('t2_cli')
       and prestador_id = tests.get_supabase_uid('t2_pre')),
  2, 'DIRETA e DEMANDA do mesmo par coexistem');

-- (4) 2a conversa DEMANDA do mesmo prestador com OUTRA demanda coexiste
select lives_ok(
  format($$ insert into public.conversas (tipo, demanda_id, cliente_id, prestador_id)
            values ('DEMANDA', 'd2222222-0000-0000-0000-000000000002', %L, %L) $$,
         tests.get_supabase_uid('t2_cli'), tests.get_supabase_uid('t2_pre')),
  'DEMANDA com demanda_id diferente nao colide');

select * from finish();
rollback;
