# Plano 3 — Repositories e descoberta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a camada de repositories genérica sobre `supabase-js` (o seam para a futura API C#) e a feature de descoberta do MVP — cliente encontra categorias/prestadores e cria demandas; prestador vê o feed de demandas abertas.

**Architecture:** `screen → hook (TanStack Query) → repository (interface) → implementação Supabase → Postgres/RLS`. Um diretório por domínio em `apps/mobile/src/shared/api/repositories/` com interface e implementação `.supabase.ts` separadas; a implementação converte linha do banco (`@servico-feito/db-types`) em tipo de domínio e normaliza todo erro do `supabase-js` para `RepoError` antes de sair. Hooks por feature (`useCategorias`, `usePrestadoresPorCategoria`, `useDemandasAbertas`, `useCriarDemanda`, …). Nenhuma migração — o RLS do Plano 1 já cobre leitura pública de catálogo/perfil/portfólio/disponibilidade e insert do dono para demanda/endereço.

**Tech Stack:** Expo SDK 52, Expo Router 4, React Native 0.76.9, TypeScript 5.6 (strict, `noUncheckedIndexedAccess`), `@supabase/supabase-js` 2.x, `@tanstack/react-query` 5 (`useQuery` / `useInfiniteQuery` / `useMutation`), Zustand 5, NativeWind 4.1.23, Jest (`jest-expo`) + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-09-09-plano-3-repositories-descoberta-design.md`

## Global Constraints

- Worktree: `.worktrees/plano-3-repositories-descoberta`, branch `plano-3-repositories-descoberta`, base `homolog` @ `fb20f82`. Rodar tudo daqui. App = workspace `@servico-feito/mobile` em `apps/mobile`.
- TypeScript **strict** + `noUncheckedIndexedAccess`. `pnpm --filter @servico-feito/mobile exec tsc --noEmit` exit 0 é gate de toda task que toca `.ts`/`.tsx`.
- **Fluxo obrigatório:** screen → hook → repository (interface) → `.supabase.ts` → Postgres. Screen/layout **nunca** importa `supabase-js` nem uma implementação de repository diretamente — só hooks. Hook chama `repositories.<dominio>.<metodo>()`.
- **Erro:** a implementação `.supabase.ts` sempre lança `RepoError` (nunca vaza `PostgrestError`/`AuthError`). `{ data, error }` com `error` não-nulo → `throw normalizarErro(error)`. Exceção capturada → `throw normalizarErro(e)`.
- **Paginação:** `demandas` usa keyset em `created_at` (a tabela tem a coluna). `prestadores` usa **offset** via `.range()` — a view `perfis_publicos` não tem `created_at`. `PageParams.cursor` é **string opaca**: para demandas é o `created_at` ISO do último item; para prestadores é o offset serializado (`String(offsetProximaPagina)`). `Pagina<T>.proximoCursor` é `null` quando não há próxima página.
- **Ruling R3 (Plano 2):** `process.env.EXPO_PUBLIC_*` só é lido literalmente em `supabaseClient.ts` — nenhum arquivo novo lê env.
- **Ruling R6 (Plano 2):** todo teste de hook react-query usa `criarWrapperQuery()` de `@/test/criarWrapperQuery` — nunca um `new QueryClient(...)` inline.
- **Ruling R7 (Plano 2):** componentes/telas em `app/` usam só seletores Zustand atômicos (`useAuthStore((s) => s.usuarioId)`), nunca seletor objeto-literal sem `useShallow`.
- **Nenhum `*.test.ts` / `*.test.tsx` dentro de `apps/mobile/app/`.** Test de tela que precise importar um arquivo de `app/` vive em `apps/mobile/src/app-tests/` (padrão do Plano 2, `tabsLayout.test.tsx`).
- `tsconfig.json` do app **exclui** `**/*.test.ts` / `**/*.test.tsx` do `tsc` — os testes rodam só pelo Jest.
- **Nomenclatura:** pastas de feature minúsculas plural (`descoberta`, `prestadores`, `demandas`, `enderecos`); screens sufixo `Screen`; hooks prefixo `use`; tipos de domínio `*.types.ts`.
- Classes Tailwind: só tokens `sf-*` (paleta no Plano 2) + os literais `#fff` (`ActivityIndicator color`) / `#9E9E9E` (`placeholderTextColor`) já usados no Plano 2.
- Arquivos em `app/` só importam e renderizam uma screen/layout — nenhuma lógica.
- Commits Conventional Commits. `git config user`: `VitorHugoVH` / `vhfraga007@gmail.com`.
- Node 18 no host → `WARN Unsupported engine` em todo `pnpm`/`tsc`/`jest`, **aceito** (CI usa Node 20).
- **Gate final do plano** (última task): `tsc --noEmit` 0 · `pnpm --filter @servico-feito/mobile test` verde e auto-encerrando (sem `--forceExit`) · `eslint .` 0 · `pnpm --filter @servico-feito/mobile exec expo-doctor` 18/18 · `pnpm --filter @servico-feito/mobile exec expo export --platform ios --output-dir /tmp/p3` EXIT 0.

## Fatos do schema (de `packages/db-types/index.ts` @ `fb20f82`)

- `categoria_servico.Row`: `id, nome, descricao: string|null, icone_key, popular: boolean, preco_medio_hora: number, created_at`.
- `perfis_publicos` (view, **todas as colunas nullable**, sem `created_at`): `usuario_id, nome, cidade, bairro, avatar_cor_hex, foto_perfil_url, rating_cliente, titulo_profissional, bio, preco_base, rating, total_avaliacoes, total_servicos, verificado, disponivel, raio_km`.
- `prestador_categoria.Row`: `prestador_id, categoria_id` (PK composta; `prestador_id` referencia `perfil_prestador.usuario_id`).
- `portfolio_prestador.Row`: `id, prestador_id, url_media, created_at`.
- `disponibilidade_prestador.Row`: `usuario_id, dom, seg, ter, qua, qui, sex, sab: boolean, updated_at` (1 linha por prestador — **flags de dia da semana**, não janelas de horário).
- `demandas_servico.Row`: `id, cliente_id, categoria_id, titulo, descricao, endereco_cidade: string|null, endereco_bairro: string|null, endereco_completo: string|null, orcamento_maximo: number|null, data_desejada: string|null, urgencia: string, status: status_demanda, total_propostas: number, created_at, updated_at`. FK `demandas_servico_cliente_id_fkey` resolve tanto para `usuarios` quanto para `perfis_publicos`.
- `status_demanda` enum: `ABERTA | EM_NEGOCIACAO | CONTRATADA | FINALIZADA | CANCELADA`.
- `enderecos_usuario.Row`: `id, usuario_id, identificacao: string|null, cep: string|null, estado: string|null, cidade: string|null, bairro: string|null, logradouro: string|null, numero: string|null, complemento: string|null, principal: boolean, created_at, updated_at`.
- RLS do Plano 1 (nenhuma mudança neste plano): `categoria_select_todos`, `perfil_prestador_select_todos`, `prestador_categoria_select_todos`, `portfolio_select_todos`, `disponibilidade_select_todos`, view `perfis_publicos` (grant select a `anon, authenticated`); `demandas_select_dono_ou_prestador_abertas` (`for select to authenticated`), `demandas_insert_cliente` (`with check cliente_id = auth.uid()`); `enderecos_select_dono` / `enderecos_insert_dono`.

---

## Task 1: Infra de repositories — `types.ts`

**Files:**
- Create: `apps/mobile/src/shared/api/repositories/types.ts`
- Create: `apps/mobile/src/shared/api/repositories/types.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type CodigoRepo = 'nao_autenticado' | 'nao_autorizado' | 'nao_encontrado' | 'conflito' | 'validacao' | 'rede' | 'desconhecido'`
  - `class RepoError extends Error { code: CodigoRepo; cause?: unknown }` — construtor `(code, message, cause?)`.
  - `interface PageParams { limite: number; cursor?: string }`
  - `interface Pagina<T> { itens: T[]; proximoCursor: string | null }`
  - `function normalizarErro(e: unknown): RepoError`

- [ ] **Step 1: Escrever o teste `types.test.ts`**

```ts
import { RepoError, normalizarErro } from "./types";

describe("normalizarErro", () => {
  it("PGRST116 (0 linhas) → nao_encontrado", () => {
    const e = normalizarErro({ code: "PGRST116", message: "Results contain 0 rows" });
    expect(e).toBeInstanceOf(RepoError);
    expect(e.code).toBe("nao_encontrado");
  });

  it("23505 (unique) → conflito", () => {
    expect(normalizarErro({ code: "23505", message: "duplicate key" }).code).toBe("conflito");
  });

  it("outras constraints 23xxx → validacao", () => {
    expect(normalizarErro({ code: "23503", message: "fk violation" }).code).toBe("validacao");
  });

  it("42501 (RLS/privilege) → nao_autorizado", () => {
    expect(normalizarErro({ code: "42501", message: "permission denied" }).code).toBe("nao_autorizado");
  });

  it("status 401 → nao_autenticado", () => {
    expect(normalizarErro({ status: 401, message: "JWT expired" }).code).toBe("nao_autenticado");
  });

  it("TypeError de fetch → rede", () => {
    expect(normalizarErro(new TypeError("Network request failed")).code).toBe("rede");
  });

  it("desconhecido por padrão", () => {
    expect(normalizarErro({ foo: 1 }).code).toBe("desconhecido");
    expect(normalizarErro("qualquer coisa").code).toBe("desconhecido");
  });

  it("preserva o original em cause e não vaza a mensagem crua", () => {
    const orig = { code: "23505", message: "duplicate key value violates unique constraint \"x\"" };
    const e = normalizarErro(orig);
    expect(e.cause).toBe(orig);
    expect(e.message).not.toContain("unique constraint");
  });

  it("um RepoError passa reto (idempotente)", () => {
    const e = new RepoError("rede", "Sem conexão.");
    expect(normalizarErro(e)).toBe(e);
  });
});
```

- [ ] **Step 2: Rodar — FALHA**

Run: `pnpm --filter @servico-feito/mobile test types`
Expected: FAIL — `Cannot find module './types'`.

- [ ] **Step 3: Escrever `types.ts`**

```ts
export type CodigoRepo =
  | "nao_autenticado"
  | "nao_autorizado"
  | "nao_encontrado"
  | "conflito"
  | "validacao"
  | "rede"
  | "desconhecido";

export class RepoError extends Error {
  code: CodigoRepo;
  cause?: unknown;
  constructor(code: CodigoRepo, message: string, cause?: unknown) {
    super(message);
    this.name = "RepoError";
    this.code = code;
    this.cause = cause;
  }
}

export interface PageParams {
  limite: number;
  cursor?: string;
}

export interface Pagina<T> {
  itens: T[];
  proximoCursor: string | null;
}

const MENSAGEM: Record<CodigoRepo, string> = {
  nao_autenticado: "Sua sessão expirou. Entre de novo.",
  nao_autorizado: "Você não tem acesso a isso.",
  nao_encontrado: "Não encontramos o que você procurava.",
  conflito: "Isso já existe.",
  validacao: "Dados inválidos. Revise e tente de novo.",
  rede: "Sem conexão. Verifique a internet e tente de novo.",
  desconhecido: "Algo deu errado. Tente de novo.",
};

function classificar(e: unknown): CodigoRepo {
  if (e instanceof TypeError && /network request failed|failed to fetch/i.test(e.message)) {
    return "rede";
  }
  if (typeof e === "object" && e !== null) {
    const obj = e as { code?: unknown; status?: unknown; message?: unknown };
    if (obj.status === 401) return "nao_autenticado";
    const code = typeof obj.code === "string" ? obj.code : "";
    if (code === "PGRST116") return "nao_encontrado";
    if (code === "42501") return "nao_autorizado";
    if (code === "23505") return "conflito";
    if (code.startsWith("23")) return "validacao";
    if (typeof obj.message === "string" && /jwt|not authenticated|auth session missing/i.test(obj.message)) {
      return "nao_autenticado";
    }
  }
  return "desconhecido";
}

export function normalizarErro(e: unknown): RepoError {
  if (e instanceof RepoError) return e;
  const code = classificar(e);
  return new RepoError(code, MENSAGEM[code], e);
}
```

- [ ] **Step 4: Rodar — PASSA**

Run: `pnpm --filter @servico-feito/mobile test types`
Expected: PASS — 9 testes.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter @servico-feito/mobile exec tsc --noEmit` → exit 0.

```bash
git add apps/mobile/src/shared/api/repositories/types.ts apps/mobile/src/shared/api/repositories/types.test.ts
git commit -m "feat(mobile): infra de repositories (RepoError, PageParams, normalizarErro)"
```

---

## Task 2: Repository `categorias` + barrel `index.ts`

**Files:**
- Create: `apps/mobile/src/features/descoberta/types/descoberta.types.ts`
- Create: `apps/mobile/src/shared/api/repositories/categorias/categoriasRepository.ts`
- Create: `apps/mobile/src/shared/api/repositories/categorias/categoriasRepository.supabase.ts`
- Create: `apps/mobile/src/shared/api/repositories/categorias/categoriasRepository.supabase.test.ts`
- Create: `apps/mobile/src/shared/api/repositories/index.ts`

**Interfaces:**
- Consumes: `normalizarErro` (Task 1); `supabase` de `@/shared/api/supabaseClient`; `Database` de `@servico-feito/db-types`.
- Produces:
  - `interface Categoria { id: string; nome: string; descricao: string | null; iconeKey: string; popular: boolean; precoMedioHora: number }`
  - `interface CategoriasRepository { listar(): Promise<Categoria[]> }`
  - `categoriasRepositorySupabase: CategoriasRepository`
  - `export const repositories = { categorias: categoriasRepositorySupabase }` em `repositories/index.ts` (crescerá nas próximas tasks).

- [ ] **Step 1: Escrever `descoberta.types.ts`**

```ts
export interface Categoria {
  id: string;
  nome: string;
  descricao: string | null;
  iconeKey: string;
  popular: boolean;
  precoMedioHora: number;
}
```

- [ ] **Step 2: Escrever a interface `categoriasRepository.ts`**

```ts
import type { Categoria } from "@/features/descoberta/types/descoberta.types";

export interface CategoriasRepository {
  /** Todas as categorias, ordenadas por nome. Lista completa — o seed é pequeno. */
  listar(): Promise<Categoria[]>;
}
```

- [ ] **Step 3: Escrever o teste `categoriasRepository.supabase.test.ts`**

```ts
import { categoriasRepositorySupabase } from "./categoriasRepository.supabase";
import { RepoError } from "../types";

const supa = require("@/shared/api/supabaseClient").supabase;

function mockFrom(resultado: { data: unknown; error: unknown }) {
  const order = jest.fn().mockResolvedValue(resultado);
  const select = jest.fn().mockReturnValue({ order });
  jest.spyOn(supa, "from").mockReturnValue({ select } as never);
  return { select, order };
}

it("listar mapeia linha do banco para Categoria (camelCase)", async () => {
  mockFrom({
    data: [
      { id: "c1", nome: "Diarista", descricao: null, icone_key: "broom", popular: true, preco_medio_hora: 50 },
    ],
    error: null,
  });
  const r = await categoriasRepositorySupabase.listar();
  expect(supa.from).toHaveBeenCalledWith("categoria_servico");
  expect(r).toEqual([
    { id: "c1", nome: "Diarista", descricao: null, iconeKey: "broom", popular: true, precoMedioHora: 50 },
  ]);
});

it("listar lança RepoError normalizado quando o supabase retorna error", async () => {
  mockFrom({ data: null, error: { code: "42501", message: "permission denied" } });
  await expect(categoriasRepositorySupabase.listar()).rejects.toBeInstanceOf(RepoError);
  await expect(categoriasRepositorySupabase.listar()).rejects.toMatchObject({ code: "nao_autorizado" });
});
```

- [ ] **Step 4: Rodar — FALHA**

Run: `pnpm --filter @servico-feito/mobile test categoriasRepository`
Expected: FAIL — `Cannot find module './categoriasRepository.supabase'`.

- [ ] **Step 5: Escrever `categoriasRepository.supabase.ts`**

```ts
import { supabase } from "@/shared/api/supabaseClient";
import type { Database } from "@servico-feito/db-types";
import type { Categoria } from "@/features/descoberta/types/descoberta.types";
import type { CategoriasRepository } from "./categoriasRepository";
import { normalizarErro } from "../types";

type LinhaCategoria = Database["public"]["Tables"]["categoria_servico"]["Row"];

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
```

- [ ] **Step 6: Escrever o barrel `repositories/index.ts`**

```ts
import { categoriasRepositorySupabase } from "./categorias/categoriasRepository.supabase";

export const repositories = {
  categorias: categoriasRepositorySupabase,
};

export type { CategoriasRepository } from "./categorias/categoriasRepository";
export { RepoError, normalizarErro } from "./types";
export type { CodigoRepo, PageParams, Pagina } from "./types";
```

- [ ] **Step 7: Rodar — PASSA. Typecheck. Commit**

Run: `pnpm --filter @servico-feito/mobile test categoriasRepository` → PASS (2 testes, uma delas com 2 `expect().rejects`).
Run: `pnpm --filter @servico-feito/mobile exec tsc --noEmit` → exit 0.

```bash
git add apps/mobile/src/features/descoberta/types apps/mobile/src/shared/api/repositories
git commit -m "feat(mobile): repository categorias + barrel de repositories"
```

---

## Task 3: Repository `enderecos`

**Files:**
- Create: `apps/mobile/src/features/enderecos/types/endereco.types.ts`
- Create: `apps/mobile/src/shared/api/repositories/enderecos/enderecosRepository.ts`
- Create: `apps/mobile/src/shared/api/repositories/enderecos/enderecosRepository.supabase.ts`
- Create: `apps/mobile/src/shared/api/repositories/enderecos/enderecosRepository.supabase.test.ts`
- Modify: `apps/mobile/src/shared/api/repositories/index.ts` (adiciona `enderecos` ao objeto)

**Interfaces:**
- Consumes: `normalizarErro`, `supabase`, `Database`.
- Produces:
  - `interface Endereco { id: string; identificacao: string | null; cep: string | null; estado: string | null; cidade: string | null; bairro: string | null; logradouro: string | null; numero: string | null; complemento: string | null; principal: boolean }`
  - `interface NovoEndereco { usuarioId: string; identificacao: string | null; cep: string | null; estado: string | null; cidade: string | null; bairro: string | null; logradouro: string | null; numero: string | null; complemento: string | null; principal: boolean }`
  - `interface EnderecosRepository { listarMeus(): Promise<Endereco[]>; criar(dados: NovoEndereco): Promise<Endereco> }`
  - `repositories.enderecos: EnderecosRepository`

- [ ] **Step 1: Escrever `endereco.types.ts`**

```ts
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
```

- [ ] **Step 2: Escrever a interface `enderecosRepository.ts`**

```ts
import type { Endereco, NovoEndereco } from "@/features/enderecos/types/endereco.types";

export interface EnderecosRepository {
  /** Endereços do usuário logado (RLS: só o dono), mais recentes primeiro. */
  listarMeus(): Promise<Endereco[]>;
  criar(dados: NovoEndereco): Promise<Endereco>;
}
```

- [ ] **Step 3: Escrever o teste `enderecosRepository.supabase.test.ts`**

```ts
import { enderecosRepositorySupabase } from "./enderecosRepository.supabase";
import { RepoError } from "../types";

const supa = require("@/shared/api/supabaseClient").supabase;

const LINHA = {
  id: "e1", usuario_id: "u1", identificacao: "Casa", cep: "88000-000", estado: "SC",
  cidade: "Floripa", bairro: "Centro", logradouro: "Rua A", numero: "10",
  complemento: "ap 2", principal: true, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};
const DOMINIO = {
  id: "e1", identificacao: "Casa", cep: "88000-000", estado: "SC", cidade: "Floripa",
  bairro: "Centro", logradouro: "Rua A", numero: "10", complemento: "ap 2", principal: true,
};

it("listarMeus mapeia e ordena por created_at desc", async () => {
  const order = jest.fn().mockResolvedValue({ data: [LINHA], error: null });
  const select = jest.fn().mockReturnValue({ order });
  jest.spyOn(supa, "from").mockReturnValue({ select } as never);

  const r = await enderecosRepositorySupabase.listarMeus();
  expect(supa.from).toHaveBeenCalledWith("enderecos_usuario");
  expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  expect(r).toEqual([DOMINIO]);
});

it("criar faz insert do row montado e devolve o Endereco", async () => {
  const single = jest.fn().mockResolvedValue({ data: LINHA, error: null });
  const select = jest.fn().mockReturnValue({ single });
  const insert = jest.fn().mockReturnValue({ select });
  jest.spyOn(supa, "from").mockReturnValue({ insert } as never);

  const r = await enderecosRepositorySupabase.criar({
    usuarioId: "u1", identificacao: "Casa", cep: "88000-000", estado: "SC", cidade: "Floripa",
    bairro: "Centro", logradouro: "Rua A", numero: "10", complemento: "ap 2", principal: true,
  });
  expect(insert).toHaveBeenCalledWith(
    expect.objectContaining({ usuario_id: "u1", identificacao: "Casa", cidade: "Floripa" }),
  );
  expect(r).toEqual(DOMINIO);
});

it("criar lança RepoError normalizado no error do supabase", async () => {
  const single = jest.fn().mockResolvedValue({ data: null, error: { code: "23505", message: "dup" } });
  const select = jest.fn().mockReturnValue({ single });
  const insert = jest.fn().mockReturnValue({ select });
  jest.spyOn(supa, "from").mockReturnValue({ insert } as never);

  await expect(
    enderecosRepositorySupabase.criar({
      usuarioId: "u1", identificacao: null, cep: null, estado: null, cidade: "x", bairro: null,
      logradouro: null, numero: null, complemento: null, principal: false,
    }),
  ).rejects.toMatchObject({ code: "conflito" });
  await expect(enderecosRepositorySupabase.criar as never).toBeInstanceOf(Function);
  expect(new RepoError("rede", "x")).toBeInstanceOf(RepoError);
});
```

- [ ] **Step 4: Rodar — FALHA** (`Cannot find module './enderecosRepository.supabase'`).

- [ ] **Step 5: Escrever `enderecosRepository.supabase.ts`**

```ts
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
```

- [ ] **Step 6: Adicionar ao barrel `repositories/index.ts`**

```ts
import { categoriasRepositorySupabase } from "./categorias/categoriasRepository.supabase";
import { enderecosRepositorySupabase } from "./enderecos/enderecosRepository.supabase";

export const repositories = {
  categorias: categoriasRepositorySupabase,
  enderecos: enderecosRepositorySupabase,
};

export type { CategoriasRepository } from "./categorias/categoriasRepository";
export type { EnderecosRepository } from "./enderecos/enderecosRepository";
export { RepoError, normalizarErro } from "./types";
export type { CodigoRepo, PageParams, Pagina } from "./types";
```

- [ ] **Step 7: Rodar — PASSA. Typecheck. Commit**

Run: `pnpm --filter @servico-feito/mobile test enderecosRepository` → PASS.
Run: `pnpm --filter @servico-feito/mobile exec tsc --noEmit` → exit 0.

```bash
git add apps/mobile/src/features/enderecos apps/mobile/src/shared/api/repositories
git commit -m "feat(mobile): repository enderecos (listar próprios + criar)"
```

---

## Task 4: Repository `demandas`

**Files:**
- Create: `apps/mobile/src/features/demandas/types/demanda.types.ts`
- Create: `apps/mobile/src/shared/api/repositories/demandas/demandasRepository.ts`
- Create: `apps/mobile/src/shared/api/repositories/demandas/demandasRepository.supabase.ts`
- Create: `apps/mobile/src/shared/api/repositories/demandas/demandasRepository.supabase.test.ts`
- Modify: `apps/mobile/src/shared/api/repositories/index.ts`

**Interfaces:**
- Consumes: `normalizarErro`, `PageParams`, `Pagina`, `supabase`, `Database`, `Categoria` (Task 2).
- Produces:
  - `type UrgenciaDemanda = string` (o banco guarda texto livre com default `'Normal'`).
  - `interface DemandaResumo { id: string; titulo: string; descricao: string; categoriaId: string; categoriaNome: string; enderecoCidade: string | null; enderecoBairro: string | null; orcamentoMaximo: number | null; urgencia: string; status: string; totalPropostas: number; createdAt: string }`
  - `interface DemandaDetalhe extends DemandaResumo { enderecoCompleto: string | null; dataDesejada: string | null; clienteNome: string | null }`
  - `interface NovaDemanda { clienteId: string; categoriaId: string; titulo: string; descricao: string; orcamentoMaximo: number | null; urgencia: string; enderecoCidade: string | null; enderecoBairro: string | null; enderecoCompleto: string | null; dataDesejada: string | null }`
  - `interface FiltrosDemanda { categoriaId?: string; cidade?: string; termo?: string }`
  - `interface DemandasRepository { listarAbertas(filtros: FiltrosDemanda, page: PageParams): Promise<Pagina<DemandaResumo>>; obter(id: string): Promise<DemandaDetalhe>; criar(dados: NovaDemanda): Promise<{ id: string }> }`
  - `repositories.demandas: DemandasRepository`

- [ ] **Step 1: Escrever `demanda.types.ts`**

```ts
export interface DemandaResumo {
  id: string;
  titulo: string;
  descricao: string;
  categoriaId: string;
  categoriaNome: string;
  enderecoCidade: string | null;
  enderecoBairro: string | null;
  orcamentoMaximo: number | null;
  urgencia: string;
  status: string;
  totalPropostas: number;
  createdAt: string;
}

export interface DemandaDetalhe extends DemandaResumo {
  enderecoCompleto: string | null;
  dataDesejada: string | null;
  clienteNome: string | null;
}

export interface NovaDemanda {
  clienteId: string;
  categoriaId: string;
  titulo: string;
  descricao: string;
  orcamentoMaximo: number | null;
  urgencia: string;
  enderecoCidade: string | null;
  enderecoBairro: string | null;
  enderecoCompleto: string | null;
  dataDesejada: string | null;
}

export interface FiltrosDemanda {
  categoriaId?: string;
  cidade?: string;
  termo?: string;
}
```

- [ ] **Step 2: Escrever a interface `demandasRepository.ts`**

```ts
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
```

- [ ] **Step 3: Escrever o teste `demandasRepository.supabase.test.ts`**

```ts
import { demandasRepositorySupabase } from "./demandasRepository.supabase";
import { RepoError } from "../types";

const supa = require("@/shared/api/supabaseClient").supabase;

function linha(id: string, createdAt: string) {
  return {
    id, titulo: "Pintar sala", descricao: "2 paredes", categoria_id: "c1",
    categoria_servico: { nome: "Pintor" }, endereco_cidade: "Floripa", endereco_bairro: "Centro",
    endereco_completo: "Rua A, 10", orcamento_maximo: 500, data_desejada: null, urgencia: "Normal",
    status: "ABERTA", total_propostas: 0, created_at: createdAt,
    perfis_publicos: { nome: "Ana" },
  };
}

/** Encadeia os métodos do query builder que a impl usa e resolve com `resultado`. */
function mockQuery(resultado: { data: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> = {};
  const chain = () => q;
  for (const m of ["select", "eq", "ilike", "order", "lt", "limit"]) {
    q[m] = jest.fn(chain);
  }
  q.limit = jest.fn().mockResolvedValue(resultado);
  q.single = jest.fn().mockResolvedValue(resultado);
  jest.spyOn(supa, "from").mockReturnValue(q as never);
  return q;
}

it("listarAbertas mapeia linhas + categoriaNome do join e monta proximoCursor quando há página cheia", async () => {
  const q = mockQuery({
    data: [linha("d1", "2026-03-03T00:00:00Z"), linha("d2", "2026-03-02T00:00:00Z"), linha("d3", "2026-03-01T00:00:00Z")],
    error: null,
  });
  const r = await demandasRepositorySupabase.listarAbertas({}, { limite: 2 });
  expect(supa.from).toHaveBeenCalledWith("demandas_servico");
  expect(q.eq).toHaveBeenCalledWith("status", "ABERTA");
  expect(q.limit).toHaveBeenCalledWith(3); // limite + 1
  expect(r.itens.map((d) => d.id)).toEqual(["d1", "d2"]); // extra descartado
  expect(r.itens[0]?.categoriaNome).toBe("Pintor");
  expect(r.proximoCursor).toBe("2026-03-02T00:00:00Z"); // created_at do último item retornado
});

it("listarAbertas sem página cheia → proximoCursor null", async () => {
  mockQuery({ data: [linha("d1", "2026-03-03T00:00:00Z")], error: null });
  const r = await demandasRepositorySupabase.listarAbertas({}, { limite: 2 });
  expect(r.itens).toHaveLength(1);
  expect(r.proximoCursor).toBeNull();
});

it("listarAbertas aplica cursor (lt created_at), filtro de cidade e termo", async () => {
  const q = mockQuery({ data: [], error: null });
  await demandasRepositorySupabase.listarAbertas(
    { cidade: "Floripa", termo: "pint", categoriaId: "c1" },
    { limite: 20, cursor: "2026-03-02T00:00:00Z" },
  );
  expect(q.lt).toHaveBeenCalledWith("created_at", "2026-03-02T00:00:00Z");
  expect(q.eq).toHaveBeenCalledWith("endereco_cidade", "Floripa");
  expect(q.eq).toHaveBeenCalledWith("categoria_id", "c1");
  expect(q.ilike).toHaveBeenCalledWith("titulo", "%pint%");
});

it("obter devolve DemandaDetalhe com clienteNome do join perfis_publicos", async () => {
  mockQuery({ data: linha("d1", "2026-03-03T00:00:00Z"), error: null });
  const d = await demandasRepositorySupabase.obter("d1");
  expect(d.clienteNome).toBe("Ana");
  expect(d.enderecoCompleto).toBe("Rua A, 10");
});

it("obter em 0 linhas (PGRST116) → RepoError nao_encontrado", async () => {
  mockQuery({ data: null, error: { code: "PGRST116", message: "0 rows" } });
  await expect(demandasRepositorySupabase.obter("x")).rejects.toMatchObject({ code: "nao_encontrado" });
});

it("criar insere row (status default do banco) e devolve { id }", async () => {
  const single = jest.fn().mockResolvedValue({ data: { id: "novo" }, error: null });
  const select = jest.fn().mockReturnValue({ single });
  const insert = jest.fn().mockReturnValue({ select });
  jest.spyOn(supa, "from").mockReturnValue({ insert } as never);

  const r = await demandasRepositorySupabase.criar({
    clienteId: "u1", categoriaId: "c1", titulo: "Pintar", descricao: "sala",
    orcamentoMaximo: 500, urgencia: "Normal", enderecoCidade: "Floripa",
    enderecoBairro: "Centro", enderecoCompleto: "Rua A, 10", dataDesejada: null,
  });
  expect(insert).toHaveBeenCalledWith(
    expect.objectContaining({ cliente_id: "u1", categoria_id: "c1", titulo: "Pintar" }),
  );
  expect(insert.mock.calls[0][0]).not.toHaveProperty("status"); // deixa o default 'ABERTA' do banco
  expect(r).toEqual({ id: "novo" });
});

it("RepoError é instância de Error", () => {
  expect(new RepoError("rede", "x")).toBeInstanceOf(Error);
});
```

- [ ] **Step 4: Rodar — FALHA.**

- [ ] **Step 5: Escrever `demandasRepository.supabase.ts`**

```ts
import { supabase } from "@/shared/api/supabaseClient";
import type { Database } from "@servico-feito/db-types";
import type {
  DemandaResumo,
  DemandaDetalhe,
  NovaDemanda,
  FiltrosDemanda,
} from "@/features/demandas/types/demanda.types";
import type { PageParams, Pagina } from "../types";
import type { DemandasRepository } from "./demandasRepository";
import { normalizarErro } from "../types";

type LinhaDemanda = Database["public"]["Tables"]["demandas_servico"]["Row"] & {
  categoria_servico: { nome: string } | null;
  perfis_publicos: { nome: string | null } | null;
};

const SELECT_RESUMO =
  "id, titulo, descricao, categoria_id, endereco_cidade, endereco_bairro, orcamento_maximo, urgencia, status, total_propostas, created_at, categoria_servico(nome)";

const SELECT_DETALHE =
  SELECT_RESUMO +
  ", endereco_completo, data_desejada, perfis_publicos:demandas_servico_cliente_id_fkey(nome)";

function paraResumo(l: LinhaDemanda): DemandaResumo {
  return {
    id: l.id,
    titulo: l.titulo,
    descricao: l.descricao,
    categoriaId: l.categoria_id,
    categoriaNome: l.categoria_servico?.nome ?? "",
    enderecoCidade: l.endereco_cidade,
    enderecoBairro: l.endereco_bairro,
    orcamentoMaximo: l.orcamento_maximo,
    urgencia: l.urgencia,
    status: l.status,
    totalPropostas: l.total_propostas,
    createdAt: l.created_at,
  };
}

export const demandasRepositorySupabase: DemandasRepository = {
  async listarAbertas(filtros: FiltrosDemanda, page: PageParams) {
    try {
      let q = supabase
        .from("demandas_servico")
        .select(SELECT_RESUMO)
        .eq("status", "ABERTA")
        .order("created_at", { ascending: false });

      if (filtros.categoriaId) q = q.eq("categoria_id", filtros.categoriaId);
      if (filtros.cidade) q = q.eq("endereco_cidade", filtros.cidade);
      if (filtros.termo) q = q.ilike("titulo", `%${filtros.termo}%`);
      if (page.cursor) q = q.lt("created_at", page.cursor);

      const { data, error } = await q.limit(page.limite + 1);
      if (error) throw normalizarErro(error);

      const linhas = (data ?? []) as unknown as LinhaDemanda[];
      const temMais = linhas.length > page.limite;
      const itens = linhas.slice(0, page.limite).map(paraResumo);
      const proximoCursor = temMais ? (itens[itens.length - 1]?.createdAt ?? null) : null;
      return { itens, proximoCursor };
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async obter(id: string): Promise<DemandaDetalhe> {
    try {
      const { data, error } = await supabase
        .from("demandas_servico")
        .select(SELECT_DETALHE)
        .eq("id", id)
        .single();
      if (error) throw normalizarErro(error);
      const l = data as unknown as LinhaDemanda;
      return {
        ...paraResumo(l),
        enderecoCompleto: l.endereco_completo,
        dataDesejada: l.data_desejada,
        clienteNome: l.perfis_publicos?.nome ?? null,
      };
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async criar(dados: NovaDemanda) {
    try {
      const row: Database["public"]["Tables"]["demandas_servico"]["Insert"] = {
        cliente_id: dados.clienteId,
        categoria_id: dados.categoriaId,
        titulo: dados.titulo,
        descricao: dados.descricao,
        orcamento_maximo: dados.orcamentoMaximo,
        urgencia: dados.urgencia,
        endereco_cidade: dados.enderecoCidade,
        endereco_bairro: dados.enderecoBairro,
        endereco_completo: dados.enderecoCompleto,
        data_desejada: dados.dataDesejada,
      };
      const { data, error } = await supabase
        .from("demandas_servico")
        .insert(row)
        .select("id")
        .single();
      if (error) throw normalizarErro(error);
      return { id: (data as { id: string }).id };
    } catch (e) {
      throw normalizarErro(e);
    }
  },
};
```

> **Nota de implementação (join com nome de FK):** `perfis_publicos:demandas_servico_cliente_id_fkey(nome)` desambigua a FK que aponta tanto para `usuarios` quanto para `perfis_publicos` no `db-types`. Se o `supabase-js` reclamar do embed, trocar por duas queries: `obter` busca a demanda e depois `supabase.from('perfis_publicos').select('nome').eq('usuario_id', l.cliente_id).single()`. Registrar o desvio no relatório.

- [ ] **Step 6: Adicionar `demandas` ao barrel** (`repositories/index.ts` — mesmo padrão da Task 3, adiciona `import { demandasRepositorySupabase }` + `demandas: demandasRepositorySupabase` + `export type { DemandasRepository }`).

- [ ] **Step 7: Rodar — PASSA. Typecheck. Commit**

Run: `pnpm --filter @servico-feito/mobile test demandasRepository` → PASS (7 testes).
Run: `pnpm --filter @servico-feito/mobile exec tsc --noEmit` → exit 0.

```bash
git add apps/mobile/src/features/demandas/types apps/mobile/src/shared/api/repositories
git commit -m "feat(mobile): repository demandas (listar abertas keyset + obter + criar)"
```

---

## Task 5: Repository `prestadores`

**Files:**
- Create: `apps/mobile/src/features/prestadores/types/prestador.types.ts`
- Create: `apps/mobile/src/shared/api/repositories/prestadores/prestadoresRepository.ts`
- Create: `apps/mobile/src/shared/api/repositories/prestadores/prestadoresRepository.supabase.ts`
- Create: `apps/mobile/src/shared/api/repositories/prestadores/prestadoresRepository.supabase.test.ts`
- Modify: `apps/mobile/src/shared/api/repositories/index.ts`

**Interfaces:**
- Consumes: `normalizarErro`, `PageParams`, `Pagina`, `supabase`, `Database`, `Categoria` (Task 2).
- Produces:
  - `interface PrestadorResumo { usuarioId: string; nome: string | null; cidade: string | null; bairro: string | null; tituloProfissional: string | null; precoBase: number | null; rating: number | null; totalAvaliacoes: number | null; verificado: boolean; disponivel: boolean; fotoPerfilUrl: string | null; avatarCorHex: string | null }`
  - `interface ItemPortfolio { id: string; urlMedia: string }`
  - `interface DisponibilidadeSemana { dom: boolean; seg: boolean; ter: boolean; qua: boolean; qui: boolean; sex: boolean; sab: boolean }`
  - `interface PrestadorPerfil extends PrestadorResumo { bio: string | null; raioKm: number | null; totalServicos: number | null; categorias: Categoria[]; portfolio: ItemPortfolio[]; disponibilidade: DisponibilidadeSemana | null }`
  - `interface FiltrosPrestador { cidade?: string }`
  - `interface PrestadoresRepository { listarPorCategoria(categoriaId: string, filtros: FiltrosPrestador, page: PageParams): Promise<Pagina<PrestadorResumo>>; buscar(termo: string, filtros: FiltrosPrestador, page: PageParams): Promise<Pagina<PrestadorResumo>>; obterPerfil(usuarioId: string): Promise<PrestadorPerfil> }`
  - `repositories.prestadores: PrestadoresRepository`

- [ ] **Step 1: Escrever `prestador.types.ts`**

```ts
import type { Categoria } from "@/features/descoberta/types/descoberta.types";

export interface PrestadorResumo {
  usuarioId: string;
  nome: string | null;
  cidade: string | null;
  bairro: string | null;
  tituloProfissional: string | null;
  precoBase: number | null;
  rating: number | null;
  totalAvaliacoes: number | null;
  verificado: boolean;
  disponivel: boolean;
  fotoPerfilUrl: string | null;
  avatarCorHex: string | null;
}

export interface ItemPortfolio {
  id: string;
  urlMedia: string;
}

export interface DisponibilidadeSemana {
  dom: boolean;
  seg: boolean;
  ter: boolean;
  qua: boolean;
  qui: boolean;
  sex: boolean;
  sab: boolean;
}

export interface PrestadorPerfil extends PrestadorResumo {
  bio: string | null;
  raioKm: number | null;
  totalServicos: number | null;
  categorias: Categoria[];
  portfolio: ItemPortfolio[];
  disponibilidade: DisponibilidadeSemana | null;
}

export interface FiltrosPrestador {
  cidade?: string;
}
```

- [ ] **Step 2: Escrever a interface `prestadoresRepository.ts`**

```ts
import type { PageParams, Pagina } from "@/shared/api/repositories/types";
import type {
  PrestadorResumo,
  PrestadorPerfil,
  FiltrosPrestador,
} from "@/features/prestadores/types/prestador.types";

export interface PrestadoresRepository {
  /** Prestadores de uma categoria. Ordena por rating desc; paginação por OFFSET
   *  (a view perfis_publicos não tem created_at). `page.cursor` = offset serializado. */
  listarPorCategoria(
    categoriaId: string,
    filtros: FiltrosPrestador,
    page: PageParams,
  ): Promise<Pagina<PrestadorResumo>>;
  /** Busca textual (ilike em nome / titulo_profissional). Mesma paginação por offset. */
  buscar(termo: string, filtros: FiltrosPrestador, page: PageParams): Promise<Pagina<PrestadorResumo>>;
  obterPerfil(usuarioId: string): Promise<PrestadorPerfil>;
}
```

- [ ] **Step 3: Escrever o teste `prestadoresRepository.supabase.test.ts`**

```ts
import { prestadoresRepositorySupabase } from "./prestadoresRepository.supabase";

const supa = require("@/shared/api/supabaseClient").supabase;

const PP = {
  usuario_id: "p1", nome: "João", cidade: "Floripa", bairro: "Centro", avatar_cor_hex: "#111",
  foto_perfil_url: null, rating_cliente: null, titulo_profissional: "Pintor", bio: "10 anos",
  preco_base: 80, rating: 4.5, total_avaliacoes: 12, total_servicos: 30, verificado: true,
  disponivel: true, raio_km: 15,
};

function chain(resultadoFinal: { data: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq", "ilike", "order", "range", "in"]) q[m] = jest.fn(() => q);
  q.range = jest.fn().mockResolvedValue(resultadoFinal);
  q.single = jest.fn().mockResolvedValue(resultadoFinal);
  return q;
}

it("listarPorCategoria: join prestador_categoria, order rating desc, range por offset, proximoCursor", async () => {
  // prestador_categoria → ids; perfis_publicos → linhas
  const idsQ = chain({ data: [{ prestador_id: "p1" }, { prestador_id: "p2" }, { prestador_id: "p3" }], error: null });
  const ppQ = chain({ data: [PP, { ...PP, usuario_id: "p2" }], error: null });
  jest.spyOn(supa, "from").mockImplementation((t: string) =>
    (t === "prestador_categoria" ? idsQ : ppQ) as never,
  );

  const r = await prestadoresRepositorySupabase.listarPorCategoria("c1", {}, { limite: 2 });
  expect(idsQ.eq).toHaveBeenCalledWith("categoria_id", "c1");
  expect(ppQ.order).toHaveBeenCalledWith("rating", { ascending: false });
  expect(ppQ.range).toHaveBeenCalledWith(0, 2); // offset 0 .. limite (pega limite+1)
  expect(r.itens.map((p) => p.usuarioId)).toEqual(["p1", "p2"]);
  expect(r.proximoCursor).toBe("2"); // próximo offset
});

it("listarPorCategoria com cursor '20' → range(20, 22)", async () => {
  const idsQ = chain({ data: [{ prestador_id: "p1" }], error: null });
  const ppQ = chain({ data: [], error: null });
  jest.spyOn(supa, "from").mockImplementation((t: string) =>
    (t === "prestador_categoria" ? idsQ : ppQ) as never,
  );
  await prestadoresRepositorySupabase.listarPorCategoria("c1", { cidade: "Floripa" }, { limite: 2, cursor: "20" });
  expect(ppQ.range).toHaveBeenCalledWith(20, 22);
  expect(ppQ.eq).toHaveBeenCalledWith("cidade", "Floripa");
});

it("buscar: ilike em nome, offset, mapeia PrestadorResumo", async () => {
  const ppQ = chain({ data: [PP], error: null });
  jest.spyOn(supa, "from").mockReturnValue(ppQ as never);
  const r = await prestadoresRepositorySupabase.buscar("jo", {}, { limite: 20 });
  expect(supa.from).toHaveBeenCalledWith("perfis_publicos");
  expect(ppQ.ilike).toHaveBeenCalledWith("nome", "%jo%");
  expect(r.itens[0]).toMatchObject({ usuarioId: "p1", nome: "João", tituloProfissional: "Pintor", precoBase: 80 });
  expect(r.proximoCursor).toBeNull();
});

it("obterPerfil agrega perfil + categorias + portfolio + disponibilidade", async () => {
  const ppQ = chain({ data: PP, error: null });
  const pcQ = chain({
    data: [{ categoria_servico: { id: "c1", nome: "Pintor", descricao: null, icone_key: "brush", popular: false, preco_medio_hora: 60 } }],
    error: null,
  });
  const portQ = chain({ data: [{ id: "m1", url_media: "http://x/1.jpg" }], error: null });
  const dispQ = chain({ data: { dom: false, seg: true, ter: true, qua: true, qui: true, sex: true, sab: false }, error: null });
  jest.spyOn(supa, "from").mockImplementation((t: string) => {
    if (t === "perfis_publicos") return ppQ as never;
    if (t === "prestador_categoria") return pcQ as never;
    if (t === "portfolio_prestador") return portQ as never;
    return dispQ as never; // disponibilidade_prestador
  });

  const perfil = await prestadoresRepositorySupabase.obterPerfil("p1");
  expect(perfil.usuarioId).toBe("p1");
  expect(perfil.categorias).toEqual([
    { id: "c1", nome: "Pintor", descricao: null, iconeKey: "brush", popular: false, precoMedioHora: 60 },
  ]);
  expect(perfil.portfolio).toEqual([{ id: "m1", urlMedia: "http://x/1.jpg" }]);
  expect(perfil.disponibilidade).toEqual({ dom: false, seg: true, ter: true, qua: true, qui: true, sex: true, sab: false });
});

it("obterPerfil: disponibilidade ausente (PGRST116) vira null, não quebra", async () => {
  const ppQ = chain({ data: PP, error: null });
  const pcQ = chain({ data: [], error: null });
  const portQ = chain({ data: [], error: null });
  const dispQ = chain({ data: null, error: { code: "PGRST116", message: "0 rows" } });
  jest.spyOn(supa, "from").mockImplementation((t: string) => {
    if (t === "perfis_publicos") return ppQ as never;
    if (t === "prestador_categoria") return pcQ as never;
    if (t === "portfolio_prestador") return portQ as never;
    return dispQ as never;
  });
  const perfil = await prestadoresRepositorySupabase.obterPerfil("p1");
  expect(perfil.disponibilidade).toBeNull();
  expect(perfil.categorias).toEqual([]);
  expect(perfil.portfolio).toEqual([]);
});
```

- [ ] **Step 4: Rodar — FALHA.**

- [ ] **Step 5: Escrever `prestadoresRepository.supabase.ts`**

```ts
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
      const l = perfilRes.data as LinhaPP & {
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
```

> **Nota de implementação:** `paginarPP` recebe um builder já parcialmente encadeado; se a tipagem do `supabase-js` reclamar do retorno de `baseQuery()` mutado por `.in()/.eq()/.ilike()`, extrair para `let q = supabase.from(...).select(...).order(...); if (...) q = q.xxx()` inline dentro de cada método em vez do helper. Comportamento e testes iguais. Registrar o desvio.

- [ ] **Step 6: Adicionar `prestadores` ao barrel** (mesmo padrão).

- [ ] **Step 7: Rodar — PASSA. Typecheck. Commit**

Run: `pnpm --filter @servico-feito/mobile test prestadoresRepository` → PASS (5 testes).
Run: `pnpm --filter @servico-feito/mobile exec tsc --noEmit` → exit 0.

```bash
git add apps/mobile/src/features/prestadores/types apps/mobile/src/shared/api/repositories
git commit -m "feat(mobile): repository prestadores (por categoria, busca, perfil agregado)"
```

---

## Task 6: Util `useDebounce`

**Files:**
- Create: `apps/mobile/src/shared/lib/useDebounce.ts`
- Create: `apps/mobile/src/shared/lib/useDebounce.test.ts`

**Interfaces:**
- Produces: `function useDebounce<T>(valor: T, ms: number): T`

- [ ] **Step 1: Escrever o teste `useDebounce.test.ts`**

```ts
import { renderHook, act } from "@testing-library/react-native";
import { useDebounce } from "./useDebounce";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it("devolve o valor inicial de imediato", () => {
  const { result } = renderHook(() => useDebounce("a", 300));
  expect(result.current).toBe("a");
});

it("só atualiza depois de `ms` sem novas mudanças", () => {
  const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
    initialProps: { v: "a" },
  });
  rerender({ v: "ab" });
  rerender({ v: "abc" });
  expect(result.current).toBe("a"); // ainda não passou o tempo
  act(() => jest.advanceTimersByTime(299));
  expect(result.current).toBe("a");
  act(() => jest.advanceTimersByTime(1));
  expect(result.current).toBe("abc"); // último valor
});
```

- [ ] **Step 2: Rodar — FALHA** (`Cannot find module './useDebounce'`).

- [ ] **Step 3: Escrever `useDebounce.ts`**

```ts
import { useEffect, useState } from "react";

export function useDebounce<T>(valor: T, ms: number): T {
  const [debounced, setDebounced] = useState(valor);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(valor), ms);
    return () => clearTimeout(id);
  }, [valor, ms]);
  return debounced;
}
```

- [ ] **Step 4: Rodar — PASSA (2 testes).**

- [ ] **Step 5: Typecheck + commit**

```bash
git add apps/mobile/src/shared/lib/useDebounce.ts apps/mobile/src/shared/lib/useDebounce.test.ts
git commit -m "feat(mobile): useDebounce"
```

---

## Task 7: Util `traduzErroRepo`

**Files:**
- Create: `apps/mobile/src/shared/lib/traduzErroRepo.ts`
- Create: `apps/mobile/src/shared/lib/traduzErroRepo.test.ts`

**Interfaces:**
- Consumes: `RepoError`, `CodigoRepo` de `@/shared/api/repositories`.
- Produces: `function traduzErroRepo(e: unknown): string`

- [ ] **Step 1: Escrever o teste `traduzErroRepo.test.ts`**

```ts
import { RepoError } from "@/shared/api/repositories";
import { traduzErroRepo } from "./traduzErroRepo";

it("mapeia cada code para uma string PT", () => {
  expect(traduzErroRepo(new RepoError("rede", "x"))).toMatch(/conexão/i);
  expect(traduzErroRepo(new RepoError("nao_autorizado", "x"))).toMatch(/acesso/i);
  expect(traduzErroRepo(new RepoError("nao_encontrado", "x"))).toMatch(/encontr/i);
  expect(traduzErroRepo(new RepoError("nao_autenticado", "x"))).toMatch(/sessão/i);
  expect(traduzErroRepo(new RepoError("conflito", "x"))).toMatch(/já existe/i);
  expect(traduzErroRepo(new RepoError("validacao", "x"))).toMatch(/inválid/i);
  expect(traduzErroRepo(new RepoError("desconhecido", "x"))).toMatch(/errado/i);
});

it("erro que não é RepoError cai no default", () => {
  expect(traduzErroRepo(new Error("boom"))).toMatch(/errado/i);
  expect(traduzErroRepo(null)).toMatch(/errado/i);
});
```

- [ ] **Step 2: Rodar — FALHA.**

- [ ] **Step 3: Escrever `traduzErroRepo.ts`**

```ts
import { RepoError, type CodigoRepo } from "@/shared/api/repositories";

const TEXTO: Record<CodigoRepo, string> = {
  rede: "Sem conexão. Verifique a internet e tente de novo.",
  nao_autorizado: "Você não tem acesso a isso.",
  nao_encontrado: "Não encontramos o que você procurava.",
  nao_autenticado: "Sua sessão expirou. Entre de novo.",
  conflito: "Isso já existe.",
  validacao: "Dados inválidos. Revise e tente de novo.",
  desconhecido: "Algo deu errado. Tente de novo.",
};

export function traduzErroRepo(e: unknown): string {
  if (e instanceof RepoError) return TEXTO[e.code];
  return TEXTO.desconhecido;
}
```

- [ ] **Step 4: Rodar — PASSA (2 testes).**

- [ ] **Step 5: Typecheck + commit**

```bash
git add apps/mobile/src/shared/lib/traduzErroRepo.ts apps/mobile/src/shared/lib/traduzErroRepo.test.ts
git commit -m "feat(mobile): traduzErroRepo (RepoError → PT)"
```

---

## Task 8: Hook `useCategorias`

**Files:**
- Create: `apps/mobile/src/features/descoberta/hooks/useCategorias.ts`
- Create: `apps/mobile/src/features/descoberta/hooks/useCategorias.test.tsx`

**Interfaces:**
- Consumes: `repositories.categorias.listar()` (Task 2); `Categoria` (Task 2).
- Produces: `function useCategorias()` → `UseQueryResult<Categoria[]>` com `queryKey ['categorias','listar']`, `staleTime` 5 min.

- [ ] **Step 1: Escrever o teste `useCategorias.test.tsx`**

```ts
import { renderHook, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";

jest.mock("@/shared/api/repositories", () => ({
  repositories: { categorias: { listar: jest.fn() } },
}));

import { repositories } from "@/shared/api/repositories";
import { useCategorias } from "./useCategorias";

const wrapper = criarWrapperQuery();

it("chama repositories.categorias.listar e devolve os dados", async () => {
  (repositories.categorias.listar as jest.Mock).mockResolvedValue([
    { id: "c1", nome: "Diarista", descricao: null, iconeKey: "broom", popular: true, precoMedioHora: 50 },
  ]);
  const { result } = renderHook(() => useCategorias(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.categorias.listar).toHaveBeenCalled();
  expect(result.current.data?.[0]?.nome).toBe("Diarista");
});
```

- [ ] **Step 2: Rodar — FALHA.**

- [ ] **Step 3: Escrever `useCategorias.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import type { Categoria } from "@/features/descoberta/types/descoberta.types";

export function useCategorias() {
  return useQuery<Categoria[]>({
    queryKey: ["categorias", "listar"],
    staleTime: 5 * 60_000,
    queryFn: () => repositories.categorias.listar(),
  });
}
```

- [ ] **Step 4: Rodar — PASSA. Typecheck.**

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/descoberta/hooks/useCategorias.ts apps/mobile/src/features/descoberta/hooks/useCategorias.test.tsx
git commit -m "feat(mobile): hook useCategorias"
```

---

## Task 9: Hooks `usePrestadoresPorCategoria` + `useBuscarPrestadores`

**Files:**
- Create: `apps/mobile/src/features/descoberta/hooks/usePrestadoresPorCategoria.ts`
- Create: `apps/mobile/src/features/descoberta/hooks/useBuscarPrestadores.ts`
- Create: `apps/mobile/src/features/descoberta/hooks/usePrestadoresInfinite.test.tsx`

**Interfaces:**
- Consumes: `repositories.prestadores` (Task 5); `PrestadorResumo`, `FiltrosPrestador` (Task 5); `Pagina` (Task 1).
- Produces:
  - `function usePrestadoresPorCategoria(categoriaId: string, filtros: FiltrosPrestador)` → `UseInfiniteQueryResult<InfiniteData<Pagina<PrestadorResumo>>>`, `queryKey ['prestadores','porCategoria',categoriaId,filtros]`.
  - `function useBuscarPrestadores(termo: string, filtros: FiltrosPrestador)` → idem, `queryKey ['prestadores','buscar',termo,filtros]`, `enabled: termo.trim().length >= 2`.
  - Convenção compartilhada: `LIMITE_PAGINA = 20`; `getNextPageParam: (ultima) => ultima.proximoCursor ?? undefined`; `initialPageParam: undefined`.

- [ ] **Step 1: Escrever o teste `usePrestadoresInfinite.test.tsx`**

```ts
import { renderHook, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";

jest.mock("@/shared/api/repositories", () => ({
  repositories: { prestadores: { listarPorCategoria: jest.fn(), buscar: jest.fn() } },
}));

import { repositories } from "@/shared/api/repositories";
import { usePrestadoresPorCategoria } from "./usePrestadoresPorCategoria";
import { useBuscarPrestadores } from "./useBuscarPrestadores";

const wrapper = criarWrapperQuery();
const pagina = (ids: string[], prox: string | null) => ({
  itens: ids.map((id) => ({ usuarioId: id, nome: id, cidade: null, bairro: null, tituloProfissional: null, precoBase: null, rating: null, totalAvaliacoes: null, verificado: false, disponivel: false, fotoPerfilUrl: null, avatarCorHex: null })),
  proximoCursor: prox,
});

it("usePrestadoresPorCategoria busca a 1ª página e expõe hasNextPage pelo proximoCursor", async () => {
  (repositories.prestadores.listarPorCategoria as jest.Mock).mockResolvedValue(pagina(["p1", "p2"], "2"));
  const { result } = renderHook(() => usePrestadoresPorCategoria("c1", {}), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.prestadores.listarPorCategoria).toHaveBeenCalledWith("c1", {}, { limite: 20, cursor: undefined });
  expect(result.current.hasNextPage).toBe(true);
});

it("fetchNextPage passa o proximoCursor como cursor", async () => {
  (repositories.prestadores.listarPorCategoria as jest.Mock)
    .mockResolvedValueOnce(pagina(["p1"], "20"))
    .mockResolvedValueOnce(pagina(["p2"], null));
  const { result } = renderHook(() => usePrestadoresPorCategoria("c1", {}), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  await result.current.fetchNextPage();
  await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
  expect((repositories.prestadores.listarPorCategoria as jest.Mock).mock.calls[1][2]).toEqual({ limite: 20, cursor: "20" });
  expect(result.current.hasNextPage).toBe(false);
});

it("useBuscarPrestadores fica disabled com termo < 2 chars", async () => {
  const { result } = renderHook(() => useBuscarPrestadores("a", {}), { wrapper });
  expect(result.current.fetchStatus).toBe("idle");
  expect(repositories.prestadores.buscar).not.toHaveBeenCalled();
});

it("useBuscarPrestadores dispara com termo >= 2 chars", async () => {
  (repositories.prestadores.buscar as jest.Mock).mockResolvedValue(pagina(["p1"], null));
  const { result } = renderHook(() => useBuscarPrestadores("jo", { cidade: "Floripa" }), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.prestadores.buscar).toHaveBeenCalledWith("jo", { cidade: "Floripa" }, { limite: 20, cursor: undefined });
});
```

- [ ] **Step 2: Rodar — FALHA.**

- [ ] **Step 3: Escrever `usePrestadoresPorCategoria.ts`**

```ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import type { Pagina } from "@/shared/api/repositories";
import type {
  PrestadorResumo,
  FiltrosPrestador,
} from "@/features/prestadores/types/prestador.types";

export const LIMITE_PAGINA = 20;

export function usePrestadoresPorCategoria(categoriaId: string, filtros: FiltrosPrestador) {
  return useInfiniteQuery<Pagina<PrestadorResumo>>({
    queryKey: ["prestadores", "porCategoria", categoriaId, filtros],
    enabled: !!categoriaId,
    initialPageParam: undefined,
    queryFn: ({ pageParam }) =>
      repositories.prestadores.listarPorCategoria(categoriaId, filtros, {
        limite: LIMITE_PAGINA,
        cursor: pageParam as string | undefined,
      }),
    getNextPageParam: (ultima) => ultima.proximoCursor ?? undefined,
  });
}
```

- [ ] **Step 4: Escrever `useBuscarPrestadores.ts`**

```ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import type { Pagina } from "@/shared/api/repositories";
import type {
  PrestadorResumo,
  FiltrosPrestador,
} from "@/features/prestadores/types/prestador.types";
import { LIMITE_PAGINA } from "./usePrestadoresPorCategoria";

export function useBuscarPrestadores(termo: string, filtros: FiltrosPrestador) {
  return useInfiniteQuery<Pagina<PrestadorResumo>>({
    queryKey: ["prestadores", "buscar", termo, filtros],
    enabled: termo.trim().length >= 2,
    initialPageParam: undefined,
    queryFn: ({ pageParam }) =>
      repositories.prestadores.buscar(termo, filtros, {
        limite: LIMITE_PAGINA,
        cursor: pageParam as string | undefined,
      }),
    getNextPageParam: (ultima) => ultima.proximoCursor ?? undefined,
  });
}
```

- [ ] **Step 5: Rodar — PASSA (4 testes). Typecheck.**

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/descoberta/hooks
git commit -m "feat(mobile): hooks infinite de prestadores (por categoria + busca)"
```

---

## Task 10: Hook `usePrestadorPerfil`

**Files:**
- Create: `apps/mobile/src/features/prestadores/hooks/usePrestadorPerfil.ts`
- Create: `apps/mobile/src/features/prestadores/hooks/usePrestadorPerfil.test.tsx`

**Interfaces:**
- Consumes: `repositories.prestadores.obterPerfil` (Task 5); `PrestadorPerfil` (Task 5).
- Produces: `function usePrestadorPerfil(usuarioId: string)` → `UseQueryResult<PrestadorPerfil>`, `queryKey ['prestadores','perfil',usuarioId]`, `enabled: !!usuarioId`.

- [ ] **Step 1: Escrever o teste**

```ts
import { renderHook, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";

jest.mock("@/shared/api/repositories", () => ({
  repositories: { prestadores: { obterPerfil: jest.fn() } },
}));

import { repositories } from "@/shared/api/repositories";
import { usePrestadorPerfil } from "./usePrestadorPerfil";

const wrapper = criarWrapperQuery();

it("busca o perfil pelo usuarioId", async () => {
  (repositories.prestadores.obterPerfil as jest.Mock).mockResolvedValue({ usuarioId: "p1", nome: "João", categorias: [], portfolio: [], disponibilidade: null });
  const { result } = renderHook(() => usePrestadorPerfil("p1"), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.prestadores.obterPerfil).toHaveBeenCalledWith("p1");
  expect(result.current.data?.nome).toBe("João");
});

it("disabled quando usuarioId vazio", () => {
  const { result } = renderHook(() => usePrestadorPerfil(""), { wrapper });
  expect(result.current.fetchStatus).toBe("idle");
});
```

- [ ] **Step 2: Rodar — FALHA.**

- [ ] **Step 3: Escrever `usePrestadorPerfil.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import type { PrestadorPerfil } from "@/features/prestadores/types/prestador.types";

export function usePrestadorPerfil(usuarioId: string) {
  return useQuery<PrestadorPerfil>({
    queryKey: ["prestadores", "perfil", usuarioId],
    enabled: !!usuarioId,
    queryFn: () => repositories.prestadores.obterPerfil(usuarioId),
  });
}
```

- [ ] **Step 4: Rodar — PASSA. Typecheck. Commit**

```bash
git add apps/mobile/src/features/prestadores/hooks
git commit -m "feat(mobile): hook usePrestadorPerfil"
```

---

## Task 11: Hooks `useDemandasAbertas` + `useDemanda`

**Files:**
- Create: `apps/mobile/src/features/demandas/hooks/useDemandasAbertas.ts`
- Create: `apps/mobile/src/features/demandas/hooks/useDemanda.ts`
- Create: `apps/mobile/src/features/demandas/hooks/useDemandas.test.tsx`

**Interfaces:**
- Consumes: `repositories.demandas` (Task 4); `DemandaResumo`, `DemandaDetalhe`, `FiltrosDemanda` (Task 4); `Pagina` (Task 1); `LIMITE_PAGINA` (Task 9).
- Produces:
  - `function useDemandasAbertas(filtros: FiltrosDemanda)` → `UseInfiniteQueryResult<InfiniteData<Pagina<DemandaResumo>>>`, `queryKey ['demandas','abertas',filtros]`.
  - `function useDemanda(id: string)` → `UseQueryResult<DemandaDetalhe>`, `queryKey ['demandas','detalhe',id]`, `enabled: !!id`.

- [ ] **Step 1: Escrever o teste `useDemandas.test.tsx`**

```ts
import { renderHook, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";

jest.mock("@/shared/api/repositories", () => ({
  repositories: { demandas: { listarAbertas: jest.fn(), obter: jest.fn() } },
}));

import { repositories } from "@/shared/api/repositories";
import { useDemandasAbertas } from "./useDemandasAbertas";
import { useDemanda } from "./useDemanda";

const wrapper = criarWrapperQuery();

it("useDemandasAbertas passa filtros e pagina por cursor", async () => {
  (repositories.demandas.listarAbertas as jest.Mock)
    .mockResolvedValueOnce({ itens: [{ id: "d1" }], proximoCursor: "2026-03-02T00:00:00Z" })
    .mockResolvedValueOnce({ itens: [{ id: "d2" }], proximoCursor: null });
  const { result } = renderHook(() => useDemandasAbertas({ cidade: "Floripa" }), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.demandas.listarAbertas).toHaveBeenCalledWith({ cidade: "Floripa" }, { limite: 20, cursor: undefined });
  await result.current.fetchNextPage();
  await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
  expect((repositories.demandas.listarAbertas as jest.Mock).mock.calls[1][1]).toEqual({ limite: 20, cursor: "2026-03-02T00:00:00Z" });
  expect(result.current.hasNextPage).toBe(false);
});

it("useDemanda busca o detalhe por id e fica disabled sem id", async () => {
  (repositories.demandas.obter as jest.Mock).mockResolvedValue({ id: "d1", titulo: "Pintar" });
  const vazio = renderHook(() => useDemanda(""), { wrapper });
  expect(vazio.result.current.fetchStatus).toBe("idle");
  const { result } = renderHook(() => useDemanda("d1"), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(repositories.demandas.obter).toHaveBeenCalledWith("d1");
});
```

- [ ] **Step 2: Rodar — FALHA.**

- [ ] **Step 3: Escrever `useDemandasAbertas.ts`**

```ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import type { Pagina } from "@/shared/api/repositories";
import type { DemandaResumo, FiltrosDemanda } from "@/features/demandas/types/demanda.types";
import { LIMITE_PAGINA } from "@/features/descoberta/hooks/usePrestadoresPorCategoria";

export function useDemandasAbertas(filtros: FiltrosDemanda) {
  return useInfiniteQuery<Pagina<DemandaResumo>>({
    queryKey: ["demandas", "abertas", filtros],
    initialPageParam: undefined,
    queryFn: ({ pageParam }) =>
      repositories.demandas.listarAbertas(filtros, {
        limite: LIMITE_PAGINA,
        cursor: pageParam as string | undefined,
      }),
    getNextPageParam: (ultima) => ultima.proximoCursor ?? undefined,
  });
}
```

- [ ] **Step 4: Escrever `useDemanda.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import type { DemandaDetalhe } from "@/features/demandas/types/demanda.types";

export function useDemanda(id: string) {
  return useQuery<DemandaDetalhe>({
    queryKey: ["demandas", "detalhe", id],
    enabled: !!id,
    queryFn: () => repositories.demandas.obter(id),
  });
}
```

- [ ] **Step 5: Rodar — PASSA (2 testes). Typecheck. Commit**

```bash
git add apps/mobile/src/features/demandas/hooks
git commit -m "feat(mobile): hooks useDemandasAbertas (infinite) + useDemanda"
```

---

## Task 12: Hooks `useMeusEnderecos` + `useCriarEndereco`

**Files:**
- Create: `apps/mobile/src/features/enderecos/hooks/useMeusEnderecos.ts`
- Create: `apps/mobile/src/features/enderecos/hooks/useCriarEndereco.ts`
- Create: `apps/mobile/src/features/enderecos/hooks/useEnderecos.test.tsx`

**Interfaces:**
- Consumes: `repositories.enderecos` (Task 3); `Endereco`, `NovoEndereco` (Task 3); `useAuthStore` (`s.usuarioId`); `queryClient` de `@/shared/query/queryClient`.
- Produces:
  - `function useMeusEnderecos()` → `UseQueryResult<Endereco[]>`, `queryKey ['enderecos','meus']`.
  - `function useCriarEndereco()` → `UseMutationResult<Endereco, unknown, Omit<NovoEndereco,'usuarioId'>>`; injeta `usuarioId` do `authStore`; `onSuccess` invalida `['enderecos','meus']`.

- [ ] **Step 1: Escrever o teste `useEnderecos.test.tsx`**

```ts
import { renderHook, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";

jest.mock("@/shared/api/repositories", () => ({
  repositories: { enderecos: { listarMeus: jest.fn(), criar: jest.fn() } },
}));
jest.mock("@/shared/store/authStore", () => ({
  useAuthStore: (sel: (s: { usuarioId: string }) => unknown) => sel({ usuarioId: "u1" }),
}));

import { repositories } from "@/shared/api/repositories";
import { queryClient } from "@/shared/query/queryClient";
import { useMeusEnderecos } from "./useMeusEnderecos";
import { useCriarEndereco } from "./useCriarEndereco";

const wrapper = criarWrapperQuery();

it("useMeusEnderecos lista", async () => {
  (repositories.enderecos.listarMeus as jest.Mock).mockResolvedValue([{ id: "e1", cidade: "Floripa" }]);
  const { result } = renderHook(() => useMeusEnderecos(), { wrapper });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.[0]?.id).toBe("e1");
});

it("useCriarEndereco injeta usuarioId, retorna o novo e invalida ['enderecos','meus']", async () => {
  (repositories.enderecos.criar as jest.Mock).mockResolvedValue({ id: "e9", cidade: "Floripa" });
  const spy = jest.spyOn(queryClient, "invalidateQueries");
  const { result } = renderHook(() => useCriarEndereco(), { wrapper });
  const novo = await result.current.mutateAsync({
    identificacao: "Casa", cep: null, estado: "SC", cidade: "Floripa", bairro: "Centro",
    logradouro: "Rua A", numero: "10", complemento: null, principal: false,
  });
  expect(repositories.enderecos.criar).toHaveBeenCalledWith(expect.objectContaining({ usuarioId: "u1", cidade: "Floripa" }));
  expect(novo).toEqual({ id: "e9", cidade: "Floripa" });
  expect(spy).toHaveBeenCalledWith({ queryKey: ["enderecos", "meus"] });
});
```

- [ ] **Step 2: Rodar — FALHA.**

- [ ] **Step 3: Escrever `useMeusEnderecos.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import type { Endereco } from "@/features/enderecos/types/endereco.types";

export function useMeusEnderecos() {
  return useQuery<Endereco[]>({
    queryKey: ["enderecos", "meus"],
    queryFn: () => repositories.enderecos.listarMeus(),
  });
}
```

- [ ] **Step 4: Escrever `useCriarEndereco.ts`**

```ts
import { useMutation } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import { queryClient } from "@/shared/query/queryClient";
import { useAuthStore } from "@/shared/store/authStore";
import type { Endereco, NovoEndereco } from "@/features/enderecos/types/endereco.types";

export type DadosNovoEndereco = Omit<NovoEndereco, "usuarioId">;

export function useCriarEndereco() {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  return useMutation<Endereco, unknown, DadosNovoEndereco>({
    mutationFn: (dados) => repositories.enderecos.criar({ ...dados, usuarioId: usuarioId ?? "" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enderecos", "meus"] });
    },
  });
}
```

- [ ] **Step 5: Rodar — PASSA (2 testes). Typecheck. Commit**

```bash
git add apps/mobile/src/features/enderecos/hooks
git commit -m "feat(mobile): hooks useMeusEnderecos + useCriarEndereco"
```

---

## Task 13: Hook `useCriarDemanda`

**Files:**
- Create: `apps/mobile/src/features/demandas/hooks/useCriarDemanda.ts`
- Create: `apps/mobile/src/features/demandas/hooks/useCriarDemanda.test.tsx`

**Interfaces:**
- Consumes: `repositories.demandas.criar` (Task 4); `NovaDemanda` (Task 4); `useAuthStore` (`s.usuarioId`); `queryClient`.
- Produces: `function useCriarDemanda()` → `UseMutationResult<{ id: string }, unknown, Omit<NovaDemanda,'clienteId'>>`; injeta `clienteId` do `authStore`; `onSuccess` invalida `['demandas','abertas']`.

- [ ] **Step 1: Escrever o teste `useCriarDemanda.test.tsx`**

```ts
import { renderHook } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";

jest.mock("@/shared/api/repositories", () => ({
  repositories: { demandas: { criar: jest.fn() } },
}));
jest.mock("@/shared/store/authStore", () => ({
  useAuthStore: (sel: (s: { usuarioId: string }) => unknown) => sel({ usuarioId: "u1" }),
}));

import { repositories } from "@/shared/api/repositories";
import { queryClient } from "@/shared/query/queryClient";
import { useCriarDemanda } from "./useCriarDemanda";

const wrapper = criarWrapperQuery();

it("injeta clienteId, chama repo, retorna id e invalida ['demandas','abertas']", async () => {
  (repositories.demandas.criar as jest.Mock).mockResolvedValue({ id: "d9" });
  const spy = jest.spyOn(queryClient, "invalidateQueries");
  const { result } = renderHook(() => useCriarDemanda(), { wrapper });
  const r = await result.current.mutateAsync({
    categoriaId: "c1", titulo: "Pintar", descricao: "sala", orcamentoMaximo: 500, urgencia: "Normal",
    enderecoCidade: "Floripa", enderecoBairro: "Centro", enderecoCompleto: "Rua A, 10", dataDesejada: null,
  });
  expect(repositories.demandas.criar).toHaveBeenCalledWith(expect.objectContaining({ clienteId: "u1", titulo: "Pintar" }));
  expect(r).toEqual({ id: "d9" });
  expect(spy).toHaveBeenCalledWith({ queryKey: ["demandas", "abertas"] });
});
```

- [ ] **Step 2: Rodar — FALHA.**

- [ ] **Step 3: Escrever `useCriarDemanda.ts`**

```ts
import { useMutation } from "@tanstack/react-query";
import { repositories } from "@/shared/api/repositories";
import { queryClient } from "@/shared/query/queryClient";
import { useAuthStore } from "@/shared/store/authStore";
import type { NovaDemanda } from "@/features/demandas/types/demanda.types";

export type DadosNovaDemanda = Omit<NovaDemanda, "clienteId">;

export function useCriarDemanda() {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  return useMutation<{ id: string }, unknown, DadosNovaDemanda>({
    mutationFn: (dados) => repositories.demandas.criar({ ...dados, clienteId: usuarioId ?? "" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demandas", "abertas"] });
    },
  });
}
```

- [ ] **Step 4: Rodar — PASSA. Typecheck. Commit**

```bash
git add apps/mobile/src/features/demandas/hooks/useCriarDemanda.ts apps/mobile/src/features/demandas/hooks/useCriarDemanda.test.tsx
git commit -m "feat(mobile): hook useCriarDemanda"
```

---

## Task 14: Descoberta — cards, `BuscarScreen`, `PrestadoresPorCategoriaScreen`, rotas

**Files:**
- Create: `apps/mobile/src/features/descoberta/components/CategoriaCard.tsx`
- Create: `apps/mobile/src/features/descoberta/components/PrestadorCard.tsx`
- Create: `apps/mobile/src/features/descoberta/screens/BuscarScreen.tsx`
- Create: `apps/mobile/src/features/descoberta/screens/PrestadoresPorCategoriaScreen.tsx`
- Create: `apps/mobile/app/(app)/categoria/[id].tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/buscar.tsx` (re-aponta para a nova screen)
- Delete: `apps/mobile/src/features/shell/screens/BuscarScreen.tsx`

**Interfaces:**
- Consumes: `useCategorias` (Task 8), `usePrestadoresPorCategoria` + `useBuscarPrestadores` (Task 9), `useDebounce` (Task 6), `traduzErroRepo` (Task 7); átomos `CarregandoEstado` / `ErroEstado` / `VazioEstado` (Plano 2); `Categoria`, `PrestadorResumo`.
- Produces: `BuscarScreen` (export nomeado), `PrestadoresPorCategoriaScreen` (export nomeado). Rota `categoria/[id]` lê `id` de `useLocalSearchParams`.

- [ ] **Step 1: Escrever `CategoriaCard.tsx`**

```tsx
import { Pressable, Text, View } from "react-native";
import type { Categoria } from "@/features/descoberta/types/descoberta.types";

export function CategoriaCard({ categoria, onPress }: { categoria: Categoria; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="bg-sf-surface border border-sf-outline rounded-xl px-4 py-3 mb-2"
    >
      <Text className="text-sf-text font-semibold">{categoria.nome}</Text>
      {categoria.descricao ? (
        <Text className="text-sf-body text-sm mt-0.5" numberOfLines={2}>
          {categoria.descricao}
        </Text>
      ) : null}
      <View className="flex-row mt-1">
        <Text className="text-sf-muted text-xs">
          {categoria.precoMedioHora > 0 ? `~ R$ ${categoria.precoMedioHora}/h` : "preço a combinar"}
        </Text>
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 2: Escrever `PrestadorCard.tsx`**

```tsx
import { Pressable, Text, View } from "react-native";
import type { PrestadorResumo } from "@/features/prestadores/types/prestador.types";

export function PrestadorCard({ prestador, onPress }: { prestador: PrestadorResumo; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="bg-sf-surface border border-sf-outline rounded-xl px-4 py-3 mb-2"
    >
      <View className="flex-row justify-between">
        <Text className="text-sf-text font-semibold">{prestador.nome ?? "Prestador"}</Text>
        {prestador.rating != null ? (
          <Text className="text-sf-body text-sm">★ {prestador.rating.toFixed(1)}</Text>
        ) : null}
      </View>
      {prestador.tituloProfissional ? (
        <Text className="text-sf-body text-sm mt-0.5">{prestador.tituloProfissional}</Text>
      ) : null}
      <View className="flex-row justify-between mt-1">
        <Text className="text-sf-muted text-xs">{prestador.cidade ?? ""}</Text>
        {prestador.precoBase != null ? (
          <Text className="text-sf-muted text-xs">a partir de R$ {prestador.precoBase}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 3: Escrever `PrestadoresPorCategoriaScreen.tsx`**

```tsx
import { FlatList, View } from "react-native";
import { router } from "expo-router";
import { usePrestadoresPorCategoria } from "@/features/descoberta/hooks/usePrestadoresPorCategoria";
import { PrestadorCard } from "@/features/descoberta/components/PrestadorCard";
import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";
import { ErroEstado } from "@/shared/components/molecules/ErroEstado";
import { VazioEstado } from "@/shared/components/molecules/VazioEstado";
import { traduzErroRepo } from "@/shared/lib/traduzErroRepo";

export function PrestadoresPorCategoriaScreen({ categoriaId }: { categoriaId: string }) {
  const q = usePrestadoresPorCategoria(categoriaId, {});

  if (q.isLoading) return <CarregandoEstado />;
  if (q.isError) return <ErroEstado mensagem={traduzErroRepo(q.error)} onRetry={() => q.refetch()} />;

  const itens = q.data?.pages.flatMap((p) => p.itens) ?? [];
  if (itens.length === 0) return <VazioEstado mensagem="Nenhum prestador nesta categoria ainda." />;

  return (
    <View className="flex-1 bg-sf-bg px-4 pt-3">
      <FlatList
        data={itens}
        keyExtractor={(p) => p.usuarioId}
        renderItem={({ item }) => (
          <PrestadorCard prestador={item} onPress={() => router.push(`/(app)/prestador/${item.usuarioId}`)} />
        )}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
        }}
      />
    </View>
  );
}
```

- [ ] **Step 4: Escrever `BuscarScreen.tsx`**

```tsx
import { useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import { router } from "expo-router";
import { CampoTexto } from "@/shared/components/atoms/CampoTexto";
import { CategoriaCard } from "@/features/descoberta/components/CategoriaCard";
import { PrestadorCard } from "@/features/descoberta/components/PrestadorCard";
import { useCategorias } from "@/features/descoberta/hooks/useCategorias";
import { useBuscarPrestadores } from "@/features/descoberta/hooks/useBuscarPrestadores";
import { useDebounce } from "@/shared/lib/useDebounce";
import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";
import { ErroEstado } from "@/shared/components/molecules/ErroEstado";
import { VazioEstado } from "@/shared/components/molecules/VazioEstado";
import { traduzErroRepo } from "@/shared/lib/traduzErroRepo";

export function BuscarScreen() {
  const [termo, setTermo] = useState("");
  const [cidade, setCidade] = useState("");
  const termoDebounced = useDebounce(termo.trim(), 300);
  const cidadeDebounced = useDebounce(cidade.trim(), 300);
  const buscando = termoDebounced.length >= 2;

  const cats = useCategorias();
  const busca = useBuscarPrestadores(termoDebounced, cidadeDebounced ? { cidade: cidadeDebounced } : {});

  const catsFiltradas = useMemo(() => {
    const t = termo.trim().toLowerCase();
    const lista = cats.data ?? [];
    return t.length > 0 ? lista.filter((c) => c.nome.toLowerCase().includes(t)) : lista;
  }, [cats.data, termo]);

  return (
    <View className="flex-1 bg-sf-bg px-4 pt-3 gap-2">
      <CampoTexto placeholder="O que você precisa? Ex: diarista, pintor…" value={termo} onChangeText={setTermo} autoCapitalize="none" />
      <CampoTexto placeholder="Cidade (opcional)" value={cidade} onChangeText={setCidade} autoCapitalize="words" />

      {buscando ? (
        busca.isLoading ? (
          <CarregandoEstado />
        ) : busca.isError ? (
          <ErroEstado mensagem={traduzErroRepo(busca.error)} onRetry={() => busca.refetch()} />
        ) : (
          (() => {
            const itens = busca.data?.pages.flatMap((p) => p.itens) ?? [];
            if (itens.length === 0) return <VazioEstado mensagem="Nenhum prestador encontrado." />;
            return (
              <FlatList
                data={itens}
                keyExtractor={(p) => p.usuarioId}
                renderItem={({ item }) => (
                  <PrestadorCard prestador={item} onPress={() => router.push(`/(app)/prestador/${item.usuarioId}`)} />
                )}
                onEndReachedThreshold={0.4}
                onEndReached={() => {
                  if (busca.hasNextPage && !busca.isFetchingNextPage) busca.fetchNextPage();
                }}
              />
            );
          })()
        )
      ) : cats.isLoading ? (
        <CarregandoEstado />
      ) : cats.isError ? (
        <ErroEstado mensagem={traduzErroRepo(cats.error)} onRetry={() => cats.refetch()} />
      ) : (
        <FlatList
          data={catsFiltradas}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <CategoriaCard categoria={item} onPress={() => router.push(`/(app)/categoria/${item.id}`)} />
          )}
        />
      )}
    </View>
  );
}
```

- [ ] **Step 5: Escrever a rota `app/(app)/categoria/[id].tsx`**

```tsx
import { useLocalSearchParams } from "expo-router";
import { PrestadoresPorCategoriaScreen } from "@/features/descoberta/screens/PrestadoresPorCategoriaScreen";

export default function CategoriaRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PrestadoresPorCategoriaScreen categoriaId={id ?? ""} />;
}
```

- [ ] **Step 6: Re-apontar `app/(app)/(tabs)/buscar.tsx`**

```tsx
import { BuscarScreen } from "@/features/descoberta/screens/BuscarScreen";
export default function BuscarRoute() {
  return <BuscarScreen />;
}
```

- [ ] **Step 7: Deletar o stub antigo**

```bash
git rm apps/mobile/src/features/shell/screens/BuscarScreen.tsx
```

- [ ] **Step 8: Gates + commit**

Run: `pnpm --filter @servico-feito/mobile exec tsc --noEmit` → 0.
Run: `pnpm --filter @servico-feito/mobile test` → verde, auto-encerrando.
Run: `pnpm --filter @servico-feito/mobile lint` → 0.

```bash
git add apps/mobile/src/features/descoberta "apps/mobile/app/(app)/categoria" "apps/mobile/app/(app)/(tabs)/buscar.tsx"
git commit -m "feat(mobile): descoberta — Buscar (categorias/prestadores) + lista por categoria"
```

---

## Task 15: Perfil do prestador — `PortfolioGaleria`, `DisponibilidadeChips`, `PrestadorPerfilScreen`, rota

**Files:**
- Create: `apps/mobile/src/features/prestadores/components/PortfolioGaleria.tsx`
- Create: `apps/mobile/src/features/prestadores/components/DisponibilidadeChips.tsx`
- Create: `apps/mobile/src/features/prestadores/screens/PrestadorPerfilScreen.tsx`
- Create: `apps/mobile/app/(app)/prestador/[id].tsx`

**Interfaces:**
- Consumes: `usePrestadorPerfil` (Task 10), `traduzErroRepo`, `CarregandoEstado`/`ErroEstado`; `PrestadorPerfil`, `ItemPortfolio`, `DisponibilidadeSemana`.
- Produces: `PrestadorPerfilScreen` (export nomeado). Rota lê `id` de `useLocalSearchParams`.

- [ ] **Step 1: Escrever `DisponibilidadeChips.tsx`**

```tsx
import { Text, View } from "react-native";
import type { DisponibilidadeSemana } from "@/features/prestadores/types/prestador.types";

const DIAS: { chave: keyof DisponibilidadeSemana; rotulo: string }[] = [
  { chave: "seg", rotulo: "Seg" },
  { chave: "ter", rotulo: "Ter" },
  { chave: "qua", rotulo: "Qua" },
  { chave: "qui", rotulo: "Qui" },
  { chave: "sex", rotulo: "Sex" },
  { chave: "sab", rotulo: "Sáb" },
  { chave: "dom", rotulo: "Dom" },
];

export function DisponibilidadeChips({ disponibilidade }: { disponibilidade: DisponibilidadeSemana }) {
  return (
    <View className="flex-row flex-wrap gap-1">
      {DIAS.map(({ chave, rotulo }) => (
        <View
          key={chave}
          className={`px-2 py-1 rounded-full border ${
            disponibilidade[chave] ? "bg-sf-surface-variant border-sf-primary" : "border-sf-outline"
          }`}
        >
          <Text className={disponibilidade[chave] ? "text-sf-dark-green text-xs" : "text-sf-muted text-xs"}>
            {rotulo}
          </Text>
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Escrever `PortfolioGaleria.tsx`**

```tsx
import { Image, ScrollView } from "react-native";
import type { ItemPortfolio } from "@/features/prestadores/types/prestador.types";

export function PortfolioGaleria({ itens }: { itens: ItemPortfolio[] }) {
  if (itens.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
      {itens.map((i) => (
        <Image
          key={i.id}
          source={{ uri: i.urlMedia }}
          className="w-32 h-32 rounded-lg mx-1 bg-sf-surface-variant"
          resizeMode="cover"
        />
      ))}
    </ScrollView>
  );
}
```

- [ ] **Step 3: Escrever `PrestadorPerfilScreen.tsx`**

```tsx
import { ScrollView, Text, View } from "react-native";
import { usePrestadorPerfil } from "@/features/prestadores/hooks/usePrestadorPerfil";
import { PortfolioGaleria } from "@/features/prestadores/components/PortfolioGaleria";
import { DisponibilidadeChips } from "@/features/prestadores/components/DisponibilidadeChips";
import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";
import { ErroEstado } from "@/shared/components/molecules/ErroEstado";
import { traduzErroRepo } from "@/shared/lib/traduzErroRepo";

export function PrestadorPerfilScreen({ usuarioId }: { usuarioId: string }) {
  const q = usePrestadorPerfil(usuarioId);

  if (q.isLoading) return <CarregandoEstado />;
  if (q.isError || !q.data) return <ErroEstado mensagem={traduzErroRepo(q.error)} onRetry={() => q.refetch()} />;

  const p = q.data;
  return (
    <ScrollView className="flex-1 bg-sf-bg px-4 pt-4">
      <Text className="text-2xl font-bold text-sf-text">{p.nome ?? "Prestador"}</Text>
      {p.tituloProfissional ? <Text className="text-sf-body mt-0.5">{p.tituloProfissional}</Text> : null}
      <View className="flex-row gap-3 mt-1">
        {p.rating != null ? <Text className="text-sf-body text-sm">★ {p.rating.toFixed(1)} ({p.totalAvaliacoes ?? 0})</Text> : null}
        {p.cidade ? <Text className="text-sf-muted text-sm">{p.cidade}</Text> : null}
      </View>

      {p.bio ? <Text className="text-sf-body mt-3">{p.bio}</Text> : null}

      {p.precoBase != null ? (
        <Text className="text-sf-text font-semibold mt-3">A partir de R$ {p.precoBase}</Text>
      ) : null}

      {p.categorias.length > 0 ? (
        <View className="mt-3">
          <Text className="text-sf-text font-semibold mb-1">Categorias</Text>
          <View className="flex-row flex-wrap gap-1">
            {p.categorias.map((c) => (
              <View key={c.id} className="px-2 py-1 rounded-full bg-sf-surface-variant">
                <Text className="text-sf-dark-green text-xs">{c.nome}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {p.disponibilidade ? (
        <View className="mt-3">
          <Text className="text-sf-text font-semibold mb-1">Disponibilidade</Text>
          <DisponibilidadeChips disponibilidade={p.disponibilidade} />
        </View>
      ) : null}

      {p.portfolio.length > 0 ? (
        <View className="mt-3 mb-8">
          <Text className="text-sf-text font-semibold mb-1">Portfólio</Text>
          <PortfolioGaleria itens={p.portfolio} />
        </View>
      ) : (
        <View className="mb-8" />
      )}
    </ScrollView>
  );
}
```

- [ ] **Step 4: Escrever a rota `app/(app)/prestador/[id].tsx`**

```tsx
import { useLocalSearchParams } from "expo-router";
import { PrestadorPerfilScreen } from "@/features/prestadores/screens/PrestadorPerfilScreen";

export default function PrestadorRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PrestadorPerfilScreen usuarioId={id ?? ""} />;
}
```

- [ ] **Step 5: Gates + commit**

Run: tsc 0 · test verde · lint 0.

```bash
git add apps/mobile/src/features/prestadores "apps/mobile/app/(app)/prestador"
git commit -m "feat(mobile): tela de perfil público do prestador"
```

---

## Task 16: Criar demanda — `FormEndereco`, `SeletorEndereco`, `SeletorCategoria`, `CriarDemandaScreen`, rota

**Files:**
- Create: `apps/mobile/src/features/enderecos/components/FormEndereco.tsx`
- Create: `apps/mobile/src/features/demandas/components/SeletorEndereco.tsx`
- Create: `apps/mobile/src/features/demandas/components/SeletorEndereco.test.tsx`
- Create: `apps/mobile/src/features/demandas/components/SeletorCategoria.tsx`
- Create: `apps/mobile/src/features/demandas/screens/CriarDemandaScreen.tsx`
- Create: `apps/mobile/src/features/demandas/screens/CriarDemandaScreen.test.tsx`
- Create: `apps/mobile/app/(app)/criar-demanda.tsx`

**Interfaces:**
- Consumes: `useMeusEnderecos` + `useCriarEndereco` (Task 12), `useCategorias` (Task 8), `useCriarDemanda` (Task 13), `formatarEndereco` (Task 3), átomos `Botao`/`CampoTexto`; `Endereco`, `DadosNovaDemanda`.
- Produces: `SeletorEndereco` (`{ enderecoSelecionado: Endereco | null; onSelecionar: (e: Endereco) => void }`), `SeletorCategoria` (`{ categoriaId: string | null; onSelecionar: (id: string) => void }`), `FormEndereco` (`{ onCriar: (dados: DadosNovoEndereco) => void; enviando: boolean }`), `CriarDemandaScreen` (export nomeado).

- [ ] **Step 1: Escrever `FormEndereco.tsx`**

```tsx
import { useState } from "react";
import { View } from "react-native";
import { CampoTexto } from "@/shared/components/atoms/CampoTexto";
import { Botao } from "@/shared/components/atoms/Botao";
import type { DadosNovoEndereco } from "@/features/enderecos/hooks/useCriarEndereco";

export function FormEndereco({
  onCriar,
  enviando,
}: {
  onCriar: (dados: DadosNovoEndereco) => void;
  enviando: boolean;
}) {
  const [identificacao, setIdentificacao] = useState("");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const ok = cidade.trim().length > 0 && !enviando;

  return (
    <View className="gap-2 mt-2">
      <CampoTexto placeholder="Identificação (ex: Casa)" value={identificacao} onChangeText={setIdentificacao} />
      <CampoTexto placeholder="Cidade *" value={cidade} onChangeText={setCidade} autoCapitalize="words" />
      <CampoTexto placeholder="Bairro" value={bairro} onChangeText={setBairro} />
      <CampoTexto placeholder="Logradouro" value={logradouro} onChangeText={setLogradouro} />
      <CampoTexto placeholder="Número" value={numero} onChangeText={setNumero} keyboardType="numbers-and-punctuation" />
      <CampoTexto placeholder="Complemento" value={complemento} onChangeText={setComplemento} />
      <Botao
        titulo="Salvar endereço"
        desabilitado={!ok}
        carregando={enviando}
        onPress={() =>
          onCriar({
            identificacao: identificacao.trim() || null,
            cep: null,
            estado: null,
            cidade: cidade.trim(),
            bairro: bairro.trim() || null,
            logradouro: logradouro.trim() || null,
            numero: numero.trim() || null,
            complemento: complemento.trim() || null,
            principal: false,
          })
        }
      />
    </View>
  );
}
```

- [ ] **Step 2: Escrever o teste `SeletorEndereco.test.tsx`**

```tsx
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";

jest.mock("@/shared/api/repositories", () => ({
  repositories: { enderecos: { listarMeus: jest.fn(), criar: jest.fn() } },
}));
jest.mock("@/shared/store/authStore", () => ({
  useAuthStore: (sel: (s: { usuarioId: string }) => unknown) => sel({ usuarioId: "u1" }),
}));

import { repositories } from "@/shared/api/repositories";
import { SeletorEndereco } from "./SeletorEndereco";

const Wrapper = criarWrapperQuery();
const renderCom = (ui: React.ReactElement) => render(ui, { wrapper: Wrapper });

it("lista os endereços e seleciona ao tocar", async () => {
  (repositories.enderecos.listarMeus as jest.Mock).mockResolvedValue([
    { id: "e1", identificacao: "Casa", cidade: "Floripa", bairro: "Centro", logradouro: "Rua A", numero: "10", complemento: null, cep: null, estado: null, principal: false },
  ]);
  const onSelecionar = jest.fn();
  const { getByText } = renderCom(<SeletorEndereco enderecoSelecionado={null} onSelecionar={onSelecionar} />);
  await waitFor(() => getByText(/Casa/));
  fireEvent.press(getByText(/Casa/));
  expect(onSelecionar).toHaveBeenCalledWith(expect.objectContaining({ id: "e1" }));
});

it("'adicionar novo' mostra o FormEndereco; ao criar, seleciona o novo", async () => {
  (repositories.enderecos.listarMeus as jest.Mock).mockResolvedValue([]);
  (repositories.enderecos.criar as jest.Mock).mockResolvedValue({ id: "e9", identificacao: "Novo", cidade: "Floripa", bairro: null, logradouro: null, numero: null, complemento: null, cep: null, estado: null, principal: false });
  const onSelecionar = jest.fn();
  const { getByText, getByPlaceholderText } = renderCom(<SeletorEndereco enderecoSelecionado={null} onSelecionar={onSelecionar} />);
  await waitFor(() => getByText(/Adicionar endereço/i));
  fireEvent.press(getByText(/Adicionar endereço/i));
  fireEvent.changeText(getByPlaceholderText(/Cidade/), "Floripa");
  fireEvent.press(getByText(/Salvar endereço/i));
  await waitFor(() => expect(onSelecionar).toHaveBeenCalledWith(expect.objectContaining({ id: "e9" })));
});
```

- [ ] **Step 3: Rodar — FALHA.**

- [ ] **Step 4: Escrever `SeletorEndereco.tsx`**

```tsx
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useMeusEnderecos } from "@/features/enderecos/hooks/useMeusEnderecos";
import { useCriarEndereco } from "@/features/enderecos/hooks/useCriarEndereco";
import { FormEndereco } from "@/features/enderecos/components/FormEndereco";
import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";
import type { Endereco } from "@/features/enderecos/types/endereco.types";

export function SeletorEndereco({
  enderecoSelecionado,
  onSelecionar,
}: {
  enderecoSelecionado: Endereco | null;
  onSelecionar: (e: Endereco) => void;
}) {
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const lista = useMeusEnderecos();
  const criar = useCriarEndereco();

  if (lista.isLoading) return <CarregandoEstado />;

  return (
    <View className="gap-2">
      {(lista.data ?? []).map((e) => {
        const selecionado = e.id === enderecoSelecionado?.id;
        return (
          <Pressable
            key={e.id}
            accessibilityRole="button"
            onPress={() => onSelecionar(e)}
            className={`border rounded-lg px-3 py-2 ${selecionado ? "border-sf-primary bg-sf-surface-variant" : "border-sf-outline"}`}
          >
            <Text className="text-sf-text">{e.identificacao ?? e.cidade ?? "Endereço"}</Text>
            <Text className="text-sf-muted text-xs">
              {[e.logradouro, e.numero, e.bairro, e.cidade].filter(Boolean).join(", ")}
            </Text>
          </Pressable>
        );
      })}

      {mostrandoForm ? (
        <FormEndereco
          enviando={criar.isPending}
          onCriar={async (dados) => {
            const novo = await criar.mutateAsync(dados);
            setMostrandoForm(false);
            onSelecionar(novo);
          }}
        />
      ) : (
        <Pressable accessibilityRole="button" onPress={() => setMostrandoForm(true)} className="py-2">
          <Text className="text-sf-primary">+ Adicionar endereço</Text>
        </Pressable>
      )}
    </View>
  );
}
```

- [ ] **Step 5: Escrever `SeletorCategoria.tsx`**

```tsx
import { ScrollView, Text, Pressable } from "react-native";
import { useCategorias } from "@/features/descoberta/hooks/useCategorias";

export function SeletorCategoria({
  categoriaId,
  onSelecionar,
}: {
  categoriaId: string | null;
  onSelecionar: (id: string) => void;
}) {
  const cats = useCategorias();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
      {(cats.data ?? []).map((c) => {
        const sel = c.id === categoriaId;
        return (
          <Pressable
            key={c.id}
            accessibilityRole="button"
            onPress={() => onSelecionar(c.id)}
            className={`px-3 py-1.5 mx-1 rounded-full border ${sel ? "bg-sf-primary border-sf-primary" : "border-sf-outline"}`}
          >
            <Text className={sel ? "text-white text-sm" : "text-sf-body text-sm"}>{c.nome}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
```

- [ ] **Step 6: Escrever o teste `CriarDemandaScreen.test.tsx`**

```tsx
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { criarWrapperQuery } from "@/test/criarWrapperQuery";

const replace = jest.fn();
jest.mock("expo-router", () => ({ router: { replace: (...a: unknown[]) => replace(...a) } }));
jest.mock("@/shared/api/repositories", () => ({
  repositories: {
    categorias: { listar: jest.fn().mockResolvedValue([{ id: "c1", nome: "Pintor", descricao: null, iconeKey: "b", popular: false, precoMedioHora: 0 }]) },
    enderecos: { listarMeus: jest.fn().mockResolvedValue([{ id: "e1", identificacao: "Casa", cidade: "Floripa", bairro: "Centro", logradouro: "Rua A", numero: "10", complemento: null, cep: null, estado: null, principal: false }]), criar: jest.fn() },
    demandas: { criar: jest.fn().mockResolvedValue({ id: "d9" }) },
  },
}));
jest.mock("@/shared/store/authStore", () => ({
  useAuthStore: (sel: (s: { usuarioId: string }) => unknown) => sel({ usuarioId: "u1" }),
}));

import { repositories } from "@/shared/api/repositories";
import { CriarDemandaScreen } from "./CriarDemandaScreen";

const Wrapper = criarWrapperQuery();

it("botão desabilitado até categoria + título + descrição + endereço", async () => {
  const { getByText, getByPlaceholderText, queryByText } = render(<CriarDemandaScreen />, { wrapper: Wrapper });
  await waitFor(() => getByText("Pintor"));
  // nada preenchido → Botao mostra o título mas onPress não chama o repo
  fireEvent.press(getByText("Publicar demanda"));
  expect(repositories.demandas.criar).not.toHaveBeenCalled();

  fireEvent.press(getByText("Pintor"));
  fireEvent.changeText(getByPlaceholderText(/Título/), "Pintar sala");
  fireEvent.changeText(getByPlaceholderText(/Descreva/), "2 paredes");
  await waitFor(() => getByText(/Casa/));
  fireEvent.press(getByText(/Casa/));

  fireEvent.press(getByText("Publicar demanda"));
  await waitFor(() =>
    expect(repositories.demandas.criar).toHaveBeenCalledWith(
      expect.objectContaining({
        clienteId: "u1",
        categoriaId: "c1",
        titulo: "Pintar sala",
        descricao: "2 paredes",
        enderecoCidade: "Floripa",
      }),
    ),
  );
  expect(replace).toHaveBeenCalledWith("/(app)/demanda/d9");
  expect(queryByText).toBeTruthy();
});
```

- [ ] **Step 7: Rodar — FALHA.**

- [ ] **Step 8: Escrever `CriarDemandaScreen.tsx`**

```tsx
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { CampoTexto } from "@/shared/components/atoms/CampoTexto";
import { Botao } from "@/shared/components/atoms/Botao";
import { SeletorCategoria } from "@/features/demandas/components/SeletorCategoria";
import { SeletorEndereco } from "@/features/demandas/components/SeletorEndereco";
import { useCriarDemanda } from "@/features/demandas/hooks/useCriarDemanda";
import { formatarEndereco } from "@/features/enderecos/types/endereco.types";
import { traduzErroRepo } from "@/shared/lib/traduzErroRepo";
import type { Endereco } from "@/features/enderecos/types/endereco.types";

export function CriarDemandaScreen() {
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [orcamento, setOrcamento] = useState("");
  const [endereco, setEndereco] = useState<Endereco | null>(null);
  const criar = useCriarDemanda();

  useEffect(() => {
    if (criar.isSuccess && criar.data) router.replace(`/(app)/demanda/${criar.data.id}`);
  }, [criar.isSuccess, criar.data]);

  const ok =
    !!categoriaId && titulo.trim().length > 0 && descricao.trim().length > 0 && !!endereco && !criar.isPending;

  return (
    <ScrollView className="flex-1 bg-sf-bg px-4 pt-4">
      <Text className="text-sf-text font-semibold mb-1">Categoria</Text>
      <SeletorCategoria categoriaId={categoriaId} onSelecionar={setCategoriaId} />

      <View className="gap-2 mt-3">
        <CampoTexto placeholder="Título (ex: Pintar a sala)" value={titulo} onChangeText={setTitulo} />
        <CampoTexto
          placeholder="Descreva o que precisa"
          value={descricao}
          onChangeText={setDescricao}
          multiline
        />
        <CampoTexto
          placeholder="Orçamento máximo (opcional)"
          value={orcamento}
          onChangeText={setOrcamento}
          keyboardType="numbers-and-punctuation"
        />
      </View>

      <Text className="text-sf-text font-semibold mt-4 mb-1">Endereço</Text>
      <SeletorEndereco enderecoSelecionado={endereco} onSelecionar={setEndereco} />

      {criar.isError ? (
        <Text className="text-sf-status-red mt-3">{traduzErroRepo(criar.error)}</Text>
      ) : null}

      <View className="mt-4 mb-10">
        <Botao
          titulo="Publicar demanda"
          desabilitado={!ok}
          carregando={criar.isPending}
          onPress={() => {
            if (!ok || !endereco || !categoriaId) return;
            const orc = Number.parseFloat(orcamento.replace(",", "."));
            criar.mutate({
              categoriaId,
              titulo: titulo.trim(),
              descricao: descricao.trim(),
              orcamentoMaximo: Number.isFinite(orc) && orc > 0 ? orc : null,
              urgencia: "Normal",
              enderecoCidade: endereco.cidade,
              enderecoBairro: endereco.bairro,
              enderecoCompleto: formatarEndereco(endereco),
              dataDesejada: null,
            });
          }}
        />
      </View>
    </ScrollView>
  );
}
```

- [ ] **Step 9: Escrever a rota `app/(app)/criar-demanda.tsx`**

```tsx
import { CriarDemandaScreen } from "@/features/demandas/screens/CriarDemandaScreen";
export default function CriarDemandaRoute() {
  return <CriarDemandaScreen />;
}
```

- [ ] **Step 10: Rodar — PASSA. Gates + commit**

Run: `pnpm --filter @servico-feito/mobile test SeletorEndereco CriarDemandaScreen` → PASS.
Run: tsc 0 · test (suite) verde · lint 0.

```bash
git add apps/mobile/src/features/enderecos/components apps/mobile/src/features/demandas "apps/mobile/app/(app)/criar-demanda.tsx"
git commit -m "feat(mobile): fluxo de criar demanda (categoria + endereço + submit)"
```

---

## Task 17: Vagas — `DemandaCard`, `DemandaDetalheScreen`, `VagasScreen`, rota

**Files:**
- Create: `apps/mobile/src/features/demandas/components/DemandaCard.tsx`
- Create: `apps/mobile/src/features/demandas/screens/DemandaDetalheScreen.tsx`
- Create: `apps/mobile/src/features/demandas/screens/VagasScreen.tsx`
- Create: `apps/mobile/app/(app)/demanda/[id].tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/vagas.tsx`
- Delete: `apps/mobile/src/features/shell/screens/VagasScreen.tsx`

**Interfaces:**
- Consumes: `useDemandasAbertas` + `useDemanda` (Task 11), `SeletorCategoria` (Task 16), `useDebounce`, `traduzErroRepo`, átomos de estado; `DemandaResumo`, `DemandaDetalhe`.
- Produces: `VagasScreen`, `DemandaDetalheScreen` (exports nomeados). Rota `demanda/[id]` lê `id` de `useLocalSearchParams`.

- [ ] **Step 1: Escrever `DemandaCard.tsx`**

```tsx
import { Pressable, Text, View } from "react-native";
import type { DemandaResumo } from "@/features/demandas/types/demanda.types";

export function DemandaCard({ demanda, onPress }: { demanda: DemandaResumo; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="bg-sf-surface border border-sf-outline rounded-xl px-4 py-3 mb-2"
    >
      <View className="flex-row justify-between">
        <Text className="text-sf-text font-semibold" numberOfLines={1}>{demanda.titulo}</Text>
        <Text className="text-sf-muted text-xs">{demanda.categoriaNome}</Text>
      </View>
      <Text className="text-sf-body text-sm mt-0.5" numberOfLines={2}>{demanda.descricao}</Text>
      <View className="flex-row justify-between mt-1">
        <Text className="text-sf-muted text-xs">
          {[demanda.enderecoBairro, demanda.enderecoCidade].filter(Boolean).join(", ")}
        </Text>
        {demanda.orcamentoMaximo != null ? (
          <Text className="text-sf-muted text-xs">até R$ {demanda.orcamentoMaximo}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 2: Escrever `DemandaDetalheScreen.tsx`**

```tsx
import { ScrollView, Text, View } from "react-native";
import { useDemanda } from "@/features/demandas/hooks/useDemanda";
import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";
import { ErroEstado } from "@/shared/components/molecules/ErroEstado";
import { traduzErroRepo } from "@/shared/lib/traduzErroRepo";

export function DemandaDetalheScreen({ id }: { id: string }) {
  const q = useDemanda(id);
  if (q.isLoading) return <CarregandoEstado />;
  if (q.isError || !q.data) return <ErroEstado mensagem={traduzErroRepo(q.error)} onRetry={() => q.refetch()} />;

  const d = q.data;
  return (
    <ScrollView className="flex-1 bg-sf-bg px-4 pt-4">
      <Text className="text-2xl font-bold text-sf-text">{d.titulo}</Text>
      <Text className="text-sf-muted text-sm mt-0.5">{d.categoriaNome} · {d.urgencia}</Text>
      <Text className="text-sf-body mt-3">{d.descricao}</Text>

      <View className="mt-3 gap-0.5">
        {d.clienteNome ? <Text className="text-sf-body text-sm">Cliente: {d.clienteNome}</Text> : null}
        <Text className="text-sf-body text-sm">
          Local: {[d.enderecoCompleto, d.enderecoBairro, d.enderecoCidade].filter(Boolean).join(" · ") || "não informado"}
        </Text>
        {d.orcamentoMaximo != null ? (
          <Text className="text-sf-body text-sm">Orçamento máximo: R$ {d.orcamentoMaximo}</Text>
        ) : null}
        {d.dataDesejada ? <Text className="text-sf-body text-sm">Data desejada: {d.dataDesejada}</Text> : null}
        <Text className="text-sf-muted text-xs mt-1">{d.totalPropostas} proposta(s)</Text>
      </View>

      <Text className="text-sf-muted text-xs mt-6 mb-10">
        Iniciar conversa com o cliente estará disponível em breve.
      </Text>
    </ScrollView>
  );
}
```

- [ ] **Step 3: Escrever `VagasScreen.tsx`**

```tsx
import { useState } from "react";
import { FlatList, View } from "react-native";
import { router } from "expo-router";
import { CampoTexto } from "@/shared/components/atoms/CampoTexto";
import { SeletorCategoria } from "@/features/demandas/components/SeletorCategoria";
import { DemandaCard } from "@/features/demandas/components/DemandaCard";
import { useDemandasAbertas } from "@/features/demandas/hooks/useDemandasAbertas";
import { useDebounce } from "@/shared/lib/useDebounce";
import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";
import { ErroEstado } from "@/shared/components/molecules/ErroEstado";
import { VazioEstado } from "@/shared/components/molecules/VazioEstado";
import { traduzErroRepo } from "@/shared/lib/traduzErroRepo";

export function VagasScreen() {
  const [termo, setTermo] = useState("");
  const [cidade, setCidade] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const termoD = useDebounce(termo.trim(), 300);
  const cidadeD = useDebounce(cidade.trim(), 300);

  const q = useDemandasAbertas({
    termo: termoD.length >= 2 ? termoD : undefined,
    cidade: cidadeD || undefined,
    categoriaId: categoriaId ?? undefined,
  });

  const itens = q.data?.pages.flatMap((p) => p.itens) ?? [];

  return (
    <View className="flex-1 bg-sf-bg px-4 pt-3 gap-2">
      <CampoTexto placeholder="Buscar por título…" value={termo} onChangeText={setTermo} autoCapitalize="none" />
      <CampoTexto placeholder="Cidade (opcional)" value={cidade} onChangeText={setCidade} autoCapitalize="words" />
      <SeletorCategoria categoriaId={categoriaId} onSelecionar={(id) => setCategoriaId((a) => (a === id ? null : id))} />

      {q.isLoading ? (
        <CarregandoEstado />
      ) : q.isError ? (
        <ErroEstado mensagem={traduzErroRepo(q.error)} onRetry={() => q.refetch()} />
      ) : itens.length === 0 ? (
        <VazioEstado mensagem="Nenhuma demanda aberta com esses filtros." />
      ) : (
        <FlatList
          data={itens}
          keyExtractor={(d) => d.id}
          renderItem={({ item }) => (
            <DemandaCard demanda={item} onPress={() => router.push(`/(app)/demanda/${item.id}`)} />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
          }}
        />
      )}
    </View>
  );
}
```

- [ ] **Step 4: Escrever a rota `app/(app)/demanda/[id].tsx`**

```tsx
import { useLocalSearchParams } from "expo-router";
import { DemandaDetalheScreen } from "@/features/demandas/screens/DemandaDetalheScreen";

export default function DemandaRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DemandaDetalheScreen id={id ?? ""} />;
}
```

- [ ] **Step 5: Re-apontar `app/(app)/(tabs)/vagas.tsx` + deletar o stub**

```tsx
import { VagasScreen } from "@/features/demandas/screens/VagasScreen";
export default function VagasRoute() {
  return <VagasScreen />;
}
```

```bash
git rm apps/mobile/src/features/shell/screens/VagasScreen.tsx
```

- [ ] **Step 6: Gates + commit**

Run: tsc 0 · test verde · lint 0.

```bash
git add apps/mobile/src/features/demandas "apps/mobile/app/(app)/demanda" "apps/mobile/app/(app)/(tabs)/vagas.tsx"
git commit -m "feat(mobile): feed de vagas + detalhe da demanda (prestador)"
```

---

## Task 18: `InicioScreen` — ações rápidas + gate final

**Files:**
- Modify: `apps/mobile/src/features/shell/screens/InicioScreen.tsx`

**Interfaces:**
- Consumes: `useUiModeStore` (`s.modo`), átomo `Botao`, `router` de `expo-router`.
- Produces: nada novo — só enriquece a tela existente.

- [ ] **Step 1: Reescrever `InicioScreen.tsx`**

```tsx
import { View } from "react-native";
import { router } from "expo-router";
import { useUiModeStore } from "@/shared/store/uiModeStore";
import { Botao } from "@/shared/components/atoms/Botao";
import { Texto } from "@/shared/components/atoms/Texto";

export function InicioScreen() {
  const modo = useUiModeStore((s) => s.modo);
  return (
    <View className="flex-1 bg-sf-bg px-6 justify-center gap-3">
      <Texto variante="titulo">
        {modo === "prestar" ? "Encontre trabalho" : "O que você precisa hoje?"}
      </Texto>
      {modo === "prestar" ? (
        <Botao titulo="Ver vagas" onPress={() => router.push("/(app)/(tabs)/vagas")} />
      ) : (
        <View className="gap-2">
          <Botao titulo="Criar demanda" onPress={() => router.push("/(app)/criar-demanda")} />
          <Botao
            titulo="Buscar serviços"
            variante="secundario"
            onPress={() => router.push("/(app)/(tabs)/buscar")}
          />
        </View>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Gate final — rodar tudo**

```bash
pnpm --filter @servico-feito/mobile exec tsc --noEmit          # exit 0
pnpm --filter @servico-feito/mobile test                        # verde, auto-encerra, sem --forceExit
pnpm --filter @servico-feito/mobile lint                        # exit 0
pnpm --filter @servico-feito/mobile exec expo-doctor            # 18/18
rm -rf /tmp/p3 && pnpm --filter @servico-feito/mobile exec expo export --platform ios --output-dir /tmp/p3   # EXIT 0
rm -rf /tmp/p3
```

Expected: todos verdes. Se `expo export` falhar por resolução de módulo novo (pnpm), aplicar o mesmo padrão do Plano 2 (adicionar dep direta em `apps/mobile/package.json` ou ajuste em `metro.config.js`) e registrar.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/shell/screens/InicioScreen.tsx
git commit -m "feat(mobile): ações rápidas na tela inicial por modo"
```

---

## Self-Review (feito pelo autor do plano)

**1. Cobertura da spec:**

| Seção da spec | Task(s) |
|---|---|
| §2 infra repositories (`types.ts`, `normalizarErro`, barrel) | 1, 2 |
| §2.2 `CategoriasRepository` | 2 |
| §2.2 `PrestadoresRepository` | 5 |
| §2.2 `DemandasRepository` | 4 |
| §2.2 `EnderecosRepository` | 3 |
| §2.3 map linha→domínio + `throw normalizarErro` + keyset/offset | 2–5 |
| §3 feature `descoberta` (Buscar, lista por categoria) | 14 |
| §3 feature `prestadores` (perfil completo: view + categorias + portfólio + disponibilidade) | 5, 10, 15 |
| §3 feature `demandas` (criar, feed, detalhe) | 4, 11, 13, 16, 17 |
| §3 feature `enderecos` (listar + criar + seletor) | 3, 12, 16 |
| §3 rotas novas `categoria/[id]`, `prestador/[id]`, `criar-demanda`, `demanda/[id]` | 14, 15, 16, 17 |
| §3 remoção dos stubs `shell/BuscarScreen` e `shell/VagasScreen` + re-aponte das rotas de tab | 14, 17 |
| §3 `InicioScreen` ações rápidas | 18 |
| §4 hooks + `queryKey` + `useInfiniteQuery` + debounce | 6, 8–13, 14, 17 |
| §4 mutations `useCriarDemanda` / `useCriarEndereco` + `invalidateQueries` | 12, 13 |
| §5 `traduzErroRepo` + estados de erro nas telas | 7, 14–17 |
| §6 testes (normalizarErro, traduzErroRepo, useDebounce, repos, hooks, CriarDemandaScreen, SeletorEndereco) | 1, 6, 7, 2–5, 8–13, 16 |
| §6 gate final (tsc/jest/lint/doctor/expo export) | 18 |
| §7 interfaces expostas para o Plano 4 (`repositories` barrel, `useDebounce`, `traduzErroRepo`, tipos de demanda/prestador) | 1–5 |

Sem migração — coerente com a spec ("Sem migração de banco").

**2. Placeholders:** nenhum "TBD"/"TODO". As duas "Notas de implementação" (join de FK na Task 4, helper `paginarPP` na Task 5) descrevem o desvio exato e o fallback exato — não são vagas. Campos de tipo pinados a partir do `db-types` real.

**3. Consistência de tipos/nomes:**
- `PageParams { limite; cursor? }` / `Pagina<T> { itens; proximoCursor }` — Task 1, usado igual em 4, 5, 9, 11.
- `repositories` barrel cresce em 2→3→4→5, sempre `{ <dominio>: <impl> }` + `export type`.
- `Categoria` definido na Task 2 (`descoberta.types.ts`), reusado em 5 (`prestador.types.ts` importa), 8, 16.
- `LIMITE_PAGINA = 20` exportado da Task 9, reusado na Task 11.
- `DadosNovaDemanda = Omit<NovaDemanda,"clienteId">` (Task 13) e `DadosNovoEndereco = Omit<NovaEndereco,"usuarioId">` (Task 12) — consumidos por `CriarDemandaScreen` / `FormEndereco` (Task 16).
- `traduzErroRepo(e: unknown)` (Task 7) — chamado com `q.error` em todas as telas.
- Rotas: `router.push("/(app)/prestador/${id}")` / `"/(app)/categoria/${id}"` / `"/(app)/demanda/${id}"` / `"/(app)/criar-demanda"` — arquivos criados em 14/15/16/17.
- `Botao` props `{ titulo, onPress, carregando?, desabilitado?, variante? }` e `CampoTexto` (props de `TextInput`) — do Plano 2, usados como lá.

Nenhuma inconsistência pendente.

---

## Execution Handoff

Ver a seção de handoff da skill (subagent-driven vs inline).
