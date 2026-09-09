begin;
select plan(4);

select has_view('public', 'perfis_publicos', 'view perfis_publicos existe');
select has_column('public', 'perfis_publicos', 'titulo_profissional', 'expõe titulo_profissional');
select hasnt_column('public', 'perfis_publicos', 'telefone', 'NÃO expõe telefone');
select hasnt_column('public', 'perfis_publicos', 'chave_pix', 'NÃO expõe chave_pix');

select * from finish();
rollback;
