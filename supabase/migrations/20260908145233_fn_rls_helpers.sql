create or replace function public.fn_e_participante(p_conversa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participantes_conversa pc
    where pc.conversa_id = p_conversa_id
      and pc.usuario_id = (select auth.uid())
  );
$$;
comment on function public.fn_e_participante(uuid) is
  'RB03/RB14/RB15: o usuário atual participa desta conversa?';

create or replace function public.fn_tem_perfil_prestador(p_usuario_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfil_prestador p
    where p.usuario_id = coalesce(p_usuario_id, (select auth.uid()))
  );
$$;
comment on function public.fn_tem_perfil_prestador(uuid) is
  'RB01/RB11: o usuário atua como prestador (tem perfil_prestador)?';

grant execute on function public.fn_e_participante(uuid) to anon, authenticated;
grant execute on function public.fn_tem_perfil_prestador(uuid) to anon, authenticated;
