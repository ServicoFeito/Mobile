-- categoria_servico: catálogo, leitura livre; sem escrita para app (service_role gerencia)
create policy "categoria_select_todos" on public.categoria_servico
  for select to anon, authenticated using (true);

-- perfil_prestador: leitura livre (descoberta); escrita só do dono
create policy "perfil_prestador_select_todos" on public.perfil_prestador
  for select to anon, authenticated using (true);
create policy "perfil_prestador_insert_dono" on public.perfil_prestador
  for insert to authenticated with check (usuario_id = (select auth.uid()));
create policy "perfil_prestador_update_dono" on public.perfil_prestador
  for update to authenticated using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
create policy "perfil_prestador_delete_dono" on public.perfil_prestador
  for delete to authenticated using (usuario_id = (select auth.uid()));

-- portfolio_prestador
create policy "portfolio_select_todos" on public.portfolio_prestador
  for select to anon, authenticated using (true);
create policy "portfolio_insert_dono" on public.portfolio_prestador
  for insert to authenticated with check (prestador_id = (select auth.uid()));
create policy "portfolio_delete_dono" on public.portfolio_prestador
  for delete to authenticated using (prestador_id = (select auth.uid()));

-- prestador_categoria
create policy "prestador_categoria_select_todos" on public.prestador_categoria
  for select to anon, authenticated using (true);
create policy "prestador_categoria_insert_dono" on public.prestador_categoria
  for insert to authenticated with check (prestador_id = (select auth.uid()));
create policy "prestador_categoria_delete_dono" on public.prestador_categoria
  for delete to authenticated using (prestador_id = (select auth.uid()));

-- disponibilidade_prestador
create policy "disponibilidade_select_todos" on public.disponibilidade_prestador
  for select to anon, authenticated using (true);
create policy "disponibilidade_insert_dono" on public.disponibilidade_prestador
  for insert to authenticated with check (usuario_id = (select auth.uid()));
create policy "disponibilidade_update_dono" on public.disponibilidade_prestador
  for update to authenticated using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- licencas_certificados
create policy "licencas_select_todos" on public.licencas_certificados
  for select to anon, authenticated using (true);
create policy "licencas_insert_dono" on public.licencas_certificados
  for insert to authenticated with check (usuario_id = (select auth.uid()));
create policy "licencas_delete_dono" on public.licencas_certificados
  for delete to authenticated using (usuario_id = (select auth.uid()));

-- avaliacoes: leitura livre; insert só como próprio avaliador; sem update/delete
create policy "avaliacoes_select_todos" on public.avaliacoes
  for select to anon, authenticated using (true);
create policy "avaliacoes_insert_avaliador" on public.avaliacoes
  for insert to authenticated with check (avaliador_id = (select auth.uid()));
