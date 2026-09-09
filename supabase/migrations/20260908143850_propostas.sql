create table public.propostas (
  id                      uuid primary key default gen_random_uuid(),
  demanda_id              uuid references public.demandas_servico (id) on delete set null,
  prestador_id            uuid not null references public.usuarios (id) on delete cascade,
  cliente_id              uuid not null references public.usuarios (id) on delete cascade,
  conversa_id             uuid not null references public.conversas (id) on delete cascade,
  valor                   numeric(10,2) not null check (valor >= 0),
  taxa_plataforma         numeric(10,2) generated always as (round(valor * 0.20, 2)) stored,
  valor_liquido_prestador numeric(10,2) generated always as (round(valor * 0.80, 2)) stored,
  descricao               text not null default '',
  prazo_execucao          text,
  validade_dias           integer not null default 7,
  status                  public.status_proposta not null default 'ENVIADA',
  tarefas_ids             text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index propostas_conversa_id_idx on public.propostas (conversa_id);
create index propostas_demanda_id_idx on public.propostas (demanda_id);
create trigger propostas_set_updated_at before update on public.propostas
  for each row execute function public.set_updated_at();

alter table public.mensagens
  add constraint mensagens_proposta_id_fkey
  foreign key (proposta_id) references public.propostas (id) on delete set null;
