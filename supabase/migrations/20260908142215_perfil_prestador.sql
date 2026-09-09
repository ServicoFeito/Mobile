create table public.perfil_prestador (
  usuario_id          uuid primary key references public.usuarios (id) on delete cascade,
  titulo_profissional text,
  bio                 text,
  cnpj_mei            text,
  tem_mei             boolean not null default false,
  verificado          boolean not null default false,
  documento_verificado boolean not null default false,
  selo_fundador       boolean not null default false,
  preco_base          numeric(10,2) not null default 0,
  tempo_experiencia   text,
  rating              numeric(3,2) not null default 0,
  total_avaliacoes    integer not null default 0,
  total_servicos      integer not null default 0,
  disponivel          boolean not null default true,
  raio_km             integer not null default 25,
  chave_pix           text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table public.perfil_prestador is
  'Presença da linha = o usuário atua como prestador (RB01/RB11).';
create trigger perfil_prestador_set_updated_at before update on public.perfil_prestador
  for each row execute function public.set_updated_at();

create table public.portfolio_prestador (
  id           uuid primary key default gen_random_uuid(),
  prestador_id uuid not null references public.perfil_prestador (usuario_id) on delete cascade,
  url_media    text not null,
  created_at   timestamptz not null default now()
);
create index portfolio_prestador_prestador_id_idx on public.portfolio_prestador (prestador_id);

create table public.disponibilidade_prestador (
  usuario_id uuid primary key references public.perfil_prestador (usuario_id) on delete cascade,
  seg        boolean not null default true,
  ter        boolean not null default true,
  qua        boolean not null default true,
  qui        boolean not null default true,
  sex        boolean not null default true,
  sab        boolean not null default false,
  dom        boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger disponibilidade_prestador_set_updated_at before update on public.disponibilidade_prestador
  for each row execute function public.set_updated_at();

create table public.licencas_certificados (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references public.usuarios (id) on delete cascade,
  titulo        text not null,
  instituicao   text,
  data_inicio   text,
  data_fim      text,
  url_imagem    text,
  cod_credencial text,
  created_at    timestamptz not null default now()
);
create index licencas_certificados_usuario_id_idx on public.licencas_certificados (usuario_id);
