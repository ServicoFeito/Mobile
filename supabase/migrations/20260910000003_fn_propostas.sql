-- Plano 4 — logica transacional de proposta (aceitar / recusar).
-- SECURITY DEFINER (dono postgres): ignora RLS — nenhuma tabela tem FORCE RLS —
-- e os grants por-coluna, podendo escrever em contratacoes / notificacoes, onde
-- `authenticated` nao tem grant de escrita (so service_role).
-- SQLSTATEs custom no padrao PostgREST: PT401 (nao autorizado), PT404 (inexistente),
-- PT409 (conflito de estado).

create or replace function public.fn_recusar_proposta(p_proposta_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prop public.propostas%rowtype;
begin
  select * into v_prop
    from public.propostas
    where id = p_proposta_id
    for update;
  if not found then
    raise exception 'proposta_inexistente' using errcode = 'PT404';
  end if;

  if (select auth.uid()) is distinct from v_prop.cliente_id then
    raise exception 'nao_autorizado' using errcode = 'PT401';
  end if;

  -- idempotente: ja recusada -> nao faz nada
  if v_prop.status = 'RECUSADA' then
    return;
  end if;

  if v_prop.status not in ('ENVIADA', 'VISUALIZADA') then
    raise exception 'proposta_indisponivel' using errcode = 'PT409';
  end if;

  update public.propostas set status = 'RECUSADA' where id = p_proposta_id;
end;
$$;

create or replace function public.fn_aceitar_proposta(p_proposta_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prop        public.propostas%rowtype;
  v_titulo      text;
  v_contratacao uuid;
begin
  select * into v_prop
    from public.propostas
    where id = p_proposta_id
    for update;
  if not found then
    raise exception 'proposta_inexistente' using errcode = 'PT404';
  end if;

  if (select auth.uid()) is distinct from v_prop.cliente_id then
    raise exception 'nao_autorizado' using errcode = 'PT401';
  end if;

  -- idempotente: ja aceita -> devolve a contratacao existente
  if v_prop.status = 'ACEITA' then
    return (select id from public.contratacoes where proposta_id = p_proposta_id);
  end if;

  if v_prop.status not in ('ENVIADA', 'VISUALIZADA') then
    raise exception 'proposta_indisponivel' using errcode = 'PT409';
  end if;

  update public.propostas set status = 'ACEITA' where id = p_proposta_id;

  if v_prop.demanda_id is not null then
    -- irmas da mesma demanda ainda em aberto -> RECUSADA
    update public.propostas
      set status = 'RECUSADA'
      where demanda_id = v_prop.demanda_id
        and id <> p_proposta_id
        and status in ('ENVIADA', 'VISUALIZADA');

    select titulo into v_titulo
      from public.demandas_servico
      where id = v_prop.demanda_id;
  end if;

  -- titulo_servico e NOT NULL; fallback para propostas DIRETAS (sem demanda)
  v_titulo := left(
    coalesce(nullif(v_titulo, ''), nullif(v_prop.descricao, ''), 'Serviço contratado'),
    120);

  begin
    insert into public.contratacoes
      (proposta_id, demanda_id, titulo_servico, cliente_id, prestador_id, valor_total)
    values
      (p_proposta_id, v_prop.demanda_id, v_titulo,
       v_prop.cliente_id, v_prop.prestador_id, v_prop.valor)
    returning id into v_contratacao;
  exception when unique_violation then
    -- corrida: outra transacao ja contratou esta proposta (UNIQUE em proposta_id)
    raise exception 'proposta_indisponivel' using errcode = 'PT409';
  end;

  if v_prop.demanda_id is not null then
    update public.demandas_servico set status = 'CONTRATADA' where id = v_prop.demanda_id;
  end if;

  insert into public.mensagens (conversa_id, remetente_id, tipo, corpo, proposta_id)
  values (v_prop.conversa_id, v_prop.prestador_id, 'CONTRATO_GERADO',
          'Contrato gerado', p_proposta_id);

  insert into public.notificacoes (usuario_id, titulo, mensagem, tipo, referencia_id)
  values (v_prop.prestador_id, 'Proposta aceita',
          'Sua proposta foi aceita. O contrato foi gerado.', 'CONTRATACAO', v_contratacao);

  return v_contratacao;
end;
$$;

revoke execute on function public.fn_recusar_proposta(uuid) from public, anon;
revoke execute on function public.fn_aceitar_proposta(uuid) from public, anon;
grant execute on function public.fn_recusar_proposta(uuid) to authenticated;
grant execute on function public.fn_aceitar_proposta(uuid) to authenticated;
