import type { Categoria } from "@/features/descoberta/types/descoberta.types";

export interface CategoriasRepository {
  /** Todas as categorias, ordenadas por nome. Lista completa — o seed é pequeno. */
  listar(): Promise<Categoria[]>;
}
