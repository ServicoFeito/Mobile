-- Plano 4 — habilita realtime para o chat. So consumimos INSERT (mensagens)
-- e INSERT/UPDATE (conversas); replica identity default basta.
-- A publicacao supabase_realtime e criada pelo Supabase; adicionar tabela e idempotente
-- via checagem, mas ALTER PUBLICATION ADD TABLE falha se ja existir -> guardar.

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mensagens'
  ) then
    execute 'alter publication supabase_realtime add table public.mensagens';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversas'
  ) then
    execute 'alter publication supabase_realtime add table public.conversas';
  end if;
end
$$;
