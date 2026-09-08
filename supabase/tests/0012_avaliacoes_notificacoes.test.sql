begin;
select plan(3);

select has_table('public', 'avaliacoes', 'tabela avaliacoes existe');
select has_table('public', 'notificacoes', 'tabela notificacoes existe');

select col_type_is('public', 'avaliacoes', 'nota', 'integer', 'nota é integer');

select * from finish();
rollback;
