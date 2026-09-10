begin;
select plan(2);

select is(
  (select count(*)::int from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mensagens'),
  1, 'mensagens esta na publicacao supabase_realtime');

select is(
  (select count(*)::int from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversas'),
  1, 'conversas esta na publicacao supabase_realtime');

select * from finish();
rollback;
