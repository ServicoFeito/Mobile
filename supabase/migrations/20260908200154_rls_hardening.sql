-- FINAL-REVIEW fix wave — Plano 1 (Fundação). Segurança: privacidade + dinheiro.
-- Cada fix tem asserção pgTAP em supabase/tests/0021_rls_hardening.test.sql.

------------------------------------------------------------------------------
-- F-C2 — fecha o buraco de auto-inclusão em participantes_conversa.
-- Participantes passam a vir SÓ do trigger F-I9 / service_role. Sem policy de INSERT.
------------------------------------------------------------------------------
drop policy if exists "participantes_insert_self_ou_participante" on public.participantes_conversa;

------------------------------------------------------------------------------
-- F-C3 — contratacoes 50/50 tem de somar valor_total EXATAMENTE.
-- valor_entrada continua round(valor_total*0.50,2); valor_final = o resto.
-- 2 ALTER TABLE separados (mais seguro em PG hospedado); coluna gerada pode
-- referenciar coluna simples, não outra coluna gerada -> round(...) inline.
------------------------------------------------------------------------------
alter table public.contratacoes drop column valor_final;
alter table public.contratacoes add column valor_final numeric(10,2)
  generated always as (valor_total - round(valor_total * 0.50, 2)) stored;

------------------------------------------------------------------------------
-- F-I4 — só o prestador altera a proposta (nunca o cliente).
------------------------------------------------------------------------------
drop policy if exists "propostas_update_participante" on public.propostas;
create policy "propostas_update_prestador" on public.propostas
  for update to authenticated
  using (prestador_id = (select auth.uid()) and public.fn_e_participante(conversa_id))
  with check (prestador_id = (select auth.uid()) and public.fn_e_participante(conversa_id));

------------------------------------------------------------------------------
-- F-I6 — avaliação exige contratação CONCLUIDA da qual você foi parte (RB10).
------------------------------------------------------------------------------
drop policy if exists "avaliacoes_insert_avaliador" on public.avaliacoes;
create policy "avaliacoes_insert_parte_contrato_concluido" on public.avaliacoes
  for insert to authenticated
  with check (
    avaliador_id = (select auth.uid())
    and exists (select 1 from public.contratacoes c
      where c.id = avaliacoes.contratacao_id
        and c.cliente_id = (select auth.uid())
        and c.prestador_id = avaliacoes.prestador_id
        and c.status = 'CONCLUIDA')
  );

------------------------------------------------------------------------------
-- F-I7 — perfis_publicos expõe SÓ prestadores (INNER join em vez de LEFT).
------------------------------------------------------------------------------
-- View de projeção pública. security_invoker = false é INTENCIONAL:
-- a view é a superfície pública e expõe apenas as colunas abaixo.
-- Não expõe telefone, status_conta, cnpj_mei nem chave_pix.
create or replace view public.perfis_publicos
with (security_invoker = false)
as
select
  u.id              as usuario_id,
  u.nome,
  u.cidade,
  u.bairro,
  u.avatar_cor_hex,
  u.foto_perfil_url,
  u.rating_cliente,
  p.titulo_profissional,
  p.bio,
  p.preco_base,
  p.rating,
  p.total_avaliacoes,
  p.total_servicos,
  p.verificado,
  p.disponivel,
  p.raio_km
from public.usuarios u
join public.perfil_prestador p on p.usuario_id = u.id;

revoke all on public.perfis_publicos from public;
grant select on public.perfis_publicos to anon, authenticated;

------------------------------------------------------------------------------
-- F-I9 — popula participantes_conversa automaticamente quando nasce a conversa.
------------------------------------------------------------------------------
create or replace function public.handle_new_conversa()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.participantes_conversa (conversa_id, usuario_id, papel)
  values (new.id, new.cliente_id, 'CLIENTE'), (new.id, new.prestador_id, 'PRESTADOR')
  on conflict (conversa_id, usuario_id) do nothing;
  return new;
end; $$;
create trigger on_conversa_created after insert on public.conversas
  for each row execute function public.handle_new_conversa();

------------------------------------------------------------------------------
-- F-I10 — destinatário marca mensagem como lida (`lida`); remetente edita `corpo`.
-- Mantém as DUAS policies (mensagens_update_remetente + a nova). O grant de coluna
-- (corpo, lida) + os using/with check por policy fazem a delimitação de linha.
------------------------------------------------------------------------------
create policy "mensagens_update_lida_participante" on public.mensagens
  for update to authenticated
  using (public.fn_e_participante(conversa_id))
  with check (public.fn_e_participante(conversa_id));

-- RLS é linha-a-linha, não coluna-a-coluna: a policy acima + o grant (corpo, lida)
-- deixariam QUALQUER participante reescrever `corpo`. Este trigger fecha isso —
-- quem não é o remetente só altera `lida`. Runner/service_role (auth.uid() null)
-- não é afetado.
create or replace function public.enforce_mensagem_update_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.remetente_id <> (select auth.uid())
     and (new.corpo       is distinct from old.corpo
       or new.tipo        is distinct from old.tipo
       or new.proposta_id is distinct from old.proposta_id
       or new.conversa_id is distinct from old.conversa_id
       or new.remetente_id is distinct from old.remetente_id
       or new.created_at  is distinct from old.created_at) then
    raise exception 'apenas o remetente altera o conteudo da mensagem (F-I10)'
      using errcode = '42501';
  end if;
  return new;
end; $$;
create trigger mensagens_update_scope before update on public.mensagens
  for each row execute function public.enforce_mensagem_update_scope();

------------------------------------------------------------------------------
-- F-minor — embrulha fn_tem_perfil_prestador() em (select …) nas policies de demandas
-- (init-plan caching). Comportamento idêntico.
------------------------------------------------------------------------------
drop policy if exists "demandas_select_dono_ou_prestador_abertas" on public.demandas_servico;
create policy "demandas_select_dono_ou_prestador_abertas" on public.demandas_servico
  for select to authenticated
  using (
    cliente_id = (select auth.uid())
    or (status = 'ABERTA' and (select public.fn_tem_perfil_prestador()))
  );

drop policy if exists "tarefas_select_quem_ve_demanda" on public.tarefas_demanda;
create policy "tarefas_select_quem_ve_demanda" on public.tarefas_demanda
  for select to authenticated
  using (exists (
    select 1 from public.demandas_servico d
    where d.id = demanda_id
      and (d.cliente_id = (select auth.uid())
           or (d.status = 'ABERTA' and (select public.fn_tem_perfil_prestador())))
  ));

------------------------------------------------------------------------------
-- F-I8 — grants explícitos de menor-privilégio. Revoga tudo de anon/authenticated
-- e re-concede por tabela, batendo com o conjunto de policies. service_role intacto.
-- `all tables` inclui a view perfis_publicos -> re-concedida no fim.
-- Ordem: revoke all PRIMEIRO, depois todos os grants (incl. re-emissão dos grants
-- por coluna de F-C1 / F-I5 / F-I10 / notificacoes).
------------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

-- SELECT p/ anon + authenticated (descoberta pública)
grant select on public.categoria_servico         to anon, authenticated;
grant select on public.portfolio_prestador       to anon, authenticated;
grant select on public.prestador_categoria       to anon, authenticated;
grant select on public.disponibilidade_prestador to anon, authenticated;
grant select on public.licencas_certificados     to anon, authenticated;
grant select on public.avaliacoes                to anon, authenticated;

-- F-C1 — perfil_prestador: SELECT por COLUNA (sem cnpj_mei / chave_pix).
revoke select on public.perfil_prestador from anon, authenticated;
grant select (usuario_id, titulo_profissional, bio, tem_mei, verificado,
              documento_verificado, selo_fundador, preco_base, tempo_experiencia,
              rating, total_avaliacoes, total_servicos, disponivel, raio_km,
              created_at, updated_at)
  on public.perfil_prestador to anon, authenticated;

-- SELECT só p/ authenticated
grant select on public.usuarios               to authenticated;
grant select on public.enderecos_usuario      to authenticated;
grant select on public.notificacoes           to authenticated;
grant select on public.demandas_servico       to authenticated;
grant select on public.tarefas_demanda        to authenticated;
grant select on public.conversas              to authenticated;
grant select on public.participantes_conversa to authenticated;
grant select on public.mensagens              to authenticated;
grant select on public.anexos_mensagem        to authenticated;
grant select on public.propostas              to authenticated;
grant select on public.contratacoes           to authenticated;
grant select on public.pagamentos             to authenticated;

-- INSERT p/ authenticated (tabelas com policy `for insert`)
grant insert on public.perfil_prestador          to authenticated;
grant insert on public.portfolio_prestador       to authenticated;
grant insert on public.prestador_categoria       to authenticated;
grant insert on public.disponibilidade_prestador to authenticated;
grant insert on public.licencas_certificados     to authenticated;
grant insert on public.avaliacoes                to authenticated;
grant insert on public.enderecos_usuario         to authenticated;
grant insert on public.demandas_servico          to authenticated;
grant insert on public.tarefas_demanda           to authenticated;
grant insert on public.conversas                 to authenticated;
grant insert on public.mensagens                 to authenticated;
grant insert on public.anexos_mensagem           to authenticated;
grant insert on public.propostas                 to authenticated;

-- UPDATE p/ authenticated — linha inteira
grant update on public.perfil_prestador          to authenticated;
grant update on public.disponibilidade_prestador to authenticated;
grant update on public.enderecos_usuario         to authenticated;
grant update on public.demandas_servico          to authenticated;
grant update on public.tarefas_demanda           to authenticated;
grant update on public.propostas                 to authenticated;

-- UPDATE p/ authenticated — por COLUNA
grant update (status, ultima_mensagem, data_ultima_mensagem,
              nao_lidas_cliente, nao_lidas_prestador)
  on public.conversas to authenticated;                            -- F-I5
grant update (corpo, lida) on public.mensagens to authenticated;   -- F-I10
grant update (lida)        on public.notificacoes to authenticated; -- migração 20260908150617
-- F-I8b — o `revoke all` acima matou o UPDATE de usuarios; a policy usuarios_update_propria
-- (20260908150617) exige id = auth.uid() para a linha. Devolve só as colunas de perfil
-- editáveis pelo dono. status_conta / rating_cliente / total_contratacoes_cliente / id /
-- timestamps ficam só p/ service_role.
grant update (nome, telefone, cidade, bairro, avatar_cor_hex, foto_perfil_url)
  on public.usuarios to authenticated;

-- DELETE p/ authenticated
grant delete on public.perfil_prestador      to authenticated;
grant delete on public.portfolio_prestador   to authenticated;
grant delete on public.prestador_categoria   to authenticated;
grant delete on public.licencas_certificados to authenticated;
grant delete on public.enderecos_usuario     to authenticated;
grant delete on public.demandas_servico      to authenticated;
grant delete on public.tarefas_demanda       to authenticated;

-- NADA de escrita p/ contratacoes / pagamentos (só service_role).
-- NADA de TRUNCATE / TRIGGER / REFERENCES p/ ninguém.

-- View pública (revogada pelo `all tables` acima).
grant select on public.perfis_publicos to anon, authenticated;
