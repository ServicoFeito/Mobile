-- Plano 4 — triggers de bookkeeping do chat.
-- handle_new_proposta: toda proposta nova vira uma mensagem PROPOSTA no chat.
-- handle_new_mensagem: toda mensagem nova atualiza o resumo e os contadores de nao-lidas da conversa.

create or replace function public.handle_new_proposta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.mensagens (conversa_id, remetente_id, tipo, corpo, proposta_id)
  values (
    new.conversa_id,
    new.prestador_id,
    'PROPOSTA',
    left(coalesce(nullif(new.descricao, ''), 'Proposta enviada'), 200),
    new.id
  );
  return new;
end;
$$;

create trigger on_proposta_created
  after insert on public.propostas
  for each row execute function public.handle_new_proposta();

create or replace function public.handle_new_mensagem()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resumo text;
begin
  v_resumo := case new.tipo
    when 'TEXTO'                then left(new.corpo, 120)
    when 'FOTO'                 then '📷 Foto'
    when 'VIDEO'                then '🎥 Vídeo'
    when 'AUDIO'                then '🎙️ Áudio'
    when 'LOCALIZACAO'          then '📍 Localização'
    when 'PROPOSTA'             then '💼 Proposta'
    when 'CONTRATO_GERADO'      then '📄 Contrato gerado'
    when 'PAGAMENTO_CONFIRMADO' then '💰 Pagamento confirmado'
    else left(coalesce(nullif(new.corpo, ''), ''), 120)
  end;

  update public.conversas c set
    ultima_mensagem      = v_resumo,
    data_ultima_mensagem = new.created_at,
    nao_lidas_cliente    = c.nao_lidas_cliente
                           + case when new.remetente_id = c.prestador_id then 1 else 0 end,
    nao_lidas_prestador  = c.nao_lidas_prestador
                           + case when new.remetente_id = c.cliente_id then 1 else 0 end,
    updated_at           = pg_catalog.now()
  where c.id = new.conversa_id;

  return new;
end;
$$;

create trigger on_mensagem_created
  after insert on public.mensagens
  for each row execute function public.handle_new_mensagem();
