create table public.contratacoes (
  id             uuid primary key default gen_random_uuid(),
  demanda_id     uuid references public.demandas_servico (id) on delete set null,
  proposta_id    uuid not null unique references public.propostas (id) on delete restrict,
  titulo_servico text not null,
  cliente_id     uuid not null references public.usuarios (id) on delete cascade,
  prestador_id   uuid not null references public.usuarios (id) on delete cascade,
  valor_total    numeric(10,2) not null check (valor_total >= 0),
  valor_entrada  numeric(10,2) generated always as (round(valor_total * 0.50, 2)) stored,
  valor_final    numeric(10,2) generated always as (round(valor_total * 0.50, 2)) stored,
  taxa_plataforma numeric(10,2) generated always as (round(valor_total * 0.20, 2)) stored,
  status         public.status_contratacao not null default 'AGUARDANDO_PAGAMENTO',
  entrada_paga   boolean not null default false,
  final_pago     boolean not null default false,
  avaliado       boolean not null default false,
  data_agendada  text,
  data_conclusao timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index contratacoes_cliente_id_idx on public.contratacoes (cliente_id);
create index contratacoes_prestador_id_idx on public.contratacoes (prestador_id);
create trigger contratacoes_set_updated_at before update on public.contratacoes
  for each row execute function public.set_updated_at();

create table public.pagamentos (
  id             uuid primary key default gen_random_uuid(),
  contratacao_id uuid not null references public.contratacoes (id) on delete cascade,
  valor          numeric(10,2) not null check (valor >= 0),
  tipo           public.tipo_pagamento not null,
  status         public.status_pagamento not null default 'PENDENTE',
  gateway        text not null default 'EFI_PIX',
  txid           text unique,
  efi_loc_id     bigint,
  pix_copia_cola text,
  qr_code_base64 text,
  data_pagamento timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (contratacao_id, tipo)
);
create index pagamentos_contratacao_id_idx on public.pagamentos (contratacao_id);
create trigger pagamentos_set_updated_at before update on public.pagamentos
  for each row execute function public.set_updated_at();
