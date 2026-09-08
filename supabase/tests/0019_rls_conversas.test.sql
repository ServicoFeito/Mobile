begin;
select plan(3);

select tests.create_supabase_user('c_cli');
select tests.create_supabase_user('c_preA');
select tests.create_supabase_user('c_preB');

-- conversa entre cliente e prestador A, com participantes
insert into public.conversas (id, tipo, cliente_id, prestador_id)
values ('dddddddd-0000-0000-0000-000000000019', 'DIRETA',
        tests.get_supabase_uid('c_cli'), tests.get_supabase_uid('c_preA'));
insert into public.participantes_conversa (conversa_id, usuario_id, papel) values
  ('dddddddd-0000-0000-0000-000000000019', tests.get_supabase_uid('c_cli'),  'CLIENTE'),
  ('dddddddd-0000-0000-0000-000000000019', tests.get_supabase_uid('c_preA'), 'PRESTADOR');
insert into public.mensagens (conversa_id, remetente_id, corpo)
values ('dddddddd-0000-0000-0000-000000000019', tests.get_supabase_uid('c_cli'), 'ola A');

-- prestador A (participante) lê a mensagem
select tests.authenticate_as('c_preA');
select is(
  (select count(*)::int from public.mensagens where conversa_id = 'dddddddd-0000-0000-0000-000000000019'),
  1,
  'prestador A participante lê a mensagem'
);

-- prestador B (NÃO participante) não lê nada dessa conversa (RB15)
reset role;
select tests.authenticate_as('c_preB');
select is(
  (select count(*)::int from public.mensagens where conversa_id = 'dddddddd-0000-0000-0000-000000000019'),
  0,
  'prestador B não participante NÃO lê mensagens da conversa de A'
);
select is(
  (select count(*)::int from public.conversas where id = 'dddddddd-0000-0000-0000-000000000019'),
  0,
  'prestador B não participante NÃO enxerga a conversa'
);

select * from finish();
rollback;
