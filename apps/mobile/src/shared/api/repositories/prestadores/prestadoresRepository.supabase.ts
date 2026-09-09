import { supabase } from "@/shared/api/supabaseClient";
import type { Database } from "@servico-feito/db-types";
import type { Categoria } from "@/features/descoberta/types/descoberta.types";
import type {
  PrestadorResumo,
  PrestadorPerfil,
  ItemPortfolio,
  DisponibilidadeSemana,
  FiltrosPrestador,
} from "@/features/prestadores/types/prestador.types";
import type { PageParams, Pagina } from "../types";
import type { PrestadoresRepository } from "./prestadoresRepository";
import { normalizarErro } from "../types";

type LinhaPP = Database["public"]["Views"]["perfis_publicos"]["Row"];
type LinhaCat = Database["public"]["Tables"]["categoria_servico"]["Row"];
type LinhaDisp = Database["public"]["Tables"]["disponibilidade_prestador"]["Row"];

const SELECT_RESUMO =
  "usuario_id, nome, cidade, bairro, avatar_cor_hex, foto_perfil_url, titulo_profissional, preco_base, rating, total_avaliacoes, verificado, disponivel";

function paraResumo(l: LinhaPP): PrestadorResumo {
  return {
    usuarioId: l.usuario_id ?? "",
    nome: l.nome,
    cidade: l.cidade,
    bairro: l.bairro,
    tituloProfissional: l.titulo_profissional,
    precoBase: l.preco_base,
    rating: l.rating,
    totalAvaliacoes: l.total_avaliacoes,
    verificado: l.verificado ?? false,
    disponivel: l.disponivel ?? false,
    fotoPerfilUrl: l.foto_perfil_url,
    avatarCorHex: l.avatar_cor_hex,
  };
}

function paraCategoria(l: LinhaCat): Categoria {
  return {
    id: l.id,
    nome: l.nome,
    descricao: l.descricao,
    iconeKey: l.icone_key,
    popular: l.popular,
    precoMedioHora: l.preco_medio_hora,
  };
}

/** Offset codificado como string. Vazio/NaN → 0. */
function offsetDe(cursor: string | undefined): number {
  const n = Number.parseInt(cursor ?? "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function paginarPP(
  aplicarFiltros: (q: ReturnType<typeof baseQuery>) => ReturnType<typeof baseQuery>,
  page: PageParams,
): Promise<Pagina<PrestadorResumo>> {
  const offset = offsetDe(page.cursor);
  const q = aplicarFiltros(baseQuery()).range(offset, offset + page.limite);
  const { data, error } = await q;
  if (error) throw normalizarErro(error);
  const linhas = (data ?? []) as LinhaPP[];
  const temMais = linhas.length > page.limite;
  const itens = linhas.slice(0, page.limite).map(paraResumo);
  return { itens, proximoCursor: temMais ? String(offset + page.limite) : null };
}

function baseQuery() {
  return supabase
    .from("perfis_publicos")
    .select(SELECT_RESUMO)
    .order("rating", { ascending: false });
}

export const prestadoresRepositorySupabase: PrestadoresRepository = {
  async listarPorCategoria(categoriaId: string, filtros: FiltrosPrestador, page: PageParams) {
    try {
      const { data: ids, error: e1 } = await supabase
        .from("prestador_categoria")
        .select("prestador_id")
        .eq("categoria_id", categoriaId);
      if (e1) throw normalizarErro(e1);
      const listaIds = (ids ?? []).map((r) => (r as { prestador_id: string }).prestador_id);
      if (listaIds.length === 0) return { itens: [], proximoCursor: null };
      return await paginarPP(
        (q) => {
          let qq = q.in("usuario_id", listaIds);
          if (filtros.cidade) qq = qq.eq("cidade", filtros.cidade);
          return qq;
        },
        page,
      );
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async buscar(termo: string, filtros: FiltrosPrestador, page: PageParams) {
    try {
      return await paginarPP(
        (q) => {
          let qq = q.ilike("nome", `%${termo}%`);
          if (filtros.cidade) qq = qq.eq("cidade", filtros.cidade);
          return qq;
        },
        page,
      );
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async obterPerfil(usuarioId: string): Promise<PrestadorPerfil> {
    try {
      const [perfilRes, catRes, portRes, dispRes] = await Promise.all([
        supabase
          .from("perfis_publicos")
          .select(
            SELECT_RESUMO + ", bio, raio_km, total_servicos",
          )
          .eq("usuario_id", usuarioId)
          .single(),
        supabase
          .from("prestador_categoria")
          .select(
            "categoria_servico(id, nome, descricao, icone_key, popular, preco_medio_hora)",
          )
          .eq("prestador_id", usuarioId),
        supabase
          .from("portfolio_prestador")
          .select("id, url_media")
          .eq("prestador_id", usuarioId)
          .order("created_at", { ascending: false }),
        supabase
          .from("disponibilidade_prestador")
          .select("dom, seg, ter, qua, qui, sex, sab")
          .eq("usuario_id", usuarioId)
          .single(),
      ]);

      if (perfilRes.error) throw normalizarErro(perfilRes.error);
      const l = perfilRes.data as unknown as LinhaPP & {
        bio: string | null;
        raio_km: number | null;
        total_servicos: number | null;
      };

      const categorias: Categoria[] = (catRes.data ?? [])
        .map((r) => (r as { categoria_servico: LinhaCat | null }).categoria_servico)
        .filter((c): c is LinhaCat => c !== null)
        .map(paraCategoria);

      const portfolio: ItemPortfolio[] = (portRes.data ?? []).map((r) => {
        const p = r as { id: string; url_media: string };
        return { id: p.id, urlMedia: p.url_media };
      });

      let disponibilidade: DisponibilidadeSemana | null = null;
      if (!dispRes.error && dispRes.data) {
        const d = dispRes.data as Pick<LinhaDisp, keyof DisponibilidadeSemana>;
        disponibilidade = {
          dom: d.dom, seg: d.seg, ter: d.ter, qua: d.qua, qui: d.qui, sex: d.sex, sab: d.sab,
        };
      }

      return {
        ...paraResumo(l),
        bio: l.bio,
        raioKm: l.raio_km,
        totalServicos: l.total_servicos,
        categorias,
        portfolio,
        disponibilidade,
      };
    } catch (e) {
      throw normalizarErro(e);
    }
  },
};
