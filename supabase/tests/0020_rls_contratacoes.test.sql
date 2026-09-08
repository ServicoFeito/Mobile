begin;
select plan(3);

select tests.create_supabase_user('k_cli');
select tests.create_supabase_user('k_pre');
select tests.create_supabase_user('k_estranho');

insert into public.conversas (id, tipo, cliente_id, prestador_id)
values ('eeeeeeee-0000-0000-0000-000000000020', 'DIRETA',
        tests.get_supabase_uid('k_cli'), tests.get_supabase_uid('k_pre'));
insert into public.propostas (id, conversa_id, prestador_id, cliente_id, valor)
values ('ffffffff-0000-0000-0000-000000000020', 'eeeeeeee-0000-0000-0000-000000000020',
        tests.get_supabase_uid('k_pre'), tests.get_supabase_uid('k_cli'), 200.00);
insert into public.contratacoes (id, proposta_id, titulo_servico, cliente_id, prestador_id, valor_total)
values ('99999999-0000-0000-0000-000000000020', 'ffffffff-0000-0000-0000-000000000020',
        'Serviço', tests.get_supabase_uid('k_cli'), tests.get_supabase_uid('k_pre'), 200.00);

-- cliente (parte) lê a contratação
select tests.authenticate_as('k_cli');
select is(
  (select count(*)::int from public.contratacoes where id = '99999999-0000-0000-0000-000000000020'),
  1,
  'cliente parte lê a contratação'
);

-- cliente NÃO consegue inserir contratação (sem policy de INSERT)
select throws_ok(
  $$ insert into public.contratacoes (proposta_id, titulo_servico, cliente_id, prestador_id, valor_total)
     values ('ffffffff-0000-0000-0000-000000000020', 'x',
             tests.get_supabase_uid('k_cli'), tests.get_supabase_uid('k_pre'), 1.00) $$,
  '42501',
  null,
  'cliente não insere em contratacoes (só service_role)'
);

-- estranho não lê a contratação
reset role;
select tests.authenticate_as('k_estranho');
select is(
  (select count(*)::int from public.contratacoes where id = '99999999-0000-0000-0000-000000000020'),
  0,
  'usuário estranho não lê contratação alheia'
);

select * from finish();
rollback;
