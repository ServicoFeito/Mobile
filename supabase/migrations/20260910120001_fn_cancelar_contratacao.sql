-- Plano 5 — cancelamento de contratacao antes de qualquer pagamento.
-- contratacoes nao tem NENHUMA policy de UPDATE pra authenticated (so service_role) —
-- toda escrita e por RPC SECURITY DEFINER, mesmo padrao do Plano 4.

create or replace function public.fn_cancelar_contratacao(p_contratacao_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contr    public.contratacoes%rowtype;
  v_conversa uuid;
  v_outro    uuid;
begin
  select * into v_contr from public.contratacoes where id = p_contratacao_id for update;
  if not found then
    raise exception 'contratacao_inexistente' using errcode = 'PT404';
  end if;

  if (select auth.uid()) is distinct from v_contr.cliente_id
     and (select auth.uid()) is distinct from v_contr.prestador_id then
    raise exception 'nao_autorizado' using errcode = 'PT401';
  end if;

  if v_contr.status = 'CANCELADA' then
    return;
  end if;

  if v_contr.status <> 'AGUARDANDO_PAGAMENTO' then
    raise exception 'contratacao_indisponivel' using errcode = 'PT409';
  end if;

  update public.contratacoes set status = 'CANCELADA' where id = p_contratacao_id;

  if v_contr.demanda_id is not null then
    update public.demandas_servico
      set status = 'ABERTA'
      where id = v_contr.demanda_id and status = 'CONTRATADA';
  end if;

  select conversa_id into v_conversa from public.propostas where id = v_contr.proposta_id;

  insert into public.mensagens (conversa_id, remetente_id, tipo, corpo)
  values (v_conversa, (select auth.uid()), 'SISTEMA', 'Contratação cancelada.');

  v_outro := case
    when (select auth.uid()) = v_contr.cliente_id then v_contr.prestador_id
    else v_contr.cliente_id
  end;

  insert into public.notificacoes (usuario_id, titulo, mensagem, tipo, referencia_id)
  values (v_outro, 'Contratação cancelada', 'A contratação foi cancelada.', 'CONTRATACAO', p_contratacao_id);
end;
$$;

revoke execute on function public.fn_cancelar_contratacao(uuid) from public, anon;
grant execute on function public.fn_cancelar_contratacao(uuid) to authenticated;
