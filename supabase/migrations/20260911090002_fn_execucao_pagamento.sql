-- Plano 6 -- transicoes AGENDADA->EM_ANDAMENTO e EM_ANDAMENTO->(pagamento FINAL
-- pendente). Nao estao na spec-mae (so existiam no Kotlin antigo como update
-- direto pelo prestador) -- RPC SECURITY DEFINER, mesmo padrao de
-- fn_cancelar_contratacao (Plano 5): contratacoes nao tem NENHUMA policy de
-- UPDATE pra authenticated.

create or replace function public.fn_iniciar_execucao(p_contratacao_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contr public.contratacoes%rowtype;
begin
  select * into v_contr
    from public.contratacoes
    where id = p_contratacao_id
    for update;
  if not found then
    raise exception 'contratacao_inexistente' using errcode = 'PT404';
  end if;

  if (select auth.uid()) is distinct from v_contr.prestador_id then
    raise exception 'nao_autorizado' using errcode = 'PT401';
  end if;

  if v_contr.status = 'EM_ANDAMENTO' then
    return;
  end if;

  if v_contr.status <> 'AGENDADA' then
    raise exception 'contratacao_indisponivel' using errcode = 'PT409';
  end if;

  update public.contratacoes set status = 'EM_ANDAMENTO' where id = p_contratacao_id;
end;
$$;

create or replace function public.fn_concluir_execucao(p_contratacao_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contr     public.contratacoes%rowtype;
  v_pagamento uuid;
begin
  select * into v_contr
    from public.contratacoes
    where id = p_contratacao_id
    for update;
  if not found then
    raise exception 'contratacao_inexistente' using errcode = 'PT404';
  end if;

  if (select auth.uid()) is distinct from v_contr.prestador_id then
    raise exception 'nao_autorizado' using errcode = 'PT401';
  end if;

  select id into v_pagamento
    from public.pagamentos
    where contratacao_id = p_contratacao_id and tipo = 'FINAL';
  if v_pagamento is not null then
    return v_pagamento;
  end if;

  if v_contr.status <> 'EM_ANDAMENTO' then
    raise exception 'contratacao_indisponivel' using errcode = 'PT409';
  end if;

  update public.contratacoes set data_conclusao = now() where id = p_contratacao_id;

  insert into public.pagamentos (contratacao_id, valor, tipo)
  values (p_contratacao_id, v_contr.valor_final, 'FINAL')
  returning id into v_pagamento;

  return v_pagamento;
end;
$$;

revoke execute on function public.fn_iniciar_execucao(uuid) from public, anon;
revoke execute on function public.fn_concluir_execucao(uuid) from public, anon;
grant execute on function public.fn_iniciar_execucao(uuid) to authenticated;
grant execute on function public.fn_concluir_execucao(uuid) to authenticated;
