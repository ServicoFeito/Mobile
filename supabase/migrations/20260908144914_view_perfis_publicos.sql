-- View de projeção pública. security_invoker = false é INTENCIONAL:
-- a view é a superfície pública e expõe apenas as colunas abaixo.
-- Não expõe telefone, status_conta, cnpj_mei nem chave_pix.
create view public.perfis_publicos
with (security_invoker = false)
as
select
  u.id              as usuario_id,
  u.nome,
  u.cidade,
  u.bairro,
  u.avatar_cor_hex,
  u.foto_perfil_url,
  u.rating_cliente,
  p.titulo_profissional,
  p.bio,
  p.preco_base,
  p.rating,
  p.total_avaliacoes,
  p.total_servicos,
  p.verificado,
  p.disponivel,
  p.raio_km
from public.usuarios u
left join public.perfil_prestador p on p.usuario_id = u.id;

revoke all on public.perfis_publicos from public;
grant select on public.perfis_publicos to anon, authenticated;
