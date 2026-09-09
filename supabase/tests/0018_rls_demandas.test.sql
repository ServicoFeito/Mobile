begin;
select plan(3);

select tests.create_supabase_user('dem_cliente');
select tests.create_supabase_user('dem_prestador');
select tests.create_supabase_user('dem_outro');
insert into public.perfil_prestador (usuario_id) values (tests.get_supabase_uid('dem_prestador'));

-- cliente cria uma demanda ABERTA
select tests.authenticate_as('dem_cliente');
insert into public.demandas_servico (id, cliente_id, categoria_id, titulo, descricao)
select 'cccccccc-0000-0000-0000-000000000018', tests.get_supabase_uid('dem_cliente'), id,
       'Pintar quarto', 'Pintar 1 quarto de 12m2'
from public.categoria_servico where nome = 'Pintura';

-- prestador (com perfil) enxerga a demanda ABERTA
reset role;
select tests.authenticate_as('dem_prestador');
select is(
  (select count(*)::int from public.demandas_servico where id = 'cccccccc-0000-0000-0000-000000000018'),
  1,
  'prestador vê demanda ABERTA de terceiro'
);

-- usuário sem perfil_prestador NÃO enxerga a demanda de terceiro
reset role;
select tests.authenticate_as('dem_outro');
select is(
  (select count(*)::int from public.demandas_servico where id = 'cccccccc-0000-0000-0000-000000000018'),
  0,
  'não-prestador não vê demanda de terceiro'
);

-- não-prestador também não consegue alterar a demanda alheia
with upd as (
  update public.demandas_servico set titulo = 'hack'
  where id = 'cccccccc-0000-0000-0000-000000000018' returning 1
)
select is(
  (select count(*)::int from upd),
  0,
  'não-dono não altera demanda alheia (0 linhas afetadas)'
);

select * from finish();
rollback;
