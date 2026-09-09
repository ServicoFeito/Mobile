begin;
select plan(3);

select has_table('public', 'demandas_servico', 'tabela demandas_servico existe');
select has_table('public', 'tarefas_demanda', 'tabela tarefas_demanda existe');

select tests.create_supabase_user('dem_cli');
insert into public.demandas_servico (cliente_id, categoria_id, titulo, descricao)
select tests.get_supabase_uid('dem_cli'), id, 'Trocar tomadas', 'Trocar 4 tomadas na sala'
from public.categoria_servico where nome = 'Elétrica';
select is(
  (select status::text from public.demandas_servico where cliente_id = tests.get_supabase_uid('dem_cli')),
  'ABERTA',
  'demanda nasce com status ABERTA'
);

select * from finish();
rollback;
