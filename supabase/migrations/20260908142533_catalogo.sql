create table public.categoria_servico (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null unique,
  descricao        text,
  icone_key        text not null,
  preco_medio_hora numeric(10,2) not null default 0,
  popular          boolean not null default false,
  created_at       timestamptz not null default now()
);

insert into public.categoria_servico (nome, descricao, icone_key, preco_medio_hora, popular) values
  ('Limpeza',        'Diaristas, faxina e limpeza pós-obra',        'cleaning',         50, true),
  ('Elétrica',       'Instalações e reparos elétricos',            'electrical',       90, true),
  ('Pintura',        'Pintura residencial e comercial',            'paint',            70, true),
  ('Alvenaria',      'Pedreiro, reformas e pequenos reparos',      'masonry',          80, true),
  ('Jardinagem',     'Poda, corte de grama e paisagismo',          'garden',           45, false),
  ('Mecânica',       'Serviços automotivos',                       'mechanic',        100, false),
  ('Encanamento',    'Hidráulica e desentupimento',               'plumbing',         85, true),
  ('Marcenaria',     'Móveis planejados e reparos em madeira',     'carpentry',        95, false),
  ('Ar-condicionado','Instalação e limpeza de ar-condicionado',    'air_conditioning',120, false);

create table public.prestador_categoria (
  prestador_id uuid not null references public.perfil_prestador (usuario_id) on delete cascade,
  categoria_id uuid not null references public.categoria_servico (id) on delete cascade,
  primary key (prestador_id, categoria_id)
);
create index prestador_categoria_categoria_id_idx on public.prestador_categoria (categoria_id);
