begin;
select plan(2);

select has_function('public', 'set_updated_at', 'função set_updated_at existe');

-- tabela efêmera só para exercitar o trigger
create table public._tmp_updated_at (
  id int primary key,
  updated_at timestamptz not null default now()
);
create trigger _tmp_set_updated_at before update on public._tmp_updated_at
  for each row execute function public.set_updated_at();

insert into public._tmp_updated_at (id) values (1);
update public._tmp_updated_at set id = 1 where id = 1;

select ok(
  (select updated_at from public._tmp_updated_at where id = 1) >= now() - interval '5 seconds',
  'update mexe em updated_at via trigger'
);

drop table public._tmp_updated_at;

select * from finish();
rollback;
