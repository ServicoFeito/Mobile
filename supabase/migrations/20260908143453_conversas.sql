create table public.conversas (
  id                   uuid primary key default gen_random_uuid(),
  tipo                 public.tipo_conversa not null,
  demanda_id           uuid references public.demandas_servico (id) on delete set null,
  cliente_id           uuid not null references public.usuarios (id) on delete cascade,
  prestador_id         uuid not null references public.usuarios (id) on delete cascade,
  status               public.status_conversa not null default 'ATIVA',
  ultima_mensagem      text,
  data_ultima_mensagem timestamptz,
  nao_lidas_cliente    integer not null default 0,
  nao_lidas_prestador  integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint conversas_demanda_obrigatoria_quando_tipo_demanda
    check (tipo = 'DIRETA' or demanda_id is not null)
);
create index conversas_cliente_id_idx on public.conversas (cliente_id);
create index conversas_prestador_id_idx on public.conversas (prestador_id);
create index conversas_demanda_id_idx on public.conversas (demanda_id);
create trigger conversas_set_updated_at before update on public.conversas
  for each row execute function public.set_updated_at();

create table public.participantes_conversa (
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  usuario_id  uuid not null references public.usuarios (id) on delete cascade,
  papel       text not null check (papel in ('CLIENTE', 'PRESTADOR')),
  primary key (conversa_id, usuario_id)
);
create index participantes_conversa_usuario_id_idx on public.participantes_conversa (usuario_id);

create table public.mensagens (
  id           uuid primary key default gen_random_uuid(),
  conversa_id  uuid not null references public.conversas (id) on delete cascade,
  remetente_id uuid not null references public.usuarios (id) on delete cascade,
  tipo         public.tipo_mensagem not null default 'TEXTO',
  corpo        text not null default '',
  proposta_id  uuid,
  lida         boolean not null default false,
  created_at   timestamptz not null default now()
);
create index mensagens_conversa_id_created_at_idx on public.mensagens (conversa_id, created_at);

create table public.anexos_mensagem (
  id           uuid primary key default gen_random_uuid(),
  mensagem_id  uuid not null references public.mensagens (id) on delete cascade,
  url          text not null,
  nome_arquivo text,
  tipo_arquivo text,
  tamanho      bigint not null default 0,
  created_at   timestamptz not null default now()
);
create index anexos_mensagem_mensagem_id_idx on public.anexos_mensagem (mensagem_id);
