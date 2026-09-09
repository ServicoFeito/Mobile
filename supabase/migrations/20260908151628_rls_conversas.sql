-- conversas
create policy "conversas_select_participante" on public.conversas
  for select to authenticated using (public.fn_e_participante(id));
create policy "conversas_insert_parte" on public.conversas
  for insert to authenticated
  with check (cliente_id = (select auth.uid()) or prestador_id = (select auth.uid()));
create policy "conversas_update_participante" on public.conversas
  for update to authenticated using (public.fn_e_participante(id))
  with check (public.fn_e_participante(id));

-- participantes_conversa
create policy "participantes_select_participante" on public.participantes_conversa
  for select to authenticated using (public.fn_e_participante(conversa_id));
create policy "participantes_insert_self_ou_participante" on public.participantes_conversa
  for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    or public.fn_e_participante(conversa_id)
  );

-- mensagens
create policy "mensagens_select_participante" on public.mensagens
  for select to authenticated using (public.fn_e_participante(conversa_id));
create policy "mensagens_insert_remetente_participante" on public.mensagens
  for insert to authenticated
  with check (remetente_id = (select auth.uid()) and public.fn_e_participante(conversa_id));
create policy "mensagens_update_remetente" on public.mensagens
  for update to authenticated using (remetente_id = (select auth.uid()))
  with check (remetente_id = (select auth.uid()));

-- anexos_mensagem
create policy "anexos_select_participante" on public.anexos_mensagem
  for select to authenticated
  using (exists (
    select 1 from public.mensagens m
    where m.id = mensagem_id and public.fn_e_participante(m.conversa_id)
  ));
create policy "anexos_insert_remetente" on public.anexos_mensagem
  for insert to authenticated
  with check (exists (
    select 1 from public.mensagens m
    where m.id = mensagem_id and m.remetente_id = (select auth.uid())
  ));

-- propostas
create policy "propostas_select_participante" on public.propostas
  for select to authenticated using (public.fn_e_participante(conversa_id));
create policy "propostas_insert_prestador_participante" on public.propostas
  for insert to authenticated
  with check (prestador_id = (select auth.uid()) and public.fn_e_participante(conversa_id));
create policy "propostas_update_participante" on public.propostas
  for update to authenticated using (public.fn_e_participante(conversa_id))
  with check (public.fn_e_participante(conversa_id));
