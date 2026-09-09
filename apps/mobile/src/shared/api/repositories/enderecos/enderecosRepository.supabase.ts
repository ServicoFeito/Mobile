import { supabase } from "@/shared/api/supabaseClient";
import type { Database } from "@servico-feito/db-types";
import type { Endereco, NovoEndereco } from "@/features/enderecos/types/endereco.types";
import type { EnderecosRepository } from "./enderecosRepository";
import { normalizarErro } from "../types";

type LinhaEndereco = Database["public"]["Tables"]["enderecos_usuario"]["Row"];

const COLUNAS =
  "id, identificacao, cep, estado, cidade, bairro, logradouro, numero, complemento, principal";

function paraEndereco(l: Pick<LinhaEndereco, keyof Endereco>): Endereco {
  return {
    id: l.id,
    identificacao: l.identificacao,
    cep: l.cep,
    estado: l.estado,
    cidade: l.cidade,
    bairro: l.bairro,
    logradouro: l.logradouro,
    numero: l.numero,
    complemento: l.complemento,
    principal: l.principal,
  };
}

export const enderecosRepositorySupabase: EnderecosRepository = {
  async listarMeus() {
    try {
      const { data, error } = await supabase
        .from("enderecos_usuario")
        .select(COLUNAS)
        .order("created_at", { ascending: false });
      if (error) throw normalizarErro(error);
      return (data ?? []).map(paraEndereco);
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async criar(dados) {
    try {
      const row: Database["public"]["Tables"]["enderecos_usuario"]["Insert"] = {
        usuario_id: dados.usuarioId,
        identificacao: dados.identificacao,
        cep: dados.cep,
        estado: dados.estado,
        cidade: dados.cidade,
        bairro: dados.bairro,
        logradouro: dados.logradouro,
        numero: dados.numero,
        complemento: dados.complemento,
        principal: dados.principal,
      };
      const { data, error } = await supabase
        .from("enderecos_usuario")
        .insert(row)
        .select(COLUNAS)
        .single();
      if (error) throw normalizarErro(error);
      return paraEndereco(data as Pick<LinhaEndereco, keyof Endereco>);
    } catch (e) {
      throw normalizarErro(e);
    }
  },
};
