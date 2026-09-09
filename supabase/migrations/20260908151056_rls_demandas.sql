-- demandas_servico
create policy "demandas_select_dono_ou_prestador_abertas" on public.demandas_servico
  for select to authenticated
  using (
    cliente_id = (select auth.uid())
    or (status = 'ABERTA' and public.fn_tem_perfil_prestador())
  );
create policy "demandas_insert_cliente" on public.demandas_servico
  for insert to authenticated with check (cliente_id = (select auth.uid()));
create policy "demandas_update_cliente" on public.demandas_servico
  for update to authenticated using (cliente_id = (select auth.uid()))
  with check (cliente_id = (select auth.uid()));
create policy "demandas_delete_cliente" on public.demandas_servico
  for delete to authenticated using (cliente_id = (select auth.uid()));

-- tarefas_demanda
create policy "tarefas_select_quem_ve_demanda" on public.tarefas_demanda
  for select to authenticated
  using (exists (
    select 1 from public.demandas_servico d
    where d.id = demanda_id
      and (d.cliente_id = (select auth.uid())
           or (d.status = 'ABERTA' and public.fn_tem_perfil_prestador()))
  ));
create policy "tarefas_write_cliente_dono" on public.tarefas_demanda
  for all to authenticated
  using (exists (
    select 1 from public.demandas_servico d
    where d.id = demanda_id and d.cliente_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.demandas_servico d
    where d.id = demanda_id and d.cliente_id = (select auth.uid())
  ));
