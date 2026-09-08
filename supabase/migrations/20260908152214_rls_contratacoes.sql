-- contratacoes: leitura pelas partes; escrita exclusivamente via service_role
create policy "contratacoes_select_partes" on public.contratacoes
  for select to authenticated
  using (cliente_id = (select auth.uid()) or prestador_id = (select auth.uid()));

-- pagamentos: leitura pelas partes da contratação; escrita exclusivamente via service_role
create policy "pagamentos_select_partes" on public.pagamentos
  for select to authenticated
  using (exists (
    select 1 from public.contratacoes c
    where c.id = contratacao_id
      and (c.cliente_id = (select auth.uid()) or c.prestador_id = (select auth.uid()))
  ));
