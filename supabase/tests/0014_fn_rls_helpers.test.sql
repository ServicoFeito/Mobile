begin;
select plan(4);

select has_function('public', 'fn_e_participante', 'fn_e_participante existe');
select has_function('public', 'fn_tem_perfil_prestador', 'fn_tem_perfil_prestador existe');

select tests.create_supabase_user('h_cli');
select tests.create_supabase_user('h_pre');
insert into public.perfil_prestador (usuario_id) values (tests.get_supabase_uid('h_pre'));
insert into public.conversas (id, tipo, cliente_id, prestador_id)
values ('aaaaaaaa-0000-0000-0000-000000000014', 'DIRETA',
        tests.get_supabase_uid('h_cli'), tests.get_supabase_uid('h_pre'));
insert into public.participantes_conversa (conversa_id, usuario_id, papel) values
  ('aaaaaaaa-0000-0000-0000-000000000014', tests.get_supabase_uid('h_cli'), 'CLIENTE'),
  ('aaaaaaaa-0000-0000-0000-000000000014', tests.get_supabase_uid('h_pre'), 'PRESTADOR');

select tests.authenticate_as('h_cli');
select ok(
  public.fn_e_participante('aaaaaaaa-0000-0000-0000-000000000014'),
  'cliente participante: fn_e_participante = true'
);

reset role;
select tests.authenticate_as('h_cli');
select ok(
  not public.fn_tem_perfil_prestador(),
  'cliente sem perfil_prestador: fn_tem_perfil_prestador = false'
);

select * from finish();
rollback;
