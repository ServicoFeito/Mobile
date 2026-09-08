begin;
select plan(2);

select has_table('public', 'enderecos_usuario', 'tabela enderecos_usuario existe');
select col_default_is('public', 'enderecos_usuario', 'principal', 'false', 'principal default false');

select * from finish();
rollback;
