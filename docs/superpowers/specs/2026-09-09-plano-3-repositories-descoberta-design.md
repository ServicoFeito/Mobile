# Plano 3 — Repositories e descoberta — Design

**Data:** 2026-09-09
**Base:** `homolog` @ `fb20f82` (Planos 1 e 2 mergeados)
**Spec-mãe:** `docs/superpowers/specs/2026-09-08-migracao-react-native-supabase-design.md` (seção 8)
**Regras de negócio:** `docs/regras-de-negocio/regras-de-negocio.md` (RB01, RB02, RB11, RB17)

## 1. Objetivo e escopo

Entregar a **camada de repositories** genérica sobre `supabase-js` (o seam para a
futura API C#) e a **feature de descoberta** do MVP: o cliente encontra categorias e
prestadores e cria demandas; o prestador vê o feed de demandas abertas.

**Dentro do escopo:**

- Infra de repositories: `types.ts` (`RepoError`, `PageParams`, `Pagina<T>`,
  `normalizarErro`), barrel `index.ts`.
- Repositories: `categorias`, `prestadores`, `demandas`, `enderecos`.
- Feature `descoberta` (lado contratar): grade de categorias (filtrada em memória
  pelo campo de busca), lista de prestadores por categoria, busca textual de
  prestadores com filtro de cidade.
- Feature `prestadores`: tela de perfil público completo (view `perfis_publicos` +
  categorias + portfólio + disponibilidade).
- Feature `demandas`: criar demanda (cliente), feed de demandas abertas (prestador),
  detalhe da demanda (read-only).
- Feature `enderecos`: listar endereços do usuário e criar novo, consumidos pelo
  seletor de endereço da criação de demanda.
- Utils compartilhados: `useDebounce`, `traduzErroRepo`.

**Fora do escopo (planos posteriores):**

- Conversa, proposta, contratação, pagamento, avaliação, notificação.
- Iniciar conversa a partir da demanda ou do perfil do prestador (Plano 4).
- Realtime (é do chat, Plano 4).
- Ranqueamento/score de busca (RB103 — explicitamente adiado). Ordenação fixa:
  prestadores por `rating` desc, demandas por `created_at` desc.
- Edição/exclusão de demanda; gestão dedicada de endereços ("meus endereços").
- Dashboard rico na `InicioScreen` (só ganha botões de ação rápida).

**Sem migração de banco.** O RLS do Plano 1 já cobre tudo:

| Necessidade | Policy / grant existente (Plano 1) |
|---|---|
| ler categorias | `categoria_select_todos` + `grant select ... to anon, authenticated` |
| ler perfil público do prestador | view `perfis_publicos` + `grant select to anon, authenticated` |
| ler `perfil_prestador` | `perfil_prestador_select_todos` |
| ler `prestador_categoria` | `prestador_categoria_select_todos` |
| ler `portfolio_prestador` | `portfolio_select_todos` + grant |
| ler `disponibilidade_prestador` | `disponibilidade_select_todos` + grant |
| prestador lê demandas ABERTA | `demandas_select_dono_ou_prestador_abertas` (`for select to authenticated`) |
| cliente cria demanda | `demandas_insert_cliente` (`with check cliente_id = auth.uid()`) + `grant insert to authenticated` |
| cliente lê/cria endereço próprio | `enderecos_select_dono` / `enderecos_insert_dono` + grants |

## 2. Camada de repositories

Diretório: `apps/mobile/src/shared/api/repositories/`

```
types.ts
  type CodigoRepo =
    | 'nao_autenticado' | 'nao_autorizado' | 'nao_encontrado'
    | 'conflito' | 'validacao' | 'rede' | 'desconhecido';
  interface RepoError { code: CodigoRepo; message: string; cause?: unknown }
  interface PageParams { limite: number; cursor?: string }   // cursor = created_at ISO do último item
  interface Pagina<T> { itens: T[]; proximoCursor: string | null }
  function normalizarErro(e: unknown): RepoError;

categorias/
  categoriasRepository.ts          // interface CategoriasRepository
  categoriasRepository.supabase.ts

prestadores/
  prestadoresRepository.ts
  prestadoresRepository.supabase.ts

demandas/
  demandasRepository.ts
  demandasRepository.supabase.ts

enderecos/
  enderecosRepository.ts
  enderecosRepository.supabase.ts

index.ts
  export const repositories = { categorias, prestadores, demandas, enderecos };
```

### 2.1 `normalizarErro`

Converte o que o `supabase-js` lança/retorna em `RepoError` **antes de sair do
repository**. Mapeamento:

| Origem | `code` |
|---|---|
| `PostgrestError.code === 'PGRST116'` (0 linhas em `.single()`) | `nao_encontrado` |
| `PostgrestError.code` começa com `23505` (unique) | `conflito` |
| `PostgrestError.code` começa com `23` (outras constraints) | `validacao` |
| `PostgrestError.code === '42501'` (RLS/privilege) | `nao_autorizado` |
| `AuthError` / `status === 401` | `nao_autenticado` |
| `TypeError` de `fetch` / `message` contém `Network request failed` | `rede` |
| qualquer outro | `desconhecido` |

`message` = string curta e neutra por `code` (não repassa a mensagem crua do
Postgres). `cause` = o erro original, para log.

### 2.2 Interfaces

```ts
// categorias/categoriasRepository.ts
interface CategoriasRepository {
  listar(): Promise<Categoria[]>;                 // order by nome; lista completa (seed pequeno)
}
// Sem `buscar` server-side: a grade de categorias é filtrada em memória na tela
// (a lista inteira já está carregada e cacheada por 5 min).

// prestadores/prestadoresRepository.ts
interface FiltrosPrestador { cidade?: string }
interface PrestadoresRepository {
  listarPorCategoria(
    categoriaId: string, filtros: FiltrosPrestador, page: PageParams,
  ): Promise<Pagina<PrestadorResumo>>;            // join prestador_categoria; order rating desc, created_at desc
  buscar(
    termo: string, filtros: FiltrosPrestador, page: PageParams,
  ): Promise<Pagina<PrestadorResumo>>;            // ilike nome / titulo_profissional
  obterPerfil(usuarioId: string): Promise<PrestadorPerfil>;
}

// demandas/demandasRepository.ts
interface FiltrosDemanda { categoriaId?: string; cidade?: string; termo?: string }
interface DemandasRepository {
  listarAbertas(filtros: FiltrosDemanda, page: PageParams): Promise<Pagina<DemandaResumo>>;
  obter(id: string): Promise<DemandaDetalhe>;
  criar(dados: NovaDemanda): Promise<{ id: string }>;
}

// enderecos/enderecosRepository.ts
interface EnderecosRepository {
  listarMeus(): Promise<Endereco[]>;              // order by created_at desc
  criar(dados: NovoEndereco): Promise<Endereco>;
}
```

### 2.3 Implementação (`.supabase.ts`)

- Importa `supabase` de `@/shared/api/supabaseClient`, os tipos de linha de
  `@servico-feito/db-types` (`Database['public']['Tables'|'Views'][...]['Row']`) e
  os tipos de domínio de `features/<feat>/types/*.types.ts`.
- Cada método: `try` a chamada → mapeia linha(s) → domínio → retorna;
  `catch (e) { throw normalizarErro(e) }`. Se o retorno do `supabase-js` traz
  `{ data, error }` com `error` não-nulo, `throw normalizarErro(error)`.
- **Keyset / infinite scroll:**
  `.order('created_at', { ascending: false })`, e quando `cursor` presente
  `.lt('created_at', cursor)`, `.limit(limite + 1)`. Se vierem `limite + 1` linhas:
  `proximoCursor = itens[limite - 1].created_at`, descarta a última; senão
  `proximoCursor = null`. (Para prestadores a ordenação primária é `rating desc`; o
  cursor keyset ainda usa `created_at` como desempate estável — aceitável no MVP,
  documentado como limitação: reordenação de rating entre páginas pode duplicar/pular
  em casos raros. Alternativa de cursor composto fica para quando houver ranking real.)
- `buscar` usa `ilike('%' || termo || '%')` (sem índice FTS — volume do MVP é
  pequeno). Filtro de cidade: `.eq('cidade', filtros.cidade)` quando presente.
- `obterPerfil` agrega em paralelo (`Promise.all`): `perfis_publicos` (1 linha),
  `prestador_categoria` join `categoria_servico`, `portfolio_prestador`,
  `disponibilidade_prestador`. Monta `PrestadorPerfil`.
- `criar` (demanda, endereço): `.from(t).insert(row).select(...).single()`. `row`
  montado a partir do tipo de domínio + `cliente_id`/`usuario_id` de
  `useAuthStore.getState().usuarioId` **passado pela feature** (a impl recebe o id
  nos `dados`, não lê o store — mantém o repo sem dependência de store).

### 2.4 Tipos de domínio

Em `features/<feat>/types/*.types.ts`:

- `Categoria { id; nome; descricao: string | null; iconeKey; precoMedioHora: number; popular: boolean }`
- `PrestadorResumo { usuarioId; nome; cidade: string | null; tituloProfissional: string | null; precoBase: number | null; rating: number | null; totalAvaliacoes: number | null; verificado: boolean; disponivel: boolean; fotoPerfilUrl: string | null; avatarCorHex: string | null }`
- `PrestadorPerfil` = `PrestadorResumo` + `{ bio: string | null; raioKm: number | null; totalServicos: number | null; bairro: string | null; categorias: Categoria[]; portfolio: ItemPortfolio[]; disponibilidade: JanelaDisponibilidade[] }`
- `ItemPortfolio` / `JanelaDisponibilidade` — projeção das colunas não-sensíveis das
  tabelas respectivas (o plano de implementação fixa os campos exatos a partir do
  `db-types` gerado).
- `DemandaResumo { id; titulo; descricao; categoriaId; categoriaNome; enderecoCidade: string | null; enderecoBairro: string | null; orcamentoMaximo: number | null; urgencia; status; totalPropostas: number; createdAt }`
- `DemandaDetalhe` = `DemandaResumo` + `{ enderecoCompleto: string | null; dataDesejada: string | null; clienteNome }`
- `NovaDemanda { categoriaId; titulo; descricao; orcamentoMaximo: number | null; urgencia; enderecoCidade; enderecoBairro; enderecoCompleto; dataDesejada: string | null; clienteId }`
- `Endereco { id; rotulo: string | null; cidade; bairro: string | null; enderecoCompleto: string | null; ... }` (campos exatos do `db-types`)
- `NovoEndereco` = `Endereco` sem `id`/`created_at` + `usuarioId`

## 3. Features, telas e rotas

```
features/descoberta/
  screens/  BuscarScreen.tsx                  (substitui features/shell/screens/BuscarScreen.tsx)
            PrestadoresPorCategoriaScreen.tsx
  hooks/    useCategorias.ts
            usePrestadoresPorCategoria.ts  useBuscarPrestadores.ts
  components/ CategoriaCard.tsx  PrestadorCard.tsx
  types/    descoberta.types.ts

features/prestadores/
  screens/  PrestadorPerfilScreen.tsx
  hooks/    usePrestadorPerfil.ts
  components/ PortfolioGaleria.tsx  DisponibilidadeChips.tsx
  types/    prestador.types.ts

features/demandas/
  screens/  CriarDemandaScreen.tsx  DemandaDetalheScreen.tsx
            VagasScreen.tsx                   (substitui features/shell/screens/VagasScreen.tsx)
  hooks/    useCriarDemanda.ts  useDemandasAbertas.ts  useDemanda.ts
  components/ DemandaCard.tsx  SeletorCategoria.tsx  SeletorEndereco.tsx
  types/    demanda.types.ts

features/enderecos/
  hooks/    useMeusEnderecos.ts  useCriarEndereco.ts
  components/ FormEndereco.tsx
  types/    endereco.types.ts

shared/lib/
  useDebounce.ts  useDebounce.test.ts
  traduzErroRepo.ts  traduzErroRepo.test.ts
```

### Rotas novas (`app/(app)/`, apenas import + render de screen)

- `categoria/[id].tsx` → `PrestadoresPorCategoriaScreen`
- `prestador/[id].tsx` → `PrestadorPerfilScreen`
- `criar-demanda.tsx` → `CriarDemandaScreen`
- `demanda/[id].tsx` → `DemandaDetalheScreen`

### Mudanças no shell do Plano 2

- `features/shell/screens/BuscarScreen.tsx` e `VagasScreen.tsx`: **removidos**; a
  lógica vive nas features. `app/(app)/(tabs)/buscar.tsx` passa a renderizar
  `descoberta/screens/BuscarScreen`; `app/(app)/(tabs)/vagas.tsx` renderiza
  `demandas/screens/VagasScreen`.
- `features/shell/screens/InicioScreen.tsx`: mantém o texto por modo e ganha botões
  de ação rápida — contratar: "Criar demanda" (`/(app)/criar-demanda`) e "Buscar
  serviços" (`/(app)/(tabs)/buscar`); prestar: "Ver vagas" (`/(app)/(tabs)/vagas`).

### Fluxos

1. **Contratar — descoberta:** `BuscarScreen` tem um campo de busca e um campo de
   cidade (ambos texto livre). Campo de busca **vazio**: mostra a grade de
   categorias (`useCategorias`), filtrável em memória se o usuário digitar sem
   ainda ter 2 caracteres. Campo de busca com **≥ 2 caracteres**: a tela troca para
   a lista de resultados de prestador
   (`useBuscarPrestadores(termoDebounced, { cidade })`, infinite). Tap numa
   categoria → `categoria/[id]` (`usePrestadoresPorCategoria`, infinite,
   `FlatList`). Tap num prestador (de qualquer lista) → `prestador/[id]`
   (`usePrestadorPerfil`).
2. **Contratar — criar demanda:** Início/Buscar → `criar-demanda`.
   `SeletorCategoria` (usa `useCategorias`) + título + descrição + orçamento +
   urgência + `SeletorEndereco`. O seletor lista `useMeusEnderecos()`; "adicionar
   novo" abre `FormEndereco` → `useCriarEndereco` → o endereço criado é
   auto-selecionado. Submit → `useCriarDemanda(NovaDemanda)` com
   `enderecoCidade/Bairro/Completo` **copiados** do endereço escolhido
   (`demandas_servico` guarda texto, não FK) e `clienteId` do `authStore`. Sucesso →
   `router.replace('/(app)/demanda/' + id)`.
3. **Prestar — vagas:** `VagasScreen` → `useDemandasAbertas({ categoriaId?, cidade?, termo? })`
   (infinite). Campo de busca (texto livre, debounce 300 ms → `termo`) e campo de
   cidade (texto livre → `cidade`); filtro de categoria opcional via
   `SeletorCategoria`. Tap → `demanda/[id]` (`useDemanda`, `DemandaDetalheScreen`
   read-only; iniciar conversa é Plano 4).

## 4. Fluxo de dados (TanStack Query)

`queryKey` no padrão `['<dominio>','<consulta>',<filtros>]`:

| Hook | queryKey | tipo |
|---|---|---|
| `useCategorias` | `['categorias','listar']` | `useQuery`, `staleTime 5min` |
| `usePrestadoresPorCategoria(catId, filtros)` | `['prestadores','porCategoria',catId,filtros]` | `useInfiniteQuery` |
| `useBuscarPrestadores(termo, filtros)` | `['prestadores','buscar',termo,filtros]` | `useInfiniteQuery`, `enabled: termo.length >= 2` |
| `usePrestadorPerfil(usuarioId)` | `['prestadores','perfil',usuarioId]` | `useQuery` |
| `useDemandasAbertas(filtros)` | `['demandas','abertas',filtros]` | `useInfiniteQuery` |
| `useDemanda(id)` | `['demandas','detalhe',id]` | `useQuery` |
| `useMeusEnderecos()` | `['enderecos','meus']` | `useQuery` |

- **`useInfiniteQuery`:** `queryFn: ({ pageParam }) => repositories.X.metodo(..., { limite: 20, cursor: pageParam })`,
  `initialPageParam: undefined`, `getNextPageParam: (ultima) => ultima.proximoCursor ?? undefined`.
  A tela consome `data.pages.flatMap(p => p.itens)` e dispara `fetchNextPage()` no
  `onEndReached` da `FlatList` quando `hasNextPage && !isFetchingNextPage`.
- **Debounce:** a tela mantém `termo` local (`useState`) e deriva `termoDebounced`
  via `useDebounce(termo, 300)`. Só `termoDebounced` entra no `queryKey`/hook.
- **Mutations:**
  - `useCriarDemanda` — `mutationFn: (d: NovaDemanda) => repositories.demandas.criar(d)`;
    `onSuccess: () => queryClient.invalidateQueries({ queryKey: ['demandas','abertas'] })`.
    A screen navega com o `id` retornado.
  - `useCriarEndereco` — `mutationFn: (d: NovoEndereco) => repositories.enderecos.criar(d)`;
    `onSuccess: () => queryClient.invalidateQueries({ queryKey: ['enderecos','meus'] })`;
    retorna o `Endereco` criado para o `SeletorEndereco`.
- Sem realtime.

## 5. Erros

- Repository sempre entrega `RepoError`. Hooks não capturam — o erro propaga para
  `useQuery`/`useMutation` (`isError`, `error: RepoError`).
- `traduzErroRepo(e: RepoError): string` (novo, em `shared/lib/`, análogo ao
  `traduzErroAuth` do Plano 2):
  - `rede` → "Sem conexão. Verifique a internet e tente de novo."
  - `nao_autorizado` → "Você não tem acesso a isso."
  - `nao_encontrado` → "Não encontramos o que você procurava."
  - `nao_autenticado` → "Sua sessão expirou. Entre de novo."
  - `conflito` → "Isso já existe."
  - `validacao` → "Dados inválidos. Revise e tente de novo."
  - default → "Algo deu errado. Tente de novo."
- Telas de lista: `isLoading` → `<CarregandoEstado/>`; `isError` →
  `<ErroEstado mensagem={traduzErroRepo(error)} onRetry={refetch}/>`; lista vazia →
  `<VazioEstado mensagem="…"/>`. (átomos do Plano 2.)
- `CriarDemandaScreen`: erro da mutation inline em `<Text className="text-sf-status-red">`,
  como as telas de auth do Plano 2.
- `QueryCache.onError` global (Plano 2) segue chamando `notificarErroGlobal(msg)` —
  nenhuma mudança nesta camada.

## 6. Testes

| Alvo | Como |
|---|---|
| `normalizarErro` | Unitário puro. Tabela `{ PostgrestError-like } → CodigoRepo`. |
| `traduzErroRepo` | Unitário. Cada `code` → string. |
| `useDebounce` | Unitário com `jest.useFakeTimers`. |
| Repos `.supabase.ts` | 1 teste por método, mockando `supabase` (chain `.from().select()…` como no Plano 2). Cobre: map linha→domínio; `throw normalizarErro` no `catch` e no `{ error }`; keyset (`proximoCursor` montado, item `limite+1` cortado). |
| Hooks | `renderHook` + `criarWrapperQuery()` (Plano 2), mockando `@/shared/api/repositories`. Cobre `useCategorias`, os `useInfiniteQuery` (`getNextPageParam`), `useCriarDemanda` (invalidação no `onSuccess`), `useCriarEndereco` (retorna o novo). |
| Screens | Só com lógica condicional própria: `CriarDemandaScreen` (validação obrigatória + botão desabilita) e `SeletorEndereco` (alterna lista↔`FormEndereco` + auto-seleção pós-criar). Buscar/Vagas/perfil sem teste. |

**Gate do plano** (igual Plano 2): `tsc --noEmit` 0 · `jest` verde e auto-encerrando ·
`eslint` 0 · `expo-doctor` 18/18 · `expo export --platform ios` EXIT 0.

Regra mantida: nenhum `*.test.*` dentro de `app/`. Todo hook react-query nos testes
usa `criarWrapperQuery()` (Ruling R6 do Plano 2). Seletores Zustand em `app/`
permanecem atômicos (Ruling R7).

## 7. Interfaces que os planos seguintes consomem

- `apps/mobile/src/shared/api/repositories/{types.ts,index.ts}` — `RepoError`,
  `PageParams`, `Pagina<T>`, `normalizarErro`, `repositories`. Plano 4+ adiciona
  `conversas`, `propostas`, etc. ao barrel seguindo o mesmo padrão interface + impl.
- `shared/lib/{useDebounce,traduzErroRepo}` — reutilizáveis.
- `DemandaResumo` / `DemandaDetalhe` / `NovaDemanda` — o Plano 4 (conversa a partir
  de demanda) importa esses tipos.
- `PrestadorResumo` / `PrestadorPerfil` — Plano 4 (conversa direta a partir do perfil).
