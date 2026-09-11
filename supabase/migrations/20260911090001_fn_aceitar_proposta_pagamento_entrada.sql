create or replace function public.fn_aceitar_proposta(p_proposta_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prop         public.propostas%rowtype;
  v_titulo       text;
  v_contratacao  uuid;
  v_dem_status   public.status_demanda;
begin
  select * into v_prop from public.propostas where id = p_proposta_id for update;
  if not found then
    raise exception 'proposta_inexistente' using errcode = 'PT404';
  end if;

  if (select auth.uid()) is distinct from v_prop.cliente_id then
    raise exception 'nao_autorizado' using errcode = 'PT401';
  end if;

  if v_prop.status = 'ACEITA' then
    select id into v_contratacao from public.contratacoes where proposta_id = p_proposta_id;
    if v_contratacao is null then
      raise exception 'contratacao_ausente' using errcode = 'PT409';
    end if;
    return v_contratacao;
  end if;

  if v_prop.status not in ('ENVIADA', 'VISUALIZADA') then
    raise exception 'proposta_indisponivel' using errcode = 'PT409';
  end if;

  if v_prop.demanda_id is not null then
    select status into v_dem_status from public.demandas_servico where id = v_prop.demanda_id for update;
    if v_dem_status in ('CONTRATADA', 'FINALIZADA', 'CANCELADA') then
      raise exception 'demanda_indisponivel' using errcode = 'PT409';
    end if;
  end if;

  update public.propostas set status = 'ACEITA' where id = p_proposta_id;

  if v_prop.demanda_id is not null then
    update public.propostas
      set status = 'RECUSADA'
      where demanda_id = v_prop.demanda_id and id <> p_proposta_id and status in ('ENVIADA', 'VISUALIZADA');
    select titulo into v_titulo from public.demandas_servico where id = v_prop.demanda_id;
  end if;

  v_titulo := left(coalesce(nullif(v_titulo, ''), nullif(v_prop.descricao, ''), 'Serviço contratado'), 120);

  begin
    insert into public.contratacoes
      (proposta_id, demanda_id, titulo_servico, cliente_id, prestador_id, valor_total)
    values
      (p_proposta_id, v_prop.demanda_id, v_titulo, v_prop.cliente_id, v_prop.prestador_id, v_prop.valor)
    returning id into v_contratacao;
  exception when unique_violation then
    raise exception 'proposta_indisponivel' using errcode = 'PT409';
  end;

  if v_prop.demanda_id is not null then
    update public.demandas_servico set status = 'CONTRATADA' where id = v_prop.demanda_id;
  end if;

  -- Plano 6: cria o pagamento ENTRADA que fecha o ciclo de pagamento. O valor
  -- replica a formula da coluna gerada contratacoes.valor_entrada
  -- (round(valor_total * 0.50, 2)); valor_total = v_prop.valor por construcao.
  insert into public.pagamentos (contratacao_id, valor, tipo)
  values (v_contratacao, round(v_prop.valor * 0.50, 2), 'ENTRADA');

  insert into public.mensagens (conversa_id, remetente_id, tipo, corpo, proposta_id)
  values (v_prop.conversa_id, v_prop.prestador_id, 'CONTRATO_GERADO', 'Contrato gerado', p_proposta_id);

  insert into public.notificacoes (usuario_id, titulo, mensagem, tipo, referencia_id)
  values (v_prop.prestador_id, 'Proposta aceita', 'Sua proposta foi aceita. O contrato foi gerado.', 'CONTRATACAO', v_contratacao);

  return v_contratacao;
end;
$$;
