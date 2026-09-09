create table public.avaliacoes (
  id             uuid primary key default gen_random_uuid(),
  contratacao_id uuid not null references public.contratacoes (id) on delete cascade,
  avaliador_id   uuid not null references public.usuarios (id) on delete cascade,
  prestador_id   uuid not null references public.usuarios (id) on delete cascade,
  nota           integer not null check (nota between 1 and 5),
  comentario     text,
  pontualidade   boolean not null default true,
  qualidade      boolean not null default true,
  cordialidade   boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (contratacao_id, avaliador_id)
);
create index avaliacoes_prestador_id_idx on public.avaliacoes (prestador_id);

create table public.notificacoes (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references public.usuarios (id) on delete cascade,
  titulo       text not null,
  mensagem     text not null,
  tipo         public.tipo_notificacao not null,
  referencia_id uuid,
  lida         boolean not null default false,
  created_at   timestamptz not null default now()
);
create index notificacoes_usuario_id_created_at_idx on public.notificacoes (usuario_id, created_at desc);
