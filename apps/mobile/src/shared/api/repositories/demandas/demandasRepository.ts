import type { PageParams, Pagina } from "@/shared/api/repositories/types";
import type {
  DemandaResumo,
  DemandaDetalhe,
  NovaDemanda,
  FiltrosDemanda,
} from "@/features/demandas/types/demanda.types";

export interface DemandasRepository {
  /** Demandas com status ABERTA. Keyset em created_at desc. `limite` = tamanho da página. */
  listarAbertas(filtros: FiltrosDemanda, page: PageParams): Promise<Pagina<DemandaResumo>>;
  obter(id: string): Promise<DemandaDetalhe>;
  criar(dados: NovaDemanda): Promise<{ id: string }>;
}
