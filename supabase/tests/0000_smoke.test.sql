begin;
select plan(1);

select ok(true, 'harness pgTAP está funcionando');

select * from finish();
rollback;
