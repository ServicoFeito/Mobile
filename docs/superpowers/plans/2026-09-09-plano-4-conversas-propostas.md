# Plano 4 — Conversas e propostas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o chat de texto (com realtime) entre cliente e prestador e o ciclo de proposta (criar, recusar, aceitar → contratação).

**Architecture:** Invariantes transacionais moram no banco — `fn_aceitar_proposta` / `fn_recusar_proposta` (plpgsql `SECURITY DEFINER`, idempotentes) e os triggers `handle_new_proposta` / `handle_new_mensagem`. Os repositories no app são finos: mapeiam linha↔domínio e chamam `insert` direto ou `rpc`. O realtime é `postgres_changes` do `supabase-js` aplicado ao cache do TanStack Query por hooks dedicados. As telas seguem os átomos e o padrão de estados (`CarregandoEstado`/`ErroEstado`/`VazioEstado`) do Plano 2.

**Tech Stack:** Expo SDK 52 · Expo Router 4 · React Native 0.76.9 · TypeScript 5.6 strict + `noUncheckedIndexedAccess` · `@supabase/supabase-js` 2.x (`postgres_changes`) · `@tanstack/react-query` 5 (`useQuery`/`useInfiniteQuery`/`useMutation`) · Zustand 5 · NativeWind 4.1.23 · Jest (`jest-expo`) + `@testing-library/react-native` · Postgres + pgTAP (runner Node `supabase/tests/run.mjs`, sem Docker).

**Spec:** `docs/superpowers/specs/2026-09-09-plano-4-conversas-propostas-design.md`

## Global Constraints

- **Base:** branch a partir de `homolog` @ `146f146` (Planos 1–3 mergeados). `git config user`: `VitorHugoVH` / `vhfraga007@gmail.com`. Conventional Commits.
- **Sem Docker / sem Postgres local.** Migrations aplicadas com `pnpm db:push` (`supabase db push --linked`) no projeto dev `servico-feito-dev`. pgTAP roda com `pnpm db:test` (runner Node). Antes de qualquer `db:*`: `set -a && . ./.env && set +a`.
- Toda migration nova tem arquivo de teste pgTAP em `supabase/tests/00XX_*.test.sql` no formato `begin; select plan(N); … select * from finish(); rollback;`. Migration sem teste não é considerada pronta.
- Toda função/trigger SQL declara `language plpgsql`/`sql`, `security definer` e `set search_path = ''`, e referencia objetos com prefixo de schema (`public.`, `auth.`, `pg_catalog.`). Rótulos de enum em `MAIÚSCULAS`.
- Enums existentes (não criar novos): `tipo_conversa('DEMANDA','DIRETA')`, `status_conversa('ATIVA','ENCERRADA','BLOQUEADA')`, `tipo_mensagem('TEXTO','AUDIO','VIDEO','FOTO','LOCALIZACAO','PROPOSTA','CONTRATO_GERADO','PAGAMENTO_CONFIRMADO','SISTEMA')`, `status_proposta('ENVIADA','VISUALIZADA','ACEITA','RECUSADA','CANCELADA','EXPIRADA')`, `status_demanda('ABERTA','EM_NEGOCIACAO','CONTRATADA','FINALIZADA','CANCELADA')`, `status_contratacao('AGUARDANDO_PAGAMENTO',…)`, `tipo_notificacao('PROPOSTA','PAGAMENTO','MENSAGEM','CONTRATACAO','AVALIACAO')`.
- Nenhum `*.test.*` dentro de `apps/mobile/app/` (Expo Router bundla tudo lá). Testes de tela ficam em `src/features/**/screens/*.test.tsx`.
- Todo hook react-query nos testes usa `criarWrapperQuery()` de `@/test/criarWrapperQuery` (Ruling R6) — nunca `new QueryClient` inline.
- Seletores Zustand em `app/` são atômicos: `useAuthStore((s) => s.usuarioId)` (Ruling R7).
- `process.env.EXPO_PUBLIC_*` literal só em `apps/mobile/src/shared/api/supabaseClient.ts` (Ruling R3).
- **Template de teste de infinite-query (Ruling R-F):** `jest.clearAllMocks()` no `beforeEach`; chamar `result.current.fetchNextPage()` **sem `await`**; antes de assertar `mock.calls[1]`, aguardar `await waitFor(() => expect(result.current.hasNextPage).toBe(false))`.
- Repositories: cada método `.supabase.ts` faz `try` a chamada → mapeia linha→domínio camelCase → retorna; `catch (e) { throw normalizarErro(e) }`; se o retorno traz `{ error }` não-nulo, `throw normalizarErro(error)`. Nunca vaza `PostgrestError`.
- Gate final (igual Planos 2 e 3): `pnpm --filter @servico-feito/mobile exec tsc --noEmit` 0 · `pnpm --filter @servico-feito/mobile test` verde e auto-encerrando · `pnpm --filter @servico-feito/mobile exec eslint .` 0 erros · `pnpm --filter @servico-feito/mobile exec expo-doctor` 18/18 · `pnpm --filter @servico-feito/mobile exec expo export --platform ios` EXIT 0 · `pnpm db:push` aplica · `pnpm db:test` verde.

---

## File Structure

### Banco (`supabase/`)

| Arquivo | Responsabilidade |
|---|---|
| `migrations/<TS1>_chat_triggers.sql` | `handle_new_proposta` (auto-insere mensagem `PROPOSTA`) + `handle_new_mensagem` (resumo + contadores de não-lidas em `conversas`) + os dois `create trigger`. |
| `migrations/<TS2>_conversa_dedup.sql` | Índices únicos parciais: `conversas_demanda_prestador_uniq`, `conversas_direta_par_uniq`. |
| `migrations/<TS3>_fn_propostas.sql` | `fn_recusar_proposta(uuid)` + `fn_aceitar_proposta(uuid)` + `revoke`/`grant execute`. |
| `migrations/<TS4>_realtime_chat.sql` | `alter publication supabase_realtime add table` para `mensagens` e `conversas`. |
| `tests/0022_chat_triggers.test.sql` | pgTAP dos dois triggers. |
| `tests/0023_conversa_dedup.test.sql` | pgTAP dos dois índices. |
| `tests/0024_fn_propostas.test.sql` | pgTAP de `fn_recusar_proposta` e `fn_aceitar_proposta` (feliz, idempotência, authz, conflito, inexistente, conversa DIRETA). |
| `tests/0025_realtime_chat.test.sql` | pgTAP: `mensagens` e `conversas` estão em `supabase_realtime`. |
| `packages/db-types/index.ts` | Regenerado por `pnpm db:types` (ganha `fn_aceitar_proposta` / `fn_recusar_proposta` em `Functions`). |

### App — repositories (`apps/mobile/src/shared/api/repositories/`)

| Arquivo | Responsabilidade |
|---|---|
| `conversas/conversasRepository.ts` | Interface `ConversasRepository`. |
| `conversas/conversasRepository.supabase.ts` | Impl: `listarMinhas`, `obter`, `iniciarDireta`, `iniciarDemanda` (find-or-create). |
| `conversas/conversasRepository.supabase.test.ts` | Testes. |
| `mensagens/mensagensRepository.ts` / `.supabase.ts` / `.supabase.test.ts` | `listar` (keyset desc), `enviarTexto`, `marcarLidas`. |
| `propostas/propostasRepository.ts` / `.supabase.ts` / `.supabase.test.ts` | `daConversa`, `obter`, `criar`, `recusar` (rpc), `aceitar` (rpc). |
| `types.ts` (modificar) | `classificar()` ganha `PT401→nao_autorizado`, `PT404→nao_encontrado`, `PT409→conflito`. |
| `index.ts` (modificar) | barrel += `conversas`, `mensagens`, `propostas` e re-export dos tipos. |

### App — domínio, hooks, componentes, telas

```
apps/mobile/src/features/conversas/
  types/conversa.types.ts          Conversa, Mensagem
  hooks/useMinhasConversas.ts      useQuery ['conversas','minhas']
  hooks/useConversa.ts             useQuery ['conversa', id]
  hooks/useMensagensInfinite.ts    useInfiniteQuery ['mensagens', id]
  hooks/useEnviarTexto.ts          useMutation
  hooks/useMarcarLidas.ts          useMutation
  hooks/useIniciarConversa.ts      { iniciarDireta, iniciarDemanda }
  hooks/useMensagensRealtime.ts    postgres_changes em mensagens
  hooks/useConversasRealtime.ts    postgres_changes em conversas
  components/ConversaRow.tsx       linha da lista
  components/BolhaMensagem.tsx     bolha de texto
  screens/ConversasListScreen.tsx  substitui o stub de features/shell/screens
  screens/ConversaScreen.tsx       chat
  screens/*.test.tsx

apps/mobile/src/features/propostas/
  types/proposta.types.ts          Proposta, NovaProposta
  hooks/usePropostasDaConversa.ts  useQuery ['propostas','conversa', id]
  hooks/useCriarProposta.ts        useMutation
  hooks/useRecusarProposta.ts      useMutation
  hooks/useAceitarProposta.ts      useMutation
  components/PropostaCard.tsx      card no chat + botões Aceitar/Recusar
  components/ContratoGeradoCard.tsx
  screens/NovaPropostaScreen.tsx   formulário do prestador
  screens/NovaPropostaScreen.test.tsx

apps/mobile/app/(app)/conversa/[id].tsx                 → ConversaScreen
apps/mobile/app/(app)/conversa/[id]/nova-proposta.tsx   → NovaPropostaScreen
apps/mobile/app/(app)/(tabs)/conversas.tsx  (já existe)  → passa a renderizar features/conversas/screens/ConversasListScreen
```

### App — wiring nas telas do Plano 3

- `apps/mobile/src/features/prestadores/screens/PrestadorPerfilScreen.tsx` — botão "Conversar".
- `apps/mobile/src/features/demandas/screens/DemandaDetalheScreen.tsx` — botão "Tenho interesse" (só modo prestar).
- `apps/mobile/src/features/shell/screens/ConversasListScreen.tsx` — **removido** (a tela real vive em `features/conversas`).

---

## Contexto de esquema (fatos verificados — não re-descobrir)

- **`conversas`** (`20260908143453_conversas.sql`): `id, tipo, demanda_id (nullable, FK demandas_servico ON DELETE SET NULL), cliente_id, prestador_id (FK usuarios ON DELETE CASCADE), status default 'ATIVA', ultima_mensagem text, data_ultima_mensagem timestamptz, nao_lidas_cliente int default 0, nao_lidas_prestador int default 0, created_at, updated_at`. CHECK `conversas_demanda_obrigatoria_quando_tipo_demanda`: `tipo = 'DIRETA' or demanda_id is not null`. Trigger `conversas_set_updated_at` **já existe**. Trigger `on_conversa_created` → `handle_new_conversa()` **já popula `participantes_conversa`**.
- **`mensagens`**: `id, conversa_id (FK CASCADE), remetente_id (FK usuarios CASCADE), tipo default 'TEXTO', corpo text not null default '', proposta_id uuid (FK propostas ON DELETE SET NULL), lida boolean default false, created_at`. Índice `mensagens_conversa_id_created_at_idx (conversa_id, created_at)`. **Sem `updated_at`** (append-only).
- **`propostas`** (`20260908143850_propostas.sql`): `id, demanda_id (nullable FK SET NULL), prestador_id, cliente_id, conversa_id (FK CASCADE), valor numeric(10,2) CHECK >=0, taxa_plataforma / valor_liquido_prestador GENERATED, descricao text not null default '', prazo_execucao text, validade_dias int default 7, status default 'ENVIADA', tarefas_ids text, created_at, updated_at`. Trigger `propostas_set_updated_at` **já existe**.
- **`contratacoes`** (`20260908144223_contratacoes.sql`): `id, demanda_id (nullable), proposta_id uuid NOT NULL UNIQUE FK propostas ON DELETE RESTRICT, titulo_servico text NOT NULL, cliente_id, prestador_id, valor_total numeric(10,2) CHECK >=0, valor_entrada/valor_final/taxa_plataforma GENERATED, status default 'AGUARDANDO_PAGAMENTO', entrada_paga/final_pago/avaliado bool default false, data_agendada text, data_conclusao timestamptz, created_at, updated_at`. **A `unique` de `proposta_id` é a garantia de idempotência.**
- **`notificacoes`** (`20260908144554_avaliacoes_notificacoes.sql`): `id, usuario_id (FK usuarios CASCADE), titulo text NOT NULL, mensagem text NOT NULL, tipo public.tipo_notificacao NOT NULL, referencia_id uuid (nullable), lida boolean default false, created_at`. **Colunas são `titulo` / `mensagem` / `referencia_id`** (não `corpo`/`ref_id`).
- **RLS relevante** (`20260908151628_rls_conversas.sql` + `20260908200154_rls_hardening.sql`):
  - `conversas`: `conversas_select_participante` USING `fn_e_participante(id)`; `conversas_insert_parte` WITH CHECK `cliente_id = auth.uid() or prestador_id = auth.uid()`; `conversas_update_participante`. `grant update` é **por coluna**: `(status, ultima_mensagem, data_ultima_mensagem, nao_lidas_cliente, nao_lidas_prestador)`.
  - `mensagens`: `mensagens_select_participante`; `mensagens_insert_remetente_participante` WITH CHECK `remetente_id = auth.uid() and fn_e_participante(conversa_id)`; `mensagens_update_remetente` + `mensagens_update_lida_participante` + trigger `enforce_mensagem_update_scope` (quem não é remetente só altera `lida`). `grant update (corpo, lida)`.
  - `propostas`: `propostas_select_participante`; `propostas_insert_prestador_participante` WITH CHECK `prestador_id = auth.uid() and fn_e_participante(conversa_id)`; **`propostas_update_prestador`** — UPDATE só quando `prestador_id = auth.uid()`. **Por isso `recusar` (feito pelo cliente) precisa de RPC `SECURITY DEFINER`.**
  - `contratacoes`: **sem `grant insert`/`update` para `authenticated`** — só `SECURITY DEFINER`/`service_role` escreve.
- **Nenhuma tabela tem `FORCE ROW LEVEL SECURITY`** — funções `SECURITY DEFINER` de dono `postgres` ignoram RLS.
- **pgTAP helpers** (`tests` schema): `tests.create_supabase_user('x') → uuid`, `tests.get_supabase_uid('x') → uuid`, `tests.authenticate_as('x')` (seta `role=authenticated` + `request.jwt.claims.sub`), `reset role` / `tests.clear_authentication()`. `auth.uid()` lê `request.jwt.claims->>'sub'` e continua válido dentro de `SECURITY DEFINER`.
- **App:** `supabase` de `@/shared/api/supabaseClient`; `queryClient` de `@/shared/query/queryClient`; `useAuthStore` de `@/shared/store/authStore` (`s.usuarioId: string | null`); `useUiModeStore` de `@/shared/store/uiModeStore` (`s.modo: 'contratar' | 'prestar'`). Átomos: `@/shared/components/molecules/{CarregandoEstado,ErroEstado,VazioEstado}`; `@/shared/components/atoms/{Botao,CampoTexto,Texto}` (confirmar nomes exatos no diretório antes de usar). `traduzErroRepo` de `@/shared/lib/traduzErroRepo`. `jest.setup.ts` já faz shim de `WebSocket` e mock de `expo-secure-store` / `async-storage`.

---

## Task 1: Triggers de chat — `handle_new_proposta` e `handle_new_mensagem`

**Files:**
- Create: `supabase/migrations/<TS1>_chat_triggers.sql` (gerar com `pnpm db:new chat_triggers`, depois preencher)
- Test: `supabase/tests/0022_chat_triggers.test.sql`

**Interfaces:**
- Consumes: tabelas `conversas`, `mensagens`, `propostas` (Plano 1); enum `tipo_mensagem`.
- Produces: trigger `on_proposta_created` em `public.propostas`; trigger `on_mensagem_created` em `public.mensagens`. Depois de inserir uma `propostas`, existe exatamente 1 `mensagens` com `tipo='PROPOSTA'` e `proposta_id` = id da proposta. Depois de inserir uma `mensagens`, a `conversas` correspondente tem `ultima_mensagem` / `data_ultima_mensagem` atualizadas e `nao_lidas_<papel do destinatário>` +1.

- [ ] **Step 1: Escrever o teste pgTAP que falha**

`supabase/tests/0022_chat_triggers.test.sql`:

```sql
begin;
select plan(8);

select tests.create_supabase_user('t1_cli');
select tests.create_supabase_user('t1_pre');

-- categoria + demanda (para a proposta ter demanda_id)
insert into public.categoria_servico (id, nome, icone, cor_hex)
values ('c1111111-0000-0000-0000-000000000001', 'Pintura', 'brush', '#fff');
insert into public.demandas_servico (id, cliente_id, categoria_id, titulo, descricao)
values ('d1111111-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t1_cli'),
        'c1111111-0000-0000-0000-000000000001', 'Pintar sala', 'duas paredes');

insert into public.conversas (id, tipo, demanda_id, cliente_id, prestador_id)
values ('a1111111-0000-0000-0000-000000000001', 'DEMANDA',
        'd1111111-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t1_cli'), tests.get_supabase_uid('t1_pre'));

-- (A) mensagem de TEXTO do cliente bump nao_lidas_prestador
insert into public.mensagens (conversa_id, remetente_id, tipo, corpo)
values ('a1111111-0000-0000-0000-000000000001', tests.get_supabase_uid('t1_cli'), 'TEXTO', 'oi tudo bem?');

select is(
  (select nao_lidas_prestador from public.conversas where id = 'a1111111-0000-0000-0000-000000000001'),
  1, 'mensagem do cliente incrementa nao_lidas_prestador');
select is(
  (select nao_lidas_cliente from public.conversas where id = 'a1111111-0000-0000-0000-000000000001'),
  0, 'mensagem do cliente NAO incrementa nao_lidas_cliente');
select is(
  (select ultima_mensagem from public.conversas where id = 'a1111111-0000-0000-0000-000000000001'),
  'oi tudo bem?', 'ultima_mensagem = corpo do TEXTO');
select isnt(
  (select data_ultima_mensagem from public.conversas where id = 'a1111111-0000-0000-0000-000000000001'),
  null, 'data_ultima_mensagem preenchida');

-- (B) mensagem do prestador bump nao_lidas_cliente
insert into public.mensagens (conversa_id, remetente_id, tipo, corpo)
values ('a1111111-0000-0000-0000-000000000001', tests.get_supabase_uid('t1_pre'), 'TEXTO', 'tudo, vamos ver');
select is(
  (select nao_lidas_cliente from public.conversas where id = 'a1111111-0000-0000-0000-000000000001'),
  1, 'mensagem do prestador incrementa nao_lidas_cliente');

-- (C) handle_new_proposta insere a mensagem PROPOSTA
insert into public.propostas (id, demanda_id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b1111111-0000-0000-0000-000000000001',
        'd1111111-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t1_pre'), tests.get_supabase_uid('t1_cli'),
        'a1111111-0000-0000-0000-000000000001', 300.00, 'faco por 300');

select is(
  (select count(*)::int from public.mensagens
    where conversa_id = 'a1111111-0000-0000-0000-000000000001'
      and tipo = 'PROPOSTA' and proposta_id = 'b1111111-0000-0000-0000-000000000001'),
  1, 'handle_new_proposta cria 1 mensagem PROPOSTA com proposta_id');
select is(
  (select corpo from public.mensagens
    where proposta_id = 'b1111111-0000-0000-0000-000000000001' and tipo = 'PROPOSTA'),
  'faco por 300', 'corpo da mensagem PROPOSTA = descricao da proposta');
select is(
  (select ultima_mensagem from public.conversas where id = 'a1111111-0000-0000-0000-000000000001'),
  '💼 Proposta', 'resumo da conversa para mensagem PROPOSTA usa o rotulo por tipo');

select * from finish();
rollback;
```

> Ajustar `plan(N)` para o número real de asserts acima (8). Confirmar contra `packages/db-types/index.ts` os nomes das colunas de `categoria_servico` no `insert` de setup (`icone`, `cor_hex` são chutes) — se divergirem, corrigir só o `insert`, não os asserts.

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
set -a && . ./.env && set +a
node supabase/tests/run.mjs 2>&1 | grep 0022
```
Esperado: `✗ 0022_chat_triggers.test.sql` (as funções/triggers ainda não existem; os inserts de mensagem não mexem em `conversas`).

- [ ] **Step 3: Escrever a migration**

`supabase/migrations/<TS1>_chat_triggers.sql`:

```sql
-- Plano 4 — triggers de bookkeeping do chat.
-- handle_new_proposta: toda proposta nova vira uma mensagem PROPOSTA no chat.
-- handle_new_mensagem: toda mensagem nova atualiza o resumo e os contadores de nao-lidas da conversa.

create or replace function public.handle_new_proposta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.mensagens (conversa_id, remetente_id, tipo, corpo, proposta_id)
  values (
    new.conversa_id,
    new.prestador_id,
    'PROPOSTA',
    left(coalesce(nullif(new.descricao, ''), 'Proposta enviada'), 200),
    new.id
  );
  return new;
end;
$$;

create trigger on_proposta_created
  after insert on public.propostas
  for each row execute function public.handle_new_proposta();

create or replace function public.handle_new_mensagem()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resumo text;
begin
  v_resumo := case new.tipo
    when 'TEXTO'                then left(new.corpo, 120)
    when 'FOTO'                 then '📷 Foto'
    when 'VIDEO'                then '🎥 Vídeo'
    when 'AUDIO'                then '🎙️ Áudio'
    when 'LOCALIZACAO'          then '📍 Localização'
    when 'PROPOSTA'             then '💼 Proposta'
    when 'CONTRATO_GERADO'      then '📄 Contrato gerado'
    when 'PAGAMENTO_CONFIRMADO' then '💰 Pagamento confirmado'
    else left(coalesce(nullif(new.corpo, ''), ''), 120)
  end;

  update public.conversas c set
    ultima_mensagem      = v_resumo,
    data_ultima_mensagem = new.created_at,
    nao_lidas_cliente    = c.nao_lidas_cliente
                           + case when new.remetente_id = c.prestador_id then 1 else 0 end,
    nao_lidas_prestador  = c.nao_lidas_prestador
                           + case when new.remetente_id = c.cliente_id then 1 else 0 end,
    updated_at           = pg_catalog.now()
  where c.id = new.conversa_id;

  return new;
end;
$$;

create trigger on_mensagem_created
  after insert on public.mensagens
  for each row execute function public.handle_new_mensagem();
```

- [ ] **Step 4: Aplicar e rodar o teste**

```bash
set -a && . ./.env && set +a
pnpm db:push
node supabase/tests/run.mjs 2>&1 | grep 0022
```
Esperado: `✓ 0022_chat_triggers.test.sql — 8 ok`. Ajustar só o `insert` de setup de `categoria_servico` se os nomes de coluna divergirem; não afrouxar asserts.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/<TS1>_chat_triggers.sql supabase/tests/0022_chat_triggers.test.sql
git commit -m "feat(db): triggers handle_new_proposta e handle_new_mensagem (Plano 4)"
```

---

## Task 2: Índices únicos parciais de dedup de conversa

**Files:**
- Create: `supabase/migrations/<TS2>_conversa_dedup.sql`
- Test: `supabase/tests/0023_conversa_dedup.test.sql`

**Interfaces:**
- Produces: `conversas_demanda_prestador_uniq` UNIQUE `(demanda_id, prestador_id)` WHERE `tipo = 'DEMANDA'`; `conversas_direta_par_uniq` UNIQUE `(cliente_id, prestador_id)` WHERE `tipo = 'DIRETA'`. Segunda conversa com a mesma chave e o mesmo `tipo` ⇒ erro `23505`.

- [ ] **Step 1: Escrever o teste pgTAP que falha**

`supabase/tests/0023_conversa_dedup.test.sql`:

```sql
begin;
select plan(4);

select tests.create_supabase_user('t2_cli');
select tests.create_supabase_user('t2_pre');

insert into public.categoria_servico (id, nome, icone, cor_hex)
values ('c2222222-0000-0000-0000-000000000001', 'Eletrica', 'bolt', '#fff');
insert into public.demandas_servico (id, cliente_id, categoria_id, titulo, descricao)
values ('d2222222-0000-0000-0000-000000000001', tests.get_supabase_uid('t2_cli'),
        'c2222222-0000-0000-0000-000000000001', 'Troca de tomada', 'x');
insert into public.demandas_servico (id, cliente_id, categoria_id, titulo, descricao)
values ('d2222222-0000-0000-0000-000000000002', tests.get_supabase_uid('t2_cli'),
        'c2222222-0000-0000-0000-000000000001', 'Outra demanda', 'y');

-- (1) 2a conversa DEMANDA com o mesmo (demanda, prestador) viola o indice
insert into public.conversas (tipo, demanda_id, cliente_id, prestador_id)
values ('DEMANDA', 'd2222222-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t2_cli'), tests.get_supabase_uid('t2_pre'));
select throws_ok(
  format($$ insert into public.conversas (tipo, demanda_id, cliente_id, prestador_id)
            values ('DEMANDA', 'd2222222-0000-0000-0000-000000000001', %L, %L) $$,
         tests.get_supabase_uid('t2_cli'), tests.get_supabase_uid('t2_pre')),
  '23505', null, '2a conversa DEMANDA do mesmo (demanda, prestador) viola o indice');

-- (2) 2a conversa DIRETA com o mesmo (cliente, prestador) viola o indice
insert into public.conversas (tipo, cliente_id, prestador_id)
values ('DIRETA', tests.get_supabase_uid('t2_cli'), tests.get_supabase_uid('t2_pre'));
select throws_ok(
  format($$ insert into public.conversas (tipo, cliente_id, prestador_id)
            values ('DIRETA', %L, %L) $$,
         tests.get_supabase_uid('t2_cli'), tests.get_supabase_uid('t2_pre')),
  '23505', null, '2a conversa DIRETA do mesmo par viola o indice');

-- (3) uma DIRETA e uma DEMANDA do mesmo par coexistem (indices sao parciais por tipo)
select is(
  (select count(*)::int from public.conversas
     where cliente_id = tests.get_supabase_uid('t2_cli')
       and prestador_id = tests.get_supabase_uid('t2_pre')),
  2, 'DIRETA e DEMANDA do mesmo par coexistem');

-- (4) 2a conversa DEMANDA do mesmo prestador com OUTRA demanda coexiste
select lives_ok(
  format($$ insert into public.conversas (tipo, demanda_id, cliente_id, prestador_id)
            values ('DEMANDA', 'd2222222-0000-0000-0000-000000000002', %L, %L) $$,
         tests.get_supabase_uid('t2_cli'), tests.get_supabase_uid('t2_pre')),
  'DEMANDA com demanda_id diferente nao colide');

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
set -a && . ./.env && set +a
node supabase/tests/run.mjs 2>&1 | grep 0023
```
Esperado: `✗` (sem índice, o 2º insert não lança).

- [ ] **Step 3: Escrever a migration**

`supabase/migrations/<TS2>_conversa_dedup.sql`:

```sql
-- Plano 4 — uma conversa por (demanda, prestador) e uma por (cliente, prestador) direta.
-- O repo faz find-or-create; este indice e a autoridade sob corrida.

create unique index conversas_demanda_prestador_uniq
  on public.conversas (demanda_id, prestador_id)
  where tipo = 'DEMANDA';

create unique index conversas_direta_par_uniq
  on public.conversas (cliente_id, prestador_id)
  where tipo = 'DIRETA';
```

- [ ] **Step 4: Aplicar e rodar**

```bash
set -a && . ./.env && set +a
pnpm db:push
node supabase/tests/run.mjs 2>&1 | grep 0023
```
Esperado: `✓ 0023_conversa_dedup.test.sql — 4 ok`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/<TS2>_conversa_dedup.sql supabase/tests/0023_conversa_dedup.test.sql
git commit -m "feat(db): indices unicos parciais de dedup de conversa (Plano 4)"
```

---

## Task 3: `fn_recusar_proposta` e `fn_aceitar_proposta`

**Files:**
- Create: `supabase/migrations/<TS3>_fn_propostas.sql`
- Test: `supabase/tests/0024_fn_propostas.test.sql`

**Interfaces:**
- Consumes: `propostas`, `contratacoes`, `demandas_servico`, `mensagens`, `notificacoes`; `auth.uid()`.
- Produces:
  - `public.fn_recusar_proposta(p_proposta_id uuid) returns void` — `SECURITY DEFINER`. Só o `cliente_id` da proposta pode chamar (`errcode 'PT401'` senão). `status ∈ ('ENVIADA','VISUALIZADA')` → `'RECUSADA'`; se já `'RECUSADA'` retorna sem erro (idempotente); qualquer outro estado ⇒ `errcode 'PT409'`. Proposta inexistente ⇒ `errcode 'PT404'`.
  - `public.fn_aceitar_proposta(p_proposta_id uuid) returns uuid` — `SECURITY DEFINER`. Retorna `contratacoes.id`. Só o `cliente_id` (`PT401`). Idempotente: se `status='ACEITA'`, retorna o `contratacoes.id` existente. `status ∉ ('ENVIADA','VISUALIZADA')` (e ≠ ACEITA) ⇒ `PT409`. Inexistente ⇒ `PT404`. Efeitos: proposta → `ACEITA`; irmãs da mesma `demanda_id` em `('ENVIADA','VISUALIZADA')` → `RECUSADA`; cria `contratacoes` (`proposta_id`, `demanda_id`, `titulo_servico`, `cliente_id`, `prestador_id`, `valor_total = proposta.valor`); se `demanda_id` não nulo, `demandas_servico.status = 'CONTRATADA'`; insere `mensagens` `tipo='CONTRATO_GERADO'` (`remetente_id = prestador`, `proposta_id`); insere `notificacoes` para o prestador (`tipo='CONTRATACAO'`, `referencia_id = contratacao_id`).
- `grant execute` ambas para `authenticated`; `revoke` de `public`/`anon`.

- [ ] **Step 1: Escrever o teste pgTAP que falha**

`supabase/tests/0024_fn_propostas.test.sql`:

```sql
begin;
select plan(14);

select tests.create_supabase_user('t3_cli');
select tests.create_supabase_user('t3_pre');
select tests.create_supabase_user('t3_outro');

insert into public.categoria_servico (id, nome, icone, cor_hex)
values ('c3333333-0000-0000-0000-000000000001', 'Encanamento', 'water', '#fff');
insert into public.demandas_servico (id, cliente_id, categoria_id, titulo, descricao, status)
values ('d3333333-0000-0000-0000-000000000001', tests.get_supabase_uid('t3_cli'),
        'c3333333-0000-0000-0000-000000000001', 'Vazamento', 'pia', 'ABERTA');

insert into public.conversas (id, tipo, demanda_id, cliente_id, prestador_id)
values ('a3333333-0000-0000-0000-000000000001', 'DEMANDA',
        'd3333333-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t3_cli'), tests.get_supabase_uid('t3_pre'));

-- proposta alvo + irma (mesma demanda, outra conversa/prestador nao importa aqui: mesma demanda_id)
insert into public.propostas (id, demanda_id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b3333333-0000-0000-0000-000000000001', 'd3333333-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t3_pre'), tests.get_supabase_uid('t3_cli'),
        'a3333333-0000-0000-0000-000000000001', 450.00, 'conserto completo');
insert into public.propostas (id, demanda_id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b3333333-0000-0000-0000-000000000002', 'd3333333-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t3_outro'), tests.get_supabase_uid('t3_cli'),
        'a3333333-0000-0000-0000-000000000001', 500.00, 'irma');

-- (1) authz: quem nao e o cliente nao aceita
select tests.authenticate_as('t3_pre');
select throws_ok(
  $$ select public.fn_aceitar_proposta('b3333333-0000-0000-0000-000000000001') $$,
  'PT401', null, 'nao-cliente nao aceita (PT401)');
reset role;

-- (2) inexistente
select tests.authenticate_as('t3_cli');
select throws_ok(
  $$ select public.fn_aceitar_proposta('00000000-0000-0000-0000-0000000000ff') $$,
  'PT404', null, 'proposta inexistente (PT404)');

-- (3) feliz
select lives_ok(
  $$ select public.fn_aceitar_proposta('b3333333-0000-0000-0000-000000000001') $$,
  'cliente aceita sem erro');

select is((select status::text from public.propostas where id = 'b3333333-0000-0000-0000-000000000001'),
          'ACEITA', 'proposta alvo ACEITA');
select is((select status::text from public.propostas where id = 'b3333333-0000-0000-0000-000000000002'),
          'RECUSADA', 'irma da mesma demanda RECUSADA');
select is((select count(*)::int from public.contratacoes where proposta_id = 'b3333333-0000-0000-0000-000000000001'),
          1, 'uma contratacao criada');
select is((select valor_total from public.contratacoes where proposta_id = 'b3333333-0000-0000-0000-000000000001'),
          450.00, 'valor_total = valor da proposta');
select is((select status::text from public.demandas_servico where id = 'd3333333-0000-0000-0000-000000000001'),
          'CONTRATADA', 'demanda CONTRATADA');
select is((select count(*)::int from public.mensagens
             where conversa_id = 'a3333333-0000-0000-0000-000000000001' and tipo = 'CONTRATO_GERADO'),
          1, 'mensagem CONTRATO_GERADO inserida');
select is((select count(*)::int from public.notificacoes
             where usuario_id = tests.get_supabase_uid('t3_pre') and tipo = 'CONTRATACAO'),
          1, 'notificacao para o prestador');

-- (4) idempotencia
select is(
  (select public.fn_aceitar_proposta('b3333333-0000-0000-0000-000000000001')),
  (select id from public.contratacoes where proposta_id = 'b3333333-0000-0000-0000-000000000001'),
  '2a chamada retorna a mesma contratacao');
select is((select count(*)::int from public.contratacoes where proposta_id = 'b3333333-0000-0000-0000-000000000001'),
          1, 'sem 2a contratacao');

-- (5) conflito: aceitar a irma ja RECUSADA
select throws_ok(
  $$ select public.fn_aceitar_proposta('b3333333-0000-0000-0000-000000000002') $$,
  'PT409', null, 'aceitar proposta RECUSADA (PT409)');

-- (6) recusar: cliente recusa; nao-cliente nao
select lives_ok(
  $$ select public.fn_recusar_proposta('b3333333-0000-0000-0000-000000000002') $$,
  'fn_recusar_proposta idempotente em proposta ja RECUSADA');

select * from finish();
rollback;
```

> Ajustar `plan(N)` ao número real de asserts. `categoria_servico` colunas: confirmar nomes.

- [ ] **Step 2: Rodar e confirmar falha**

```bash
set -a && . ./.env && set +a
node supabase/tests/run.mjs 2>&1 | grep 0024
```
Esperado: `✗` (`function public.fn_aceitar_proposta does not exist`).

- [ ] **Step 3: Escrever a migration**

`supabase/migrations/<TS3>_fn_propostas.sql`:

```sql
-- Plano 4 — logica transacional de proposta. SECURITY DEFINER: ignora RLS
-- (nenhuma tabela tem FORCE RLS) e pode escrever em contratacoes/notificacoes.

create or replace function public.fn_recusar_proposta(p_proposta_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prop public.propostas%rowtype;
begin
  select * into v_prop from public.propostas where id = p_proposta_id for update;
  if not found then
    raise exception 'proposta_inexistente' using errcode = 'PT404';
  end if;
  if (select auth.uid()) is distinct from v_prop.cliente_id then
    raise exception 'nao_autorizado' using errcode = 'PT401';
  end if;
  if v_prop.status = 'RECUSADA' then
    return;
  end if;
  if v_prop.status not in ('ENVIADA', 'VISUALIZADA') then
    raise exception 'proposta_indisponivel' using errcode = 'PT409';
  end if;
  update public.propostas set status = 'RECUSADA' where id = p_proposta_id;
end;
$$;

create or replace function public.fn_aceitar_proposta(p_proposta_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prop        public.propostas%rowtype;
  v_titulo      text;
  v_contratacao uuid;
begin
  select * into v_prop from public.propostas where id = p_proposta_id for update;
  if not found then
    raise exception 'proposta_inexistente' using errcode = 'PT404';
  end if;

  if (select auth.uid()) is distinct from v_prop.cliente_id then
    raise exception 'nao_autorizado' using errcode = 'PT401';
  end if;

  -- idempotencia
  if v_prop.status = 'ACEITA' then
    return (select id from public.contratacoes where proposta_id = p_proposta_id);
  end if;

  if v_prop.status not in ('ENVIADA', 'VISUALIZADA') then
    raise exception 'proposta_indisponivel' using errcode = 'PT409';
  end if;

  update public.propostas set status = 'ACEITA' where id = p_proposta_id;

  if v_prop.demanda_id is not null then
    update public.propostas
      set status = 'RECUSADA'
      where demanda_id = v_prop.demanda_id
        and id <> p_proposta_id
        and status in ('ENVIADA', 'VISUALIZADA');

    select titulo into v_titulo from public.demandas_servico where id = v_prop.demanda_id;
  end if;

  v_titulo := left(coalesce(nullif(v_titulo, ''), nullif(v_prop.descricao, ''), 'Serviço contratado'), 120);

  begin
    insert into public.contratacoes
      (proposta_id, demanda_id, titulo_servico, cliente_id, prestador_id, valor_total)
    values
      (p_proposta_id, v_prop.demanda_id, v_titulo, v_prop.cliente_id, v_prop.prestador_id, v_prop.valor)
    returning id into v_contratacao;
  exception when unique_violation then
    -- corrida: outra transacao ja contratou esta proposta
    raise exception 'proposta_indisponivel' using errcode = 'PT409';
  end;

  if v_prop.demanda_id is not null then
    update public.demandas_servico set status = 'CONTRATADA' where id = v_prop.demanda_id;
  end if;

  insert into public.mensagens (conversa_id, remetente_id, tipo, corpo, proposta_id)
  values (v_prop.conversa_id, v_prop.prestador_id, 'CONTRATO_GERADO', 'Contrato gerado', p_proposta_id);

  insert into public.notificacoes (usuario_id, titulo, mensagem, tipo, referencia_id)
  values (v_prop.prestador_id, 'Proposta aceita',
          'Sua proposta foi aceita. O contrato foi gerado.', 'CONTRATACAO', v_contratacao);

  return v_contratacao;
end;
$$;

revoke execute on function public.fn_recusar_proposta(uuid) from public, anon;
revoke execute on function public.fn_aceitar_proposta(uuid) from public, anon;
grant execute on function public.fn_recusar_proposta(uuid) to authenticated;
grant execute on function public.fn_aceitar_proposta(uuid) to authenticated;
```

- [ ] **Step 4: Aplicar e rodar**

```bash
set -a && . ./.env && set +a
pnpm db:push
node supabase/tests/run.mjs 2>&1 | grep 0024
```
Esperado: `✓ 0024_fn_propostas.test.sql — N ok`. Iterar até verde sem afrouxar asserts.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/<TS3>_fn_propostas.sql supabase/tests/0024_fn_propostas.test.sql
git commit -m "feat(db): fn_aceitar_proposta e fn_recusar_proposta (Plano 4)"
```

---

## Task 4: Publicação realtime de `mensagens` e `conversas`

**Files:**
- Create: `supabase/migrations/<TS4>_realtime_chat.sql`
- Test: `supabase/tests/0025_realtime_chat.test.sql`

**Interfaces:**
- Produces: `public.mensagens` e `public.conversas` na publicação `supabase_realtime` (eventos `postgres_changes` passam a fluir para clientes; o RLS de `SELECT` já vigente filtra por participante).

- [ ] **Step 1: Escrever o teste pgTAP que falha**

`supabase/tests/0025_realtime_chat.test.sql`:

```sql
begin;
select plan(2);

select is(
  (select count(*)::int from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mensagens'),
  1, 'mensagens esta na publicacao supabase_realtime');

select is(
  (select count(*)::int from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversas'),
  1, 'conversas esta na publicacao supabase_realtime');

select * from finish();
rollback;
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
set -a && . ./.env && set +a
node supabase/tests/run.mjs 2>&1 | grep 0025
```
Esperado: `✗ 0025` (`0` linhas).

- [ ] **Step 3: Escrever a migration**

`supabase/migrations/<TS4>_realtime_chat.sql`:

```sql
-- Plano 4 — habilita realtime para o chat. So consumimos INSERT (mensagens)
-- e INSERT/UPDATE (conversas); replica identity default basta.
-- A publicacao supabase_realtime e criada pelo Supabase; adicionar tabela e idempotente
-- via checagem, mas ALTER PUBLICATION ADD TABLE falha se ja existir -> guardar.

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mensagens'
  ) then
    execute 'alter publication supabase_realtime add table public.mensagens';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversas'
  ) then
    execute 'alter publication supabase_realtime add table public.conversas';
  end if;
end
$$;
```

- [ ] **Step 4: Aplicar e rodar**

```bash
set -a && . ./.env && set +a
pnpm db:push
node supabase/tests/run.mjs 2>&1 | grep 0025
```
Esperado: `✓ 0025_realtime_chat.test.sql — 2 ok`.

- [ ] **Step 5: Rodar a suíte pgTAP inteira + regenerar tipos**

```bash
set -a && . ./.env && set +a
node supabase/tests/run.mjs            # tudo verde, incl. 0022–0025
pnpm db:types                          # regenera packages/db-types/index.ts
```
Conferir no diff de `packages/db-types/index.ts` que `Database["public"]["Functions"]` ganhou `fn_aceitar_proposta` (`Args: { p_proposta_id: string }; Returns: string`) e `fn_recusar_proposta` (`Returns: undefined`).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/<TS4>_realtime_chat.sql supabase/tests/0025_realtime_chat.test.sql packages/db-types/index.ts
git commit -m "feat(db): realtime para mensagens e conversas + regen db-types (Plano 4)"
```

---

## Task 5: `normalizarErro` — SQLSTATEs de negócio `PT401/PT404/PT409`

**Files:**
- Modify: `apps/mobile/src/shared/api/repositories/types.ts` (função `classificar`)
- Test: `apps/mobile/src/shared/api/repositories/types.test.ts` (criar se não existir; senão adicionar casos)

**Interfaces:**
- Consumes: nada novo.
- Produces: `normalizarErro({ code: 'PT401' })` → `RepoError` com `code: 'nao_autorizado'`; `'PT404'` → `'nao_encontrado'`; `'PT409'` → `'conflito'`. Nenhuma mudança em `CodigoRepo` (os três já existem).

- [ ] **Step 1: Escrever o teste que falha**

Em `apps/mobile/src/shared/api/repositories/types.test.ts`:

```ts
import { normalizarErro } from "./types";

it.each([
  ["PT401", "nao_autorizado"],
  ["PT404", "nao_encontrado"],
  ["PT409", "conflito"],
] as const)("mapeia SQLSTATE de negocio %s -> %s", (code, esperado) => {
  expect(normalizarErro({ code, message: "erro plpgsql" }).code).toBe(esperado);
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `pnpm --filter @servico-feito/mobile test -- types.test`
Esperado: FAIL (`desconhecido` no lugar dos três).

- [ ] **Step 3: Implementar**

Em `types.ts`, dentro de `classificar`, logo após `if (code === "PGRST116") return "nao_encontrado";`:

```ts
    if (code === "PT401") return "nao_autorizado";
    if (code === "PT404") return "nao_encontrado";
    if (code === "PT409") return "conflito";
```

- [ ] **Step 4: Rodar e confirmar verde**

Run: `pnpm --filter @servico-feito/mobile test -- types.test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/shared/api/repositories/types.ts apps/mobile/src/shared/api/repositories/types.test.ts
git commit -m "feat(mobile): normalizarErro mapeia PT401/PT404/PT409 das RPCs (Plano 4)"
```

---

## Task 6: Tipos de domínio de conversa e proposta

**Files:**
- Create: `apps/mobile/src/features/conversas/types/conversa.types.ts`
- Create: `apps/mobile/src/features/propostas/types/proposta.types.ts`
- Test: (sem teste — só tipos; validado pelo `tsc` das tasks seguintes)

**Interfaces:**
- Produces:

```ts
// conversa.types.ts
export type TipoConversa = "DEMANDA" | "DIRETA";

export interface Conversa {
  id: string;
  tipo: TipoConversa;
  demandaId: string | null;
  clienteId: string;
  prestadorId: string;
  status: string;
  ultimaMensagem: string | null;
  dataUltimaMensagem: string | null;
  naoLidas: number;          // já resolvido para o papel do usuário atual
  outroId: string;
  outroNome: string | null;
  outroFotoUrl: string | null;
  createdAt: string;
}

export interface Mensagem {
  id: string;
  conversaId: string;
  remetenteId: string;
  tipo: string;             // TEXTO | PROPOSTA | CONTRATO_GERADO | ...
  corpo: string;
  propostaId: string | null;
  lida: boolean;
  createdAt: string;
}
```

```ts
// proposta.types.ts
export interface Proposta {
  id: string;
  demandaId: string | null;
  conversaId: string;
  prestadorId: string;
  clienteId: string;
  valor: number;
  taxaPlataforma: number | null;
  valorLiquidoPrestador: number | null;
  descricao: string;
  prazoExecucao: string | null;
  validadeDias: number;
  status: string;
  createdAt: string;
}

export interface NovaProposta {
  conversaId: string;
  demandaId: string | null;
  clienteId: string;
  prestadorId: string;
  valor: number;
  descricao: string;
  prazoExecucao: string | null;
  validadeDias: number;
}
```

- [ ] **Step 1: Criar os dois arquivos** com exatamente o conteúdo acima.
- [ ] **Step 2: Verificar tipo**: `pnpm --filter @servico-feito/mobile exec tsc --noEmit` → 0 erros.
- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/conversas/types/conversa.types.ts apps/mobile/src/features/propostas/types/proposta.types.ts
git commit -m "feat(mobile): tipos de dominio de conversa e proposta (Plano 4)"
```

---

## Task 7: `conversasRepository`

**Files:**
- Create: `apps/mobile/src/shared/api/repositories/conversas/conversasRepository.ts`
- Create: `apps/mobile/src/shared/api/repositories/conversas/conversasRepository.supabase.ts`
- Modify: `apps/mobile/src/shared/api/repositories/index.ts`
- Test: `apps/mobile/src/shared/api/repositories/conversas/conversasRepository.supabase.test.ts`

**Interfaces:**
- Consumes: `supabase` de `@/shared/api/supabaseClient`; `normalizarErro`, `RepoError` de `../types`; `Conversa` de `@/features/conversas/types/conversa.types`.
- Produces:

```ts
export interface ConversasRepository {
  listarMinhas(usuarioId: string): Promise<Conversa[]>;
  obter(id: string, usuarioId: string): Promise<Conversa>;
  iniciarDireta(clienteId: string, prestadorId: string): Promise<{ id: string }>;
  iniciarDemanda(demandaId: string, prestadorId: string): Promise<{ id: string }>;
}
```
Exportado no barrel como `repositories.conversas`.

**Regras de implementação:**
- `SELECT_CONVERSA = "id, tipo, demanda_id, cliente_id, prestador_id, status, ultima_mensagem, data_ultima_mensagem, nao_lidas_cliente, nao_lidas_prestador, created_at"`.
- `paraConversa(l, usuarioId, outro)` mapeia a linha: `naoLidas = usuarioId === l.cliente_id ? l.nao_lidas_cliente : l.nao_lidas_prestador`; `outroId = usuarioId === l.cliente_id ? l.prestador_id : l.cliente_id`; `outroNome`/`outroFotoUrl` vêm de `outro` (linha de `perfis_publicos` ou `null`).
- `listarMinhas`:
  ```ts
  const { data, error } = await supabase
    .from("conversas")
    .select(SELECT_CONVERSA)
    .or(`cliente_id.eq.${usuarioId},prestador_id.eq.${usuarioId}`)
    .order("data_ultima_mensagem", { ascending: false, nullsFirst: false });
  if (error) throw normalizarErro(error);
  const linhas = (data ?? []) as LinhaConversa[];
  const outrosIds = linhas.map((l) => (l.cliente_id === usuarioId ? l.prestador_id : l.cliente_id));
  const mapaOutros = await carregarOutros(outrosIds);  // Map<id, { nome; foto_perfil_url }>
  return linhas.map((l) => paraConversa(l, usuarioId, mapaOutros.get(...) ?? null));
  ```
  `carregarOutros(ids)`: se `ids.length === 0` → `new Map()`; senão `supabase.from("perfis_publicos").select("usuario_id, nome, foto_perfil_url").in("usuario_id", [...new Set(ids)])`; erro aqui **não** propaga (retorna Map vazio) — nome cai para `null`.
- `obter(id, usuarioId)`: `select(SELECT_CONVERSA).eq("id", id).single()`; erro → `normalizarErro`; resolve o "outro" com 1 `maybeSingle` em `perfis_publicos`.
- `iniciarDireta(clienteId, prestadorId)`:
  ```ts
  const achar = () => supabase.from("conversas").select("id")
    .eq("tipo", "DIRETA").eq("cliente_id", clienteId).eq("prestador_id", prestadorId).maybeSingle();
  const { data: existente } = await achar();
  if (existente) return { id: (existente as { id: string }).id };
  const { data, error } = await supabase.from("conversas")
    .insert({ tipo: "DIRETA", cliente_id: clienteId, prestador_id: prestadorId, demanda_id: null })
    .select("id").single();
  if (error) {
    const err = normalizarErro(error);
    if (err.code === "conflito") {                 // corrida: alguém criou entre o achar() e o insert
      const { data: dep } = await achar();
      if (dep) return { id: (dep as { id: string }).id };
    }
    throw err;
  }
  return { id: (data as { id: string }).id };
  ```
  Tudo dentro de `try { … } catch (e) { throw normalizarErro(e) }`.
- `iniciarDemanda(demandaId, prestadorId)`: primeiro `const { data: dem, error: e1 } = await supabase.from("demandas_servico").select("cliente_id").eq("id", demandaId).single();` (`e1` → `normalizarErro`); depois find-or-create igual ao `iniciarDireta` mas com `tipo: "DEMANDA"`, `demanda_id: demandaId`, `cliente_id: dem.cliente_id`, e o `achar()` filtra `.eq("tipo","DEMANDA").eq("demanda_id", demandaId).eq("prestador_id", prestadorId)`.

- [ ] **Step 1: Escrever o teste que falha**

`conversasRepository.supabase.test.ts` (seguir o estilo de `demandasRepository.supabase.test.ts` — `require("@/shared/api/supabaseClient").supabase`, `jest.spyOn(supa, "from")`):

```ts
import { conversasRepositorySupabase } from "./conversasRepository.supabase";

const supa = require("@/shared/api/supabaseClient").supabase;

function linhaConversa(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "a1", tipo: "DIRETA", demanda_id: null, cliente_id: "u1", prestador_id: "u2",
    status: "ATIVA", ultima_mensagem: "oi", data_ultima_mensagem: "2026-03-03T00:00:00Z",
    nao_lidas_cliente: 2, nao_lidas_prestador: 0, created_at: "2026-03-01T00:00:00Z", ...over,
  };
}
/** chain select/eq/or/order/in/maybeSingle/single que resolve com `res`. */
function chain(res: { data: unknown; error: unknown }) {
  const q: Record<string, jest.Mock> = {};
  for (const m of ["select", "eq", "or", "order", "in", "insert"]) q[m] = jest.fn(() => q);
  q.order = jest.fn().mockResolvedValue(res);
  q.in = jest.fn().mockResolvedValue(res);
  q.single = jest.fn().mockResolvedValue(res);
  q.maybeSingle = jest.fn().mockResolvedValue(res);
  return q;
}

it("listarMinhas mapeia naoLidas pelo papel e resolve o outro em perfis_publicos", async () => {
  const conv = chain({ data: [linhaConversa()], error: null });
  const perfis = chain({ data: [{ usuario_id: "u2", nome: "Bia", foto_perfil_url: null }], error: null });
  jest.spyOn(supa, "from").mockImplementation(((t: string) =>
    t === "perfis_publicos" ? perfis : conv) as never);

  const r = await conversasRepositorySupabase.listarMinhas("u1");
  expect(r[0]?.naoLidas).toBe(2);          // u1 é cliente
  expect(r[0]?.outroId).toBe("u2");
  expect(r[0]?.outroNome).toBe("Bia");
});

it("iniciarDireta acha a conversa existente e não insere", async () => {
  const q = chain({ data: { id: "a9" }, error: null });
  const fromSpy = jest.spyOn(supa, "from").mockReturnValue(q as never);
  const r = await conversasRepositorySupabase.iniciarDireta("u1", "u2");
  expect(r).toEqual({ id: "a9" });
  expect(q.insert).not.toHaveBeenCalled();
  fromSpy.mockRestore();
});

it("iniciarDireta insere quando não existe", async () => {
  let call = 0;
  jest.spyOn(supa, "from").mockImplementation((() => {
    call += 1;
    return call === 1
      ? chain({ data: null, error: null })          // achar() -> nada
      : chain({ data: { id: "nova" }, error: null }); // insert().select().single()
  }) as never);
  const r = await conversasRepositorySupabase.iniciarDireta("u1", "u2");
  expect(r).toEqual({ id: "nova" });
});

it("iniciarDireta trata corrida (23505) re-selecionando", async () => {
  let call = 0;
  jest.spyOn(supa, "from").mockImplementation((() => {
    call += 1;
    if (call === 1) return chain({ data: null, error: null });
    if (call === 2) return chain({ data: null, error: { code: "23505", message: "dup" } });
    return chain({ data: { id: "venceu" }, error: null });
  }) as never);
  const r = await conversasRepositorySupabase.iniciarDireta("u1", "u2");
  expect(r).toEqual({ id: "venceu" });
});

it("iniciarDemanda lê cliente_id da demanda antes do find-or-create", async () => {
  const seq = [
    chain({ data: { cliente_id: "u1" }, error: null }),   // demandas_servico
    chain({ data: { id: "conv-dem" }, error: null }),      // achar()
  ];
  let i = 0;
  jest.spyOn(supa, "from").mockImplementation((() => seq[i++]!) as never);
  const r = await conversasRepositorySupabase.iniciarDemanda("d1", "u2");
  expect(r).toEqual({ id: "conv-dem" });
});
```

- [ ] **Step 2: Rodar e confirmar falha** — `pnpm --filter @servico-feito/mobile test -- conversasRepository` → FAIL (módulo não existe).
- [ ] **Step 3: Criar a interface** `conversasRepository.ts` com o bloco de **Interfaces** acima.
- [ ] **Step 4: Implementar** `conversasRepository.supabase.ts` seguindo as **Regras de implementação**. Adicionar ao barrel `index.ts`:
  ```ts
  import { conversasRepositorySupabase } from "./conversas/conversasRepository.supabase";
  // ... dentro de `repositories`:
  conversas: conversasRepositorySupabase,
  // ... e:
  export type { ConversasRepository } from "./conversas/conversasRepository";
  ```
- [ ] **Step 5: Rodar e confirmar verde** — `pnpm --filter @servico-feito/mobile test -- conversasRepository` → PASS. `tsc --noEmit` → 0.
- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/shared/api/repositories/conversas apps/mobile/src/shared/api/repositories/index.ts
git commit -m "feat(mobile): conversasRepository com find-or-create (Plano 4)"
```

---

## Task 8: `mensagensRepository`

**Files:**
- Create: `apps/mobile/src/shared/api/repositories/mensagens/mensagensRepository.ts`
- Create: `apps/mobile/src/shared/api/repositories/mensagens/mensagensRepository.supabase.ts`
- Modify: `apps/mobile/src/shared/api/repositories/index.ts`
- Test: `apps/mobile/src/shared/api/repositories/mensagens/mensagensRepository.supabase.test.ts`

**Interfaces:**
- Consumes: `supabase`, `normalizarErro`, `PageParams`, `Pagina` de `../types`; `Mensagem` de `@/features/conversas/types/conversa.types`.
- Produces:

```ts
export interface MensagensRepository {
  listar(conversaId: string, page: PageParams): Promise<Pagina<Mensagem>>;
  enviarTexto(conversaId: string, corpo: string, remetenteId: string): Promise<Mensagem>;
  marcarLidas(conversaId: string, usuarioId: string, papel: "CLIENTE" | "PRESTADOR"): Promise<void>;
}
```
Exportado como `repositories.mensagens`.

**Regras de implementação:**
- `SELECT_MSG = "id, conversa_id, remetente_id, tipo, corpo, proposta_id, lida, created_at"`.
- `paraMensagem(l)` → camelCase.
- `listar` — keyset **descendente** (mais nova primeiro):
  ```ts
  let q = supabase.from("mensagens").select(SELECT_MSG)
    .eq("conversa_id", conversaId)
    .order("created_at", { ascending: false });
  if (page.cursor) q = q.lt("created_at", page.cursor);
  const { data, error } = await q.limit(page.limite + 1);
  if (error) throw normalizarErro(error);
  const linhas = (data ?? []) as LinhaMsg[];
  const temMais = linhas.length > page.limite;
  const itens = linhas.slice(0, page.limite).map(paraMensagem);
  const proximoCursor = temMais ? (itens[itens.length - 1]?.createdAt ?? null) : null;
  return { itens, proximoCursor };
  ```
- `enviarTexto(conversaId, corpo, remetenteId)`:
  ```ts
  const { data, error } = await supabase.from("mensagens")
    .insert({ conversa_id: conversaId, remetente_id: remetenteId, tipo: "TEXTO", corpo })
    .select(SELECT_MSG).single();
  if (error) throw normalizarErro(error);
  return paraMensagem(data as LinhaMsg);
  ```
- `marcarLidas(conversaId, usuarioId, papel)` — duas escritas, sem transação:
  ```ts
  const { error: e1 } = await supabase.from("mensagens")
    .update({ lida: true })
    .eq("conversa_id", conversaId).eq("lida", false).neq("remetente_id", usuarioId);
  if (e1) throw normalizarErro(e1);
  const coluna = papel === "CLIENTE" ? "nao_lidas_cliente" : "nao_lidas_prestador";
  const { error: e2 } = await supabase.from("conversas")
    .update({ [coluna]: 0 }).eq("id", conversaId);
  if (e2) throw normalizarErro(e2);
  ```

- [ ] **Step 1: Escrever o teste que falha** — cobrir: `listar` monta `proximoCursor` quando vêm `limite+1` e `null` quando não; `listar` só chama `.lt` com cursor; `enviarTexto` insere `tipo:'TEXTO'` + `remetente_id` = argumento e devolve a linha mapeada; `marcarLidas('CLIENTE')` faz `update` em `mensagens` (`neq remetente_id`, `eq lida false`) **e** `update({ nao_lidas_cliente: 0 })` em `conversas`. Estilo `demandasRepository.supabase.test.ts` (`mockQuery` que encadeia `select/eq/lt/limit/order` e resolve; para `update` encadear `update→eq→eq→neq` resolvendo `{ error: null }`).

```ts
it("marcarLidas zera a coluna do papel e marca mensagens do outro", async () => {
  const msgU = { update: jest.fn(() => msgU), eq: jest.fn(() => msgU), neq: jest.fn().mockResolvedValue({ error: null }) };
  const convU = { update: jest.fn(() => convU), eq: jest.fn().mockResolvedValue({ error: null }) };
  jest.spyOn(supa, "from").mockImplementation(((t: string) => (t === "conversas" ? convU : msgU)) as never);
  await mensagensRepositorySupabase.marcarLidas("a1", "u1", "CLIENTE");
  expect(msgU.update).toHaveBeenCalledWith({ lida: true });
  expect(msgU.neq).toHaveBeenCalledWith("remetente_id", "u1");
  expect(convU.update).toHaveBeenCalledWith({ nao_lidas_cliente: 0 });
});
```

- [ ] **Step 2: Rodar e confirmar falha** — `pnpm --filter @servico-feito/mobile test -- mensagensRepository` → FAIL.
- [ ] **Step 3: Criar a interface + impl + barrel** (`repositories.mensagens`, `export type { MensagensRepository }`).
- [ ] **Step 4: Rodar e confirmar verde** + `tsc --noEmit` 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/shared/api/repositories/mensagens apps/mobile/src/shared/api/repositories/index.ts
git commit -m "feat(mobile): mensagensRepository (listar keyset, enviar, marcarLidas) (Plano 4)"
```

---

## Task 9: `propostasRepository`

**Files:**
- Create: `apps/mobile/src/shared/api/repositories/propostas/propostasRepository.ts`
- Create: `apps/mobile/src/shared/api/repositories/propostas/propostasRepository.supabase.ts`
- Modify: `apps/mobile/src/shared/api/repositories/index.ts`
- Test: `apps/mobile/src/shared/api/repositories/propostas/propostasRepository.supabase.test.ts`

**Interfaces:**
- Consumes: `supabase`, `normalizarErro` de `../types`; `Proposta`, `NovaProposta` de `@/features/propostas/types/proposta.types`.
- Produces:

```ts
export interface PropostasRepository {
  daConversa(conversaId: string): Promise<Proposta[]>;
  obter(id: string): Promise<Proposta>;
  criar(dados: NovaProposta): Promise<{ id: string }>;
  recusar(propostaId: string): Promise<void>;
  aceitar(propostaId: string): Promise<{ contratacaoId: string }>;
}
```
Exportado como `repositories.propostas`.

**Regras de implementação:**
- `SELECT_PROP = "id, demanda_id, conversa_id, prestador_id, cliente_id, valor, taxa_plataforma, valor_liquido_prestador, descricao, prazo_execucao, validade_dias, status, created_at"`.
- `paraProposta(l)` → camelCase; `valor`/`taxa_plataforma`/`valor_liquido_prestador` são `numeric` → chegam como `number` (o `supabase-js` já converte; se vier `string`, `Number(l.valor)`).
- `daConversa` — `select(SELECT_PROP).eq("conversa_id", conversaId).order("created_at", { ascending: true })`.
- `obter` — `.eq("id", id).single()`.
- `criar(dados)` — `insert` **sem** `status`:
  ```ts
  const row = {
    conversa_id: dados.conversaId, demanda_id: dados.demandaId,
    prestador_id: dados.prestadorId, cliente_id: dados.clienteId,
    valor: dados.valor, descricao: dados.descricao,
    prazo_execucao: dados.prazoExecucao, validade_dias: dados.validadeDias,
  };
  const { data, error } = await supabase.from("propostas").insert(row).select("id").single();
  if (error) throw normalizarErro(error);
  return { id: (data as { id: string }).id };
  ```
- `recusar(propostaId)` — RPC (o cliente não tem UPDATE em `propostas`):
  ```ts
  const { error } = await supabase.rpc("fn_recusar_proposta", { p_proposta_id: propostaId });
  if (error) throw normalizarErro(error);
  ```
- `aceitar(propostaId)`:
  ```ts
  const { data, error } = await supabase.rpc("fn_aceitar_proposta", { p_proposta_id: propostaId });
  if (error) throw normalizarErro(error);
  return { contratacaoId: data as string };
  ```

- [ ] **Step 1: Escrever o teste que falha** — cobrir: `criar` faz `insert` sem `status` e devolve `{ id }`; `recusar` chama `supabase.rpc("fn_recusar_proposta", { p_proposta_id })`; `aceitar` chama `supabase.rpc("fn_aceitar_proposta", …)` e devolve `{ contratacaoId }`; `aceitar` com `{ error: { code: "PT409" } }` rejeita com `code: "conflito"`; com `{ error: { code: "PT401" } }` rejeita `nao_autorizado`; `daConversa` mapeia lista.

```ts
it("aceitar chama a RPC e mapeia erro de negocio", async () => {
  const rpc = jest.spyOn(supa, "rpc").mockResolvedValue({ data: "contr-1", error: null } as never);
  const r = await propostasRepositorySupabase.aceitar("p1");
  expect(rpc).toHaveBeenCalledWith("fn_aceitar_proposta", { p_proposta_id: "p1" });
  expect(r).toEqual({ contratacaoId: "contr-1" });

  rpc.mockResolvedValue({ data: null, error: { code: "PT409", message: "indisponivel" } } as never);
  await expect(propostasRepositorySupabase.aceitar("p1")).rejects.toMatchObject({ code: "conflito" });
});
```

- [ ] **Step 2: Rodar e confirmar falha**.
- [ ] **Step 3: Criar interface + impl + barrel** (`repositories.propostas`, `export type { PropostasRepository }`).
- [ ] **Step 4: Rodar e confirmar verde** + `tsc --noEmit` 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/shared/api/repositories/propostas apps/mobile/src/shared/api/repositories/index.ts
git commit -m "feat(mobile): propostasRepository (criar direto, recusar/aceitar via RPC) (Plano 4)"
```

---

## Task 10: `useMensagensRealtime`

**Files:**
- Create: `apps/mobile/src/features/conversas/hooks/useMensagensRealtime.ts`
- Test: `apps/mobile/src/features/conversas/hooks/useMensagensRealtime.test.tsx`

**Interfaces:**
- Consumes: `supabase` de `@/shared/api/supabaseClient`; `queryClient` de `@/shared/query/queryClient`; `Mensagem` + o mapeador de linha (extrair `linhaParaMensagem(row: Record<string, unknown>): Mensagem` para um util reutilizável — colocar em `@/features/conversas/lib/linhaParaMensagem.ts` e reusar no repo? Não: manter simples — declarar `linhaParaMensagem` local no hook, com os mesmos campos que `paraMensagem` do repo).
- Produces: `useMensagensRealtime(conversaId: string): void`. Abre `supabase.channel(\`msgs:${conversaId}\`)`, escuta `postgres_changes` INSERT em `public.mensagens` com `filter: \`conversa_id=eq.${conversaId}\``, faz *prepend* na página 0 de `["mensagens", conversaId]` via `queryClient.setQueryData`, com dedup por `id`. No status `SUBSCRIBED`, `invalidateQueries(["mensagens", conversaId])`. `removeChannel` no cleanup.

**Código:**

```ts
import { useEffect } from "react";
import type { InfiniteData } from "@tanstack/react-query";
import { supabase } from "@/shared/api/supabaseClient";
import { queryClient } from "@/shared/query/queryClient";
import type { Pagina } from "@/shared/api/repositories";
import type { Mensagem } from "@/features/conversas/types/conversa.types";

function linhaParaMensagem(r: Record<string, unknown>): Mensagem {
  return {
    id: String(r.id),
    conversaId: String(r.conversa_id),
    remetenteId: String(r.remetente_id),
    tipo: String(r.tipo),
    corpo: typeof r.corpo === "string" ? r.corpo : "",
    propostaId: r.proposta_id == null ? null : String(r.proposta_id),
    lida: Boolean(r.lida),
    createdAt: String(r.created_at),
  };
}

export function useMensagensRealtime(conversaId: string): void {
  useEffect(() => {
    if (!conversaId) return;
    const chave = ["mensagens", conversaId] as const;
    const canal = supabase
      .channel(`msgs:${conversaId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensagens", filter: `conversa_id=eq.${conversaId}` },
        (payload) => {
          const nova = linhaParaMensagem(payload.new as Record<string, unknown>);
          queryClient.setQueryData<InfiniteData<Pagina<Mensagem>>>(chave, (prev) => {
            if (!prev || prev.pages.length === 0) return prev;
            if (prev.pages.some((pg) => pg.itens.some((m) => m.id === nova.id))) return prev;
            const [primeira, ...resto] = prev.pages;
            return {
              ...prev,
              pages: [{ ...primeira!, itens: [nova, ...primeira!.itens] }, ...resto],
            };
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          queryClient.invalidateQueries({ queryKey: chave });
        }
      });
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [conversaId]);
}
```

- [ ] **Step 1: Escrever o teste que falha**

`useMensagensRealtime.test.tsx`:

```ts
import { renderHook } from "@testing-library/react-native";

const handlers: Array<(p: unknown) => void> = [];
const subscribe = jest.fn((cb?: (s: string) => void) => { cb?.("SUBSCRIBED"); return canalFake; });
const canalFake = {
  on: jest.fn((_e: string, _f: unknown, h: (p: unknown) => void) => { handlers.push(h); return canalFake; }),
  subscribe,
};
jest.mock("@/shared/api/supabaseClient", () => ({
  supabase: { channel: jest.fn(() => canalFake), removeChannel: jest.fn() },
}));
const setQueryData = jest.fn();
const invalidateQueries = jest.fn();
jest.mock("@/shared/query/queryClient", () => ({ queryClient: { setQueryData: (...a: unknown[]) => setQueryData(...a), invalidateQueries: (...a: unknown[]) => invalidateQueries(...a) } }));

import { supabase } from "@/shared/api/supabaseClient";
import { useMensagensRealtime } from "./useMensagensRealtime";

beforeEach(() => { jest.clearAllMocks(); handlers.length = 0; });

it("assina o canal da conversa e invalida no SUBSCRIBED", () => {
  renderHook(() => useMensagensRealtime("a1"));
  expect((supabase.channel as jest.Mock)).toHaveBeenCalledWith("msgs:a1");
  expect(canalFake.on).toHaveBeenCalledWith(
    "postgres_changes",
    expect.objectContaining({ event: "INSERT", table: "mensagens", filter: "conversa_id=eq.a1" }),
    expect.any(Function),
  );
  expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["mensagens", "a1"] });
});

it("prepend na pagina 0 via setQueryData, com dedup por id", () => {
  renderHook(() => useMensagensRealtime("a1"));
  const h = handlers[0]!;
  h({ new: { id: "m2", conversa_id: "a1", remetente_id: "u2", tipo: "TEXTO", corpo: "oi", proposta_id: null, lida: false, created_at: "2026-03-03T00:00:05Z" } });
  const updater = setQueryData.mock.calls[0]![1] as (p: unknown) => unknown;
  const prev = { pageParams: [undefined], pages: [{ itens: [{ id: "m1" }], proximoCursor: null }] };
  const depois = updater(prev) as { pages: Array<{ itens: Array<{ id: string }> }> };
  expect(depois.pages[0]!.itens.map((m) => m.id)).toEqual(["m2", "m1"]);
  expect(updater({ pageParams: [undefined], pages: [{ itens: [{ id: "m2" }], proximoCursor: null }] })).toEqual({ pageParams: [undefined], pages: [{ itens: [{ id: "m2" }], proximoCursor: null }] });
});

it("removeChannel no unmount", () => {
  const { unmount } = renderHook(() => useMensagensRealtime("a1"));
  unmount();
  expect((supabase.removeChannel as jest.Mock)).toHaveBeenCalledWith(canalFake);
});
```

- [ ] **Step 2: Rodar e confirmar falha** — `pnpm --filter @servico-feito/mobile test -- useMensagensRealtime` → FAIL.
- [ ] **Step 3: Implementar** com o código acima.
- [ ] **Step 4: Rodar e confirmar verde** + `tsc --noEmit` 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/conversas/hooks/useMensagensRealtime.ts apps/mobile/src/features/conversas/hooks/useMensagensRealtime.test.tsx
git commit -m "feat(mobile): useMensagensRealtime — prepend + dedup no cache (Plano 4)"
```

---

## Task 11: `useConversasRealtime`

**Files:**
- Create: `apps/mobile/src/features/conversas/hooks/useConversasRealtime.ts`
- Test: `apps/mobile/src/features/conversas/hooks/useConversasRealtime.test.tsx`

**Interfaces:**
- Consumes: `supabase`, `queryClient`, `useAuthStore` (`s.usuarioId`).
- Produces: `useConversasRealtime(): void`. Sem `usuarioId` → não abre canal. Com `usuarioId` → `supabase.channel(\`conversas:${usuarioId}\`)` com **dois** `.on("postgres_changes", { event: "*", schema: "public", table: "conversas", filter: \`cliente_id=eq.${usuarioId}\` }, bump)` e o análogo com `prestador_id`. `bump = () => queryClient.invalidateQueries({ queryKey: ["conversas", "minhas"] })`. `removeChannel` no cleanup. `useEffect` deps `[usuarioId]`.

**Código:**

```ts
import { useEffect } from "react";
import { supabase } from "@/shared/api/supabaseClient";
import { queryClient } from "@/shared/query/queryClient";
import { useAuthStore } from "@/shared/store/authStore";

export function useConversasRealtime(): void {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  useEffect(() => {
    if (!usuarioId) return;
    const bump = () => queryClient.invalidateQueries({ queryKey: ["conversas", "minhas"] });
    const canal = supabase
      .channel(`conversas:${usuarioId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "conversas", filter: `cliente_id=eq.${usuarioId}` }, bump)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "conversas", filter: `prestador_id=eq.${usuarioId}` }, bump)
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [usuarioId]);
}
```

- [ ] **Step 1: Escrever o teste que falha** — mock de `supabase.channel` como na Task 10; mock de `useAuthStore` como seletor (`(sel) => sel({ usuarioId: "u1" })`); mock de `queryClient.invalidateQueries`. Casos: (a) `usuarioId` null → `channel` não chamado; (b) `usuarioId` "u1" → `channel("conversas:u1")`, `.on` chamado 2x com filtros `cliente_id=eq.u1` e `prestador_id=eq.u1`; disparar um handler → `invalidateQueries({ queryKey: ["conversas","minhas"] })`; (c) unmount → `removeChannel`.
- [ ] **Step 2: Rodar e confirmar falha**.
- [ ] **Step 3: Implementar**.
- [ ] **Step 4: Rodar e confirmar verde** + `tsc` 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/conversas/hooks/useConversasRealtime.ts apps/mobile/src/features/conversas/hooks/useConversasRealtime.test.tsx
git commit -m "feat(mobile): useConversasRealtime — invalida a lista (Plano 4)"
```

---

## Task 12: Hooks de leitura — `useMinhasConversas` e `useConversa`

**Files:**
- Create: `apps/mobile/src/features/conversas/hooks/useMinhasConversas.ts`
- Create: `apps/mobile/src/features/conversas/hooks/useConversa.ts`
- Test: `apps/mobile/src/features/conversas/hooks/conversasQueries.test.tsx`

**Interfaces:**
- Consumes: `repositories` de `@/shared/api/repositories`; `useAuthStore` (`s.usuarioId`).
- Produces:
  - `useMinhasConversas()` → `useQuery<Conversa[]>({ queryKey: ["conversas", "minhas"], queryFn: () => repositories.conversas.listarMinhas(usuarioId ?? ""), enabled: !!usuarioId })`.
  - `useConversa(id: string)` → `useQuery<Conversa>({ queryKey: ["conversa", id], queryFn: () => repositories.conversas.obter(id, usuarioId ?? ""), enabled: !!id && !!usuarioId })`.

- [ ] **Step 1: Escrever o teste que falha** — `jest.mock("@/shared/api/repositories", () => ({ repositories: { conversas: { listarMinhas: jest.fn(), obter: jest.fn() } } }))`; `jest.mock("@/shared/store/authStore", …)` seletor com `usuarioId: "u1"`; `criarWrapperQuery()`. Casos: `useMinhasConversas` chama `listarMinhas("u1")` e expõe `data`; `useConversa("a1")` chama `obter("a1", "u1")`.
- [ ] **Step 2: Rodar e confirmar falha**.
- [ ] **Step 3: Implementar** os dois hooks. `useAuthStore((s) => s.usuarioId)`.
- [ ] **Step 4: Rodar e confirmar verde** + `tsc` 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/conversas/hooks/useMinhasConversas.ts apps/mobile/src/features/conversas/hooks/useConversa.ts apps/mobile/src/features/conversas/hooks/conversasQueries.test.tsx
git commit -m "feat(mobile): hooks useMinhasConversas e useConversa (Plano 4)"
```

---

## Task 13: Hooks de mensagem — `useMensagensInfinite`, `useEnviarTexto`, `useMarcarLidas`

**Files:**
- Create: `apps/mobile/src/features/conversas/hooks/useMensagensInfinite.ts`
- Create: `apps/mobile/src/features/conversas/hooks/useEnviarTexto.ts`
- Create: `apps/mobile/src/features/conversas/hooks/useMarcarLidas.ts`
- Test: `apps/mobile/src/features/conversas/hooks/mensagensHooks.test.tsx`

**Interfaces:**
- Consumes: `repositories`; `queryClient`; `useAuthStore` (`s.usuarioId`); `useConversa` (para descobrir o papel em `useMarcarLidas`) — **ou** receber o papel por argumento. Decisão: `useMarcarLidas(conversaId: string)` lê a conversa do cache via `queryClient.getQueryData(["conversa", conversaId])` para achar o papel; se ausente, deriva de `useMinhasConversas` cache; se ainda ausente, no-op silencioso (a tela chama de novo quando a conversa carrega).
- Produces:
  - `LIMITE_MENSAGENS = 30`.
  - `useMensagensInfinite(conversaId: string)` → `useInfiniteQuery<Pagina<Mensagem>>({ queryKey: ["mensagens", conversaId], initialPageParam: undefined, queryFn: ({ pageParam }) => repositories.mensagens.listar(conversaId, { limite: LIMITE_MENSAGENS, cursor: pageParam as string | undefined }), getNextPageParam: (ultima) => ultima.proximoCursor ?? undefined, enabled: !!conversaId })`.
  - `useEnviarTexto(conversaId: string)` → `useMutation<Mensagem, unknown, string>({ mutationFn: (corpo) => repositories.mensagens.enviarTexto(conversaId, corpo, usuarioId ?? "") })`. **Sem `onSuccess`/invalidação** (realtime cobre).
  - `useMarcarLidas(conversaId: string)` → `useMutation<void, unknown, void>({ mutationFn: () => repositories.mensagens.marcarLidas(conversaId, usuarioId ?? "", papel), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["conversas", "minhas"] }); queryClient.setQueryData<Conversa>(["conversa", conversaId], (c) => c ? { ...c, naoLidas: 0 } : c); } })`.

- [ ] **Step 1: Escrever o teste que falha** — mock de `repositories`, `queryClient`, `authStore`. Seguir **Ruling R-F** no teste de `useMensagensInfinite` (2 páginas, `fetchNextPage()` sem `await`, `await waitFor(() => expect(result.current.hasNextPage).toBe(false))`, então `expect((repositories.mensagens.listar as jest.Mock).mock.calls[1][1]).toEqual({ limite: 30, cursor: "<proximoCursor da pág 0>" })`; `jest.clearAllMocks()` no `beforeEach`). `useEnviarTexto`: chama `enviarTexto(conversaId, "oi", "u1")` e **não** chama `invalidateQueries`. `useMarcarLidas`: `onSuccess` chama `invalidateQueries({ queryKey: ["conversas","minhas"] })`.
- [ ] **Step 2: Rodar e confirmar falha**.
- [ ] **Step 3: Implementar** os três hooks.
- [ ] **Step 4: Rodar e confirmar verde** + `tsc` 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/conversas/hooks/useMensagensInfinite.ts apps/mobile/src/features/conversas/hooks/useEnviarTexto.ts apps/mobile/src/features/conversas/hooks/useMarcarLidas.ts apps/mobile/src/features/conversas/hooks/mensagensHooks.test.tsx
git commit -m "feat(mobile): hooks de mensagem (infinite, enviar, marcar lidas) (Plano 4)"
```

---

## Task 14: Hooks de proposta — `usePropostasDaConversa`, `useCriarProposta`, `useRecusarProposta`, `useAceitarProposta`

**Files:**
- Create: `apps/mobile/src/features/propostas/hooks/usePropostasDaConversa.ts`
- Create: `apps/mobile/src/features/propostas/hooks/useCriarProposta.ts`
- Create: `apps/mobile/src/features/propostas/hooks/useRecusarProposta.ts`
- Create: `apps/mobile/src/features/propostas/hooks/useAceitarProposta.ts`
- Test: `apps/mobile/src/features/propostas/hooks/propostasHooks.test.tsx`

**Interfaces:**
- Consumes: `repositories`; `queryClient`; `useAuthStore` (`s.usuarioId`).
- Produces:
  - `usePropostasDaConversa(conversaId: string)` → `useQuery<Proposta[]>({ queryKey: ["propostas", "conversa", conversaId], queryFn: () => repositories.propostas.daConversa(conversaId), enabled: !!conversaId })`.
  - `useCriarProposta()` → `useMutation<{ id: string }, unknown, DadosNovaProposta>` onde `DadosNovaProposta = Omit<NovaProposta, "prestadorId">` (o `prestadorId` vem do `authStore`). `mutationFn: (d) => repositories.propostas.criar({ ...d, prestadorId: usuarioId ?? "" })`. `onSuccess: (_r, d) => queryClient.invalidateQueries({ queryKey: ["propostas", "conversa", d.conversaId] })`.
  - `useRecusarProposta(conversaId: string)` → `useMutation<void, unknown, string>({ mutationFn: (propostaId) => repositories.propostas.recusar(propostaId), onSuccess: () => queryClient.invalidateQueries({ queryKey: ["propostas", "conversa", conversaId] }) })`.
  - `useAceitarProposta(conversaId: string, demandaId: string | null)` → `useMutation<{ contratacaoId: string }, unknown, string>({ mutationFn: (propostaId) => repositories.propostas.aceitar(propostaId), onSuccess: () => { for (const chave of [["propostas","conversa",conversaId],["mensagens",conversaId],["conversa",conversaId],["conversas","minhas"],["demandas","abertas"]]) queryClient.invalidateQueries({ queryKey: chave }); if (demandaId) queryClient.invalidateQueries({ queryKey: ["demandas","detalhe",demandaId] }); } })`.

> Nota: confirmar a queryKey de detalhe da demanda no Plano 3 (`useDemanda`) — em `apps/mobile/src/features/demandas/hooks/useDemanda.ts`. Ajustar `["demandas","detalhe",demandaId]` para o valor real.

- [ ] **Step 1: Escrever o teste que falha** — mock de `repositories`, `queryClient`, `authStore`. Casos: `useCriarProposta` chama `criar` com `prestadorId: "u1"` mesclado e invalida `["propostas","conversa", <conversaId>]`; `useAceitarProposta` sucesso → `invalidateQueries` chamado ≥ 5x incluindo `["mensagens", "a1"]` e `["conversa", "a1"]`; erro (`mutationFn` rejeita `RepoError` `conflito`) → `result.current.isError` true e `invalidateQueries` não chamado.
- [ ] **Step 2: Rodar e confirmar falha**.
- [ ] **Step 3: Implementar** os quatro hooks.
- [ ] **Step 4: Rodar e confirmar verde** + `tsc` 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/propostas/hooks
git commit -m "feat(mobile): hooks de proposta (listar, criar, recusar, aceitar) (Plano 4)"
```

---

## Task 15: `ConversaRow` + `ConversasListScreen` (substitui o stub do shell)

**Files:**
- Create: `apps/mobile/src/features/conversas/components/ConversaRow.tsx`
- Create: `apps/mobile/src/features/conversas/screens/ConversasListScreen.tsx`
- Delete: `apps/mobile/src/features/shell/screens/ConversasListScreen.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/conversas.tsx` (apontar para o novo screen)
- Test: `apps/mobile/src/features/conversas/screens/ConversasListScreen.test.tsx`

**Interfaces:**
- Consumes: `useMinhasConversas`, `useConversasRealtime`; átomos `CarregandoEstado`/`ErroEstado`/`VazioEstado`; `traduzErroRepo`; `router` de `expo-router`.
- Produces: `export function ConversasListScreen()` — `FlatList` de `ConversaRow`; `isLoading` → `<CarregandoEstado/>`; `isError` → `<ErroEstado mensagem={traduzErroRepo(q.error)} onRetry={() => q.refetch()}/>`; `data.length === 0` → `<VazioEstado mensagem="Nenhuma conversa ainda." />`; row tap → `router.push(\`/conversa/${item.id}\`)`. `ConversaRow({ conversa }: { conversa: Conversa })` — nome do outro (`conversa.outroNome ?? "Usuário"`), `conversa.ultimaMensagem ?? ""`, e badge com `conversa.naoLidas` quando `> 0`.

- [ ] **Step 1: Escrever o teste que falha** — `jest.mock` de `useMinhasConversas` (retornando `{ data, isLoading, isError, refetch }`), de `useConversasRealtime` (no-op), de `expo-router` (`router.push`). Casos: (a) `isLoading` → texto do `CarregandoEstado`; (b) `data: []` → texto do `VazioEstado`; (c) `data: [conversa com naoLidas: 3]` → renderiza `outroNome` e o número `3`; tap na row chama `router.push("/conversa/a1")`; (d) `data: [conversa com naoLidas: 0]` → badge ausente.

> Confirmar textos/props exatos de `VazioEstado`/`ErroEstado`/`CarregandoEstado` em `apps/mobile/src/shared/components/molecules/`.

- [ ] **Step 2: Rodar e confirmar falha**.
- [ ] **Step 3: Implementar** `ConversaRow` e `ConversasListScreen`. Deletar `features/shell/screens/ConversasListScreen.tsx`. Atualizar `app/(app)/(tabs)/conversas.tsx`:
  ```tsx
  import { ConversasListScreen } from "@/features/conversas/screens/ConversasListScreen";
  export default function ConversasTab() {
    return <ConversasListScreen />;
  }
  ```
  (Conferir o conteúdo atual de `conversas.tsx` antes — pode já importar do shell; trocar o import.)
- [ ] **Step 4: Rodar e confirmar verde** — testes + `tsc` 0. `grep -rn "shell/screens/ConversasListScreen" apps/mobile` → sem resultados.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/conversas/components/ConversaRow.tsx apps/mobile/src/features/conversas/screens/ConversasListScreen.tsx apps/mobile/src/features/conversas/screens/ConversasListScreen.test.tsx "apps/mobile/app/(app)/(tabs)/conversas.tsx"
git rm apps/mobile/src/features/shell/screens/ConversasListScreen.tsx
git commit -m "feat(mobile): tela de lista de conversas com realtime (Plano 4)"
```

---

## Task 16: `BolhaMensagem` + `PropostaCard` + `ContratoGeradoCard`

**Files:**
- Create: `apps/mobile/src/features/conversas/components/BolhaMensagem.tsx`
- Create: `apps/mobile/src/features/propostas/components/PropostaCard.tsx`
- Create: `apps/mobile/src/features/propostas/components/ContratoGeradoCard.tsx`
- Test: `apps/mobile/src/features/propostas/components/PropostaCard.test.tsx`

**Interfaces:**
- `BolhaMensagem({ mensagem, meuId }: { mensagem: Mensagem; meuId: string })` — `View` alinhada (`items-end` quando `mensagem.remetenteId === meuId`, senão `items-start`), texto `mensagem.corpo`. Sem estado.
- `PropostaCard({ proposta, souCliente, onAceitar, onRecusar, erro, ocupado }: { proposta: Proposta; souCliente: boolean; onAceitar: () => void; onRecusar: () => void; erro?: string | null; ocupado?: boolean })` — mostra `R$ ${proposta.valor.toFixed(2)}`, `proposta.descricao`, `proposta.prazoExecucao ?? ""`, e o selo `proposta.status`. Se `souCliente && (proposta.status === "ENVIADA" || proposta.status === "VISUALIZADA")` → dois `Botao` (Aceitar/Recusar), desabilitados quando `ocupado`. `erro` renderiza em `<Text className="text-sf-status-red">` (confirmar token exato no `tailwind.config.js`/telas de auth do Plano 2).
- `ContratoGeradoCard({ valor }: { valor: number })` — `View` com "Contrato gerado" + `R$ ${valor.toFixed(2)}`.

- [ ] **Step 1: Escrever o teste que falha** (`PropostaCard.test.tsx`) — (a) `souCliente=true`, `status="ENVIADA"` → "Aceitar" e "Recusar" presentes; press chama `onAceitar`/`onRecusar`; (b) `souCliente=false` → botões ausentes, selo "ENVIADA" presente; (c) `status="ACEITA"` + `souCliente=true` → botões ausentes; (d) `erro="x"` → texto "x" presente.
- [ ] **Step 2: Rodar e confirmar falha**.
- [ ] **Step 3: Implementar** os três componentes. Usar `Botao` de `@/shared/components/atoms/` (confirmar caminho/props: `titulo`/`onPress`/`desabilitado` — ver uso no Plano 2/3).
- [ ] **Step 4: Rodar e confirmar verde** + `tsc` 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/conversas/components/BolhaMensagem.tsx apps/mobile/src/features/propostas/components
git commit -m "feat(mobile): BolhaMensagem, PropostaCard e ContratoGeradoCard (Plano 4)"
```

---

## Task 17: `ConversaScreen` + rota `conversa/[id].tsx`

**Files:**
- Create: `apps/mobile/src/features/conversas/screens/ConversaScreen.tsx`
- Create: `apps/mobile/app/(app)/conversa/[id].tsx`
- Test: `apps/mobile/src/features/conversas/screens/ConversaScreen.test.tsx`

**Interfaces:**
- Consumes: `useConversa`, `useMensagensInfinite`, `useMensagensRealtime`, `usePropostasDaConversa`, `useEnviarTexto`, `useMarcarLidas`, `useAceitarProposta`, `useRecusarProposta`; `useAuthStore` (`s.usuarioId`), `useUiModeStore` (`s.modo`); `useIsFocused` de `@react-navigation/native`; `router`/`useLocalSearchParams` de `expo-router`; `BolhaMensagem`, `PropostaCard`, `ContratoGeradoCard`; átomos de estado; `CampoTexto`/`Botao`.
- Produces: `export function ConversaScreen({ id }: { id: string })`.
  - `useMensagensRealtime(id)` sempre.
  - Lista: `FlatList` **`inverted`**, `data={(mensagensQuery.data?.pages ?? []).flatMap((p) => p.itens)}`, `keyExtractor={(m) => m.id}`, `onEndReached={() => { if (mensagensQuery.hasNextPage && !mensagensQuery.isFetchingNextPage) mensagensQuery.fetchNextPage(); }}`.
  - `renderItem` por `item.tipo`:
    - `"PROPOSTA"` → acha `proposta = propostasQuery.data?.find((p) => p.id === item.propostaId)`; se achou, `<PropostaCard proposta={proposta} souCliente={usuarioId === conversa?.clienteId} onAceitar={() => aceitar.mutate(item.propostaId!)} onRecusar={() => recusar.mutate(item.propostaId!)} erro={erroProposta(aceitar.error ?? recusar.error)} ocupado={aceitar.isPending || recusar.isPending} />`; se não achou → `<BolhaMensagem>` com "Proposta".
    - `"CONTRATO_GERADO"` → `proposta` por `item.propostaId`; `<ContratoGeradoCard valor={proposta?.valor ?? 0} />`.
    - senão → `<BolhaMensagem mensagem={item} meuId={usuarioId ?? ""} />`.
  - `useEffect` no mount e quando `mensagensQuery.data` muda **e** `isFocused` → `marcarLidas.mutate()` (guardar contra loop: só dispara se houver mensagem não-lida de outro remetente).
  - Rodapé: `CampoTexto` controlado (`useState`) + `Botao` "Enviar" → `enviar.mutate(texto)` e limpa `texto` no `onMutate`/após sucesso.
  - Cabeçalho (ou botão flutuante): quando `modo === "prestar" && usuarioId === conversa?.prestadorId` → `Botao` "Enviar proposta" → `router.push(\`/conversa/${id}/nova-proposta\`)`.
  - `erroProposta(e)` = helper local: `e instanceof RepoError` → texto por `code` no contexto proposta ("Só o cliente da demanda pode aceitar esta proposta." / "Esta proposta não está mais disponível." / "Proposta não encontrada." / genérico).
- `app/(app)/conversa/[id].tsx`:
  ```tsx
  import { useLocalSearchParams } from "expo-router";
  import { ConversaScreen } from "@/features/conversas/screens/ConversaScreen";
  export default function ConversaRoute() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return <ConversaScreen id={id ?? ""} />;
  }
  ```

- [ ] **Step 1: Escrever o teste que falha** (`ConversaScreen.test.tsx`, sem tocar em `app/`) — mockar todos os hooks citados. Casos:
  - `tipo:"PROPOSTA"` + `usuarioId` = `clienteId` + `status:"ENVIADA"` + `propostasQuery.data` com a proposta → "Aceitar" e "Recusar" presentes; press "Aceitar" chama `aceitar.mutate(<propostaId>)`.
  - `usuarioId` = `prestadorId` (não cliente) → sem "Aceitar".
  - `tipo:"CONTRATO_GERADO"` → texto "Contrato gerado" e o valor.
  - `modo:"prestar"` + `usuarioId` = `prestadorId` → botão "Enviar proposta" presente; `router.push("/conversa/a1/nova-proposta")` no press. `modo:"contratar"` → ausente.
  - digitar no campo + "Enviar" → `enviar.mutate("texto")`.
- [ ] **Step 2: Rodar e confirmar falha**.
- [ ] **Step 3: Implementar** `ConversaScreen` + a rota.
- [ ] **Step 4: Rodar e confirmar verde** — testes + `tsc` 0. (Rota em `app/` sem teste.)
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/conversas/screens/ConversaScreen.tsx apps/mobile/src/features/conversas/screens/ConversaScreen.test.tsx "apps/mobile/app/(app)/conversa/[id].tsx"
git commit -m "feat(mobile): tela de conversa (chat + propostas inline + realtime) (Plano 4)"
```

---

## Task 18: `NovaPropostaScreen` + rota + `useIniciarConversa`

**Files:**
- Create: `apps/mobile/src/features/propostas/screens/NovaPropostaScreen.tsx`
- Create: `apps/mobile/app/(app)/conversa/[id]/nova-proposta.tsx`
- Create: `apps/mobile/src/features/conversas/hooks/useIniciarConversa.ts`
- Test: `apps/mobile/src/features/propostas/screens/NovaPropostaScreen.test.tsx`
- Test: `apps/mobile/src/features/conversas/hooks/useIniciarConversa.test.tsx`

**Interfaces:**
- `useIniciarConversa()` → objeto `{ iniciarDireta(prestadorId): Promise<{ id: string }>, iniciarDemanda(demandaId, prestadorId): Promise<{ id: string }>, pendente: boolean }`. Implementar com `useMutation` interno OU funções async que chamam `repositories.conversas.*` com `clienteId`/ids do `authStore` e, no fim, `queryClient.invalidateQueries({ queryKey: ["conversas","minhas"] })`. `iniciarDireta` usa `usuarioId` como `clienteId`. `iniciarDemanda` passa só `demandaId` + `prestadorId` (o repo lê o `cliente_id` da demanda).
- `NovaPropostaScreen({ id }: { id: string })` (id = conversaId):
  - `useConversa(id)` → `demandaId`, `clienteId`, `prestadorId`.
  - Form (`useState`): `valor` (string numérica → `Number`), `descricao`, `prazoExecucao`, `validadeDias` (string, default `"7"`).
  - `Botao` "Enviar proposta" desabilitado quando `Number(valor) <= 0 || descricao.trim() === ""`.
  - Submit → `useCriarProposta().mutate({ conversaId: id, demandaId: conversa.demandaId, clienteId: conversa.clienteId, valor: Number(valor), descricao, prazoExecucao: prazoExecucao || null, validadeDias: Number(validadeDias) || 7 })`; `onSuccess` → `router.back()`.
  - Erro da mutation inline (`traduzErroRepo`).
- `app/(app)/conversa/[id]/nova-proposta.tsx`:
  ```tsx
  import { useLocalSearchParams } from "expo-router";
  import { NovaPropostaScreen } from "@/features/propostas/screens/NovaPropostaScreen";
  export default function NovaPropostaRoute() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return <NovaPropostaScreen id={id ?? ""} />;
  }
  ```

- [ ] **Step 1: Escrever os testes que falham**:
  - `useIniciarConversa.test.tsx` — mock `repositories.conversas` + `authStore` (`usuarioId: "u1"`) + `queryClient`. `iniciarDireta("u2")` chama `repositories.conversas.iniciarDireta("u1", "u2")` e devolve `{ id }`; `iniciarDemanda("d1","u2")` chama `repositories.conversas.iniciarDemanda("d1", "u2")`.
  - `NovaPropostaScreen.test.tsx` (estilo `CriarDemandaScreen.test.tsx`) — mock `expo-router` (`router.back`), `@/shared/api/repositories` (`propostas.criar` resolvido, `conversas.obter` resolvido com `{ demandaId: "d1", clienteId: "u1", prestadorId: "u2", … }`), `authStore`. Casos: botão desabilitado sem `valor`/`descricao` (press não chama `criar`); preenchendo `valor` e `descricao` → press chama `repositories.propostas.criar` com `expect.objectContaining({ conversaId: "a1", demandaId: "d1", valor: 300, descricao: "faco por 300" })` e `router.back()` é chamado.
- [ ] **Step 2: Rodar e confirmar falha**.
- [ ] **Step 3: Implementar** `useIniciarConversa`, `NovaPropostaScreen`, a rota.
- [ ] **Step 4: Rodar e confirmar verde** + `tsc` 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/propostas/screens apps/mobile/src/features/conversas/hooks/useIniciarConversa.ts apps/mobile/src/features/conversas/hooks/useIniciarConversa.test.tsx "apps/mobile/app/(app)/conversa/[id]/nova-proposta.tsx"
git commit -m "feat(mobile): tela de nova proposta + useIniciarConversa (Plano 4)"
```

---

## Task 19: Wiring — "Conversar" no perfil do prestador e "Tenho interesse" na demanda

**Files:**
- Modify: `apps/mobile/src/features/prestadores/screens/PrestadorPerfilScreen.tsx`
- Modify: `apps/mobile/src/features/demandas/screens/DemandaDetalheScreen.tsx`
- Test: `apps/mobile/src/features/prestadores/screens/PrestadorPerfilScreen.test.tsx` (criar)
- Test: `apps/mobile/src/features/demandas/screens/DemandaDetalheScreen.test.tsx` (criar)

**Interfaces:**
- Consumes: `useIniciarConversa`; `useUiModeStore` (`s.modo`); `useAuthStore` (`s.usuarioId`); `router` de `expo-router`.
- `PrestadorPerfilScreen` — adicionar, abaixo do cabeçalho, um `Botao` "Conversar" (sempre visível para quem não é o próprio prestador: `usuarioId !== usuarioId do perfil`). `onPress`: `const { id } = await iniciarDireta(p.usuarioId); router.push(\`/conversa/${id}\`)`. Enquanto `pendente`, desabilitar.
- `DemandaDetalheScreen` — trocar o texto placeholder ("Iniciar conversa com o cliente estará disponível em breve.") por um `Botao` "Tenho interesse", **visível só quando `modo === "prestar"`**. `onPress`: `const { id } = await iniciarDemanda(d.id... )` — a screen recebe só `id` (o `id` da demanda é o próprio `props.id`); `iniciarDemanda(props.id, usuarioId ?? "")`; `router.push(\`/conversa/${id}\`)`.

> `DemandaDetalheScreen` hoje recebe `{ id }` (o id da demanda). `PrestadorPerfilScreen` recebe `{ usuarioId }`. Confirmar antes de editar.

- [ ] **Step 1: Escrever os testes que falham**:
  - `PrestadorPerfilScreen.test.tsx` — mock `usePrestadorPerfil` (retorna `{ data: perfil, isLoading:false, isError:false }`), `useIniciarConversa` (`iniciarDireta` resolvido com `{ id: "a1" }`), `expo-router`. Press "Conversar" → `iniciarDireta("<usuarioId do perfil>")` e depois `router.push("/conversa/a1")`.
  - `DemandaDetalheScreen.test.tsx` — mock `useDemanda`, `useIniciarConversa`, `useUiModeStore` (seletor), `useAuthStore`, `expo-router`. `modo:"prestar"` → botão "Tenho interesse" presente; press → `iniciarDemanda("<props.id>", "u1")` → `router.push("/conversa/a1")`. `modo:"contratar"` → botão ausente.
- [ ] **Step 2: Rodar e confirmar falha**.
- [ ] **Step 3: Implementar** as duas edições de tela.
- [ ] **Step 4: Rodar e confirmar verde** + `tsc` 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/prestadores/screens apps/mobile/src/features/demandas/screens
git commit -m "feat(mobile): iniciar conversa a partir do perfil e da demanda (Plano 4)"
```

---

## Task 20: Gate final e follow-ups

**Files:**
- Modify: conforme necessário para zerar lint/tsc.
- Create: (se sobrar pendência) anotar em `docs/superpowers/plans/2026-09-09-plano-4-follow-ups.md`.

- [ ] **Step 1: Suíte pgTAP completa**

```bash
set -a && . ./.env && set +a
node supabase/tests/run.mjs
```
Esperado: `todos os testes pgTAP passaram` (0000–0025).

- [ ] **Step 2: `tsc` do app**

Run: `pnpm --filter @servico-feito/mobile exec tsc --noEmit`
Esperado: 0 erros.

- [ ] **Step 3: Jest do app**

Run: `pnpm --filter @servico-feito/mobile test`
Esperado: verde, auto-encerra. Se alguma suíte de tela pisar em timeout sob carga paralela, **não** baixar asserts — confirmar isolada (`test -- <arquivo>`); o `testTimeout` global já é 15s.

- [ ] **Step 4: ESLint**

Run: `pnpm --filter @servico-feito/mobile exec eslint .`
Esperado: 0 erros (warnings `import/first` pré-existentes são tolerados).

- [ ] **Step 5: expo-doctor + export**

```bash
pnpm --filter @servico-feito/mobile exec expo-doctor
pnpm --filter @servico-feito/mobile exec expo export --platform ios
```
Esperado: 18/18; `expo export` EXIT 0 (bundle iOS gerado). Se `hermesc` falhar por node_modules corrompido (Ruling R-G), rodar de um checkout limpo com `pnpm install` fresco antes de concluir que é regressão.

- [ ] **Step 6: Revisar pendências e registrar**

Anotar em `docs/superpowers/plans/2026-09-09-plano-4-follow-ups.md` (se houver):
- `traduzErroRepo` recebeu contexto de proposta só via helper local na `ConversaScreen` — considerar promover a `traduzErroRepo(e, 'proposta')` compartilhado no Plano 4b/5.
- `VISUALIZADA` nunca é setado (marca de "proposta vista pelo cliente") — Plano 5.
- Expiração de proposta por `validade_dias` (`EXPIRADA`) — job/cron, fora do MVP inicial.
- Sem optimistic update no envio de texto — aceitável; reavaliar se a latência do realtime incomodar.

- [ ] **Step 7: Commit final (se houve ajuste de lint/tsc ou follow-ups)**

```bash
git add -A
git commit -m "chore(mobile): gate final do Plano 4 (tsc/lint/follow-ups)"
```

- [ ] **Step 8: Finalizar a branch** — usar `superpowers:finishing-a-development-branch` (base `homolog`).

---

## Self-Review

**1. Cobertura da spec:**

| Item da spec | Task |
|---|---|
| `fn_aceitar_proposta` (transacional, idempotente, PT401/404/409) | 3 |
| `fn_recusar_proposta` (cliente recusa via RPC — RLS bloqueia UPDATE direto) | 3 |
| `handle_new_proposta` / `handle_new_mensagem` | 1 |
| Índices únicos parciais de dedup | 2 |
| Realtime publication `mensagens` + `conversas` | 4 |
| `set_updated_at` onde faltar | — **já existem** em `conversas` e `propostas` (verificado em `20260908143453` e `20260908143850`); `mensagens` é append-only. Nada a fazer. |
| `normalizarErro` PT401/404/409 | 5 |
| Tipos de domínio | 6 |
| `conversasRepository` find-or-create | 7 |
| `mensagensRepository` (keyset desc, enviar, marcarLidas 2 updates) | 8 |
| `propostasRepository` (criar direto, recusar/aceitar RPC) | 9 |
| `useMensagensRealtime` (prepend + dedup + refetch no SUBSCRIBED) | 10 |
| `useConversasRealtime` (2 filtros, invalidate) | 11 |
| `useMinhasConversas` / `useConversa` | 12 |
| `useMensagensInfinite` / `useEnviarTexto` / `useMarcarLidas` | 13 |
| `usePropostasDaConversa` / `useCriarProposta` / `useRecusarProposta` / `useAceitarProposta` | 14 |
| `ConversasListScreen` (substitui stub) + realtime na lista | 15 |
| `BolhaMensagem` / `PropostaCard` / `ContratoGeradoCard` | 16 |
| `ConversaScreen` (`FlatList inverted`, propostas inline, mark-as-read, botão enviar proposta por modo) + rota | 17 |
| `NovaPropostaScreen` + rota + `useIniciarConversa` | 18 |
| Wiring `PrestadorPerfilScreen` (DIRETA) + `DemandaDetalheScreen` (DEMANDA) | 19 |
| Post-accept fica no chat + `CONTRATO_GERADO` card | 17 (render por tipo) |
| Gate final | 20 |
| **Fora de escopo** (anexos de mídia, tela de contratação, encerrar/bloquear, editar/cancelar proposta, push) | — não há task; correto |

**2. Placeholders:** os `<TS1..4>` são timestamps gerados por `pnpm db:new`; os testes pgTAP dos Steps 1 têm literais marcados "ajustar antes de rodar" (nomes de coluna de `categoria_servico`, `plan(N)`) — cada um traz a instrução exata do que confirmar. Não há "TODO/implementar depois" em código de produção.

**3. Consistência de tipos/nomes:** `Conversa`/`Mensagem` (Task 6) usados por Tasks 7,8,10,12,13,15,17. `Proposta`/`NovaProposta` (Task 6) usados por 9,14,16,17,18. `repositories.{conversas,mensagens,propostas}` (Tasks 7–9) consumidos por 12–14,18. `["mensagens", conversaId]` (chave única) — Tasks 10,13,14,17 idênticas. `["conversas","minhas"]` — Tasks 11,12,13,14,15. RPC: `fn_aceitar_proposta({ p_proposta_id })` / `fn_recusar_proposta({ p_proposta_id })` — Task 3 (SQL) ↔ Task 9 (chamada) batendo. `notificacoes` colunas `titulo`/`mensagem`/`referencia_id` — Task 3 usa os nomes reais (verificado).
