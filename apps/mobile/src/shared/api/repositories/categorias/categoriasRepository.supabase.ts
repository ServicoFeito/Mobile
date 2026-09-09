import { supabase } from "@/shared/api/supabaseClient";
import type { Database } from "@servico-feito/db-types";
import type { Categoria } from "@/features/descoberta/types/descoberta.types";
import type { CategoriasRepository } from "./categoriasRepository";
import { normalizarErro } from "../types";

type LinhaCategoria = Omit<
  Database["public"]["Tables"]["categoria_servico"]["Row"],
  "created_at"
>;

function paraCategoria(l: LinhaCategoria): Categoria {
  return {
    id: l.id,
    nome: l.nome,
    descricao: l.descricao,
    iconeKey: l.icone_key,
    popular: l.popular,
    precoMedioHora: l.preco_medio_hora,
  };
}

export const categoriasRepositorySupabase: CategoriasRepository = {
  async listar() {
    try {
      const { data, error } = await supabase
        .from("categoria_servico")
        .select("id, nome, descricao, icone_key, popular, preco_medio_hora")
        .order("nome", { ascending: true });
      if (error) throw normalizarErro(error);
      return (data ?? []).map(paraCategoria);
    } catch (e) {
      throw normalizarErro(e);
    }
  },
};
