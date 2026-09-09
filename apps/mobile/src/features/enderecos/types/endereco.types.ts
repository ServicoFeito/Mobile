export interface Endereco {
  id: string;
  identificacao: string | null;
  cep: string | null;
  estado: string | null;
  cidade: string | null;
  bairro: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  principal: boolean;
}

export interface NovoEndereco {
  usuarioId: string;
  identificacao: string | null;
  cep: string | null;
  estado: string | null;
  cidade: string | null;
  bairro: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  principal: boolean;
}

/** String legível montada das partes, para copiar no `endereco_completo` da demanda. */
export function formatarEndereco(e: Pick<Endereco, "logradouro" | "numero" | "complemento" | "bairro">): string {
  const rua = [e.logradouro, e.numero].filter(Boolean).join(", ");
  return [rua, e.complemento, e.bairro].filter(Boolean).join(" · ");
}
