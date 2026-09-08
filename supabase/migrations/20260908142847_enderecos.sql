create table public.enderecos_usuario (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references public.usuarios (id) on delete cascade,
  identificacao text,
  cep           text,
  estado        text,
  cidade        text,
  bairro        text,
  logradouro    text,
  numero        text,
  complemento   text,
  principal     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index enderecos_usuario_usuario_id_idx on public.enderecos_usuario (usuario_id);
create trigger enderecos_usuario_set_updated_at before update on public.enderecos_usuario
  for each row execute function public.set_updated_at();
