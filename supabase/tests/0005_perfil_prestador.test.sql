begin;
select plan(5);

select has_table('public', 'perfil_prestador', 'tabela perfil_prestador existe');
select has_table('public', 'portfolio_prestador', 'tabela portfolio_prestador existe');
select has_table('public', 'disponibilidade_prestador', 'tabela disponibilidade_prestador existe');
select has_table('public', 'licencas_certificados', 'tabela licencas_certificados existe');

-- CASCADE: apagar o usuário apaga o perfil
select tests.create_supabase_user('prest_a');
insert into public.perfil_prestador (usuario_id) values (tests.get_supabase_uid('prest_a'));
delete from auth.users where id = tests.get_supabase_uid('prest_a');
select is(
  (select count(*)::int from public.perfil_prestador where usuario_id = tests.get_supabase_uid('prest_a')),
  0,
  'apagar auth.users faz cascade até perfil_prestador'
);

select * from finish();
rollback;
