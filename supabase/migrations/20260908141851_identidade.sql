create table public.usuarios (
  id                        uuid primary key references auth.users (id) on delete cascade,
  nome                      text,
  telefone                  text,
  cidade                    text,
  bairro                    text,
  avatar_cor_hex            text not null default '#4DAF50',
  foto_perfil_url           text,
  status_conta              text not null default 'Ativa',
  rating_cliente            numeric(3,2) not null default 5.0,
  total_contratacoes_cliente integer not null default 0,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on table public.usuarios is 'Perfil base do usuário (1:1 com auth.users). RB01: conta unificada.';

create trigger usuarios_set_updated_at before update on public.usuarios
  for each row execute function public.set_updated_at();

-- Cria a linha base em public.usuarios quando um auth.users nasce.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usuarios (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
