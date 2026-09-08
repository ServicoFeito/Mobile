-- usuarios: cada um enxerga e edita só a própria linha
create policy "usuarios_select_propria" on public.usuarios
  for select to authenticated using (id = (select auth.uid()));
create policy "usuarios_update_propria" on public.usuarios
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- enderecos_usuario: tudo restrito ao dono
create policy "enderecos_select_dono" on public.enderecos_usuario
  for select to authenticated using (usuario_id = (select auth.uid()));
create policy "enderecos_insert_dono" on public.enderecos_usuario
  for insert to authenticated with check (usuario_id = (select auth.uid()));
create policy "enderecos_update_dono" on public.enderecos_usuario
  for update to authenticated using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
create policy "enderecos_delete_dono" on public.enderecos_usuario
  for delete to authenticated using (usuario_id = (select auth.uid()));

-- notificacoes: ler as próprias; marcar como lida (só a coluna lida)
revoke update on public.notificacoes from authenticated;
grant update (lida) on public.notificacoes to authenticated;
create policy "notificacoes_select_dono" on public.notificacoes
  for select to authenticated using (usuario_id = (select auth.uid()));
create policy "notificacoes_update_dono" on public.notificacoes
  for update to authenticated using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
