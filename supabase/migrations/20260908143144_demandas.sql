create table public.demandas_servico (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid not null references public.usuarios (id) on delete cascade,
  categoria_id      uuid not null references public.categoria_servico (id),
  titulo            text not null,
  descricao         text not null,
  endereco_cidade   text,
  endereco_bairro   text,
  endereco_completo text,
  orcamento_maximo  numeric(10,2),
  data_desejada     text,
  urgencia          text not null default 'Normal',
  status            public.status_demanda not null default 'ABERTA',
  total_propostas   integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index demandas_servico_cliente_id_idx on public.demandas_servico (cliente_id);
create index demandas_servico_status_idx on public.demandas_servico (status);
create trigger demandas_servico_set_updated_at before update on public.demandas_servico
  for each row execute function public.set_updated_at();

create table public.tarefas_demanda (
  id          uuid primary key default gen_random_uuid(),
  demanda_id  uuid not null references public.demandas_servico (id) on delete cascade,
  nome_tarefa text not null,
  descricao   text,
  concluida   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index tarefas_demanda_demanda_id_idx on public.tarefas_demanda (demanda_id);
