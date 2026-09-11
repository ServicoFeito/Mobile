# Plano 5 — Contratação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a tela de contratação pós-aceite (detalhe, checklist de tarefas, cancelamento) e a lista "minhas contratações" — sem Pix/EFI real (Plano 6).

**Architecture:** `contratacoes` só aceita escrita via `service_role`/RPC (nenhuma policy de `UPDATE` pra `authenticated` — travado desde o Plano 1). Cancelamento vira uma RPC `SECURITY DEFINER` estreita e idempotente, mesmo padrão do `fn_aceitar_proposta`/`fn_recusar_proposta` (Plano 4). O checklist de tarefas já tem RLS de escrita (só o cliente dono) — repo fino, sem RPC. Repositories/hooks/telas seguem o padrão estabelecido nos Planos 3–4.

**Tech Stack:** Expo SDK 52 · Expo Router 4 · RN 0.76.9 · TypeScript 5.6 strict + `noUncheckedIndexedAccess` · `@supabase/supabase-js` 2.x · `@tanstack/react-query` 5 · Zustand 5 · NativeWind 4.1.23 · Jest (`jest-expo`) + `@testing-library/react-native` · Postgres + pgTAP.

**Spec:** `docs/superpowers/specs/2026-09-10-plano-5-contratacao-design.md`

## Global Constraints

- **Base:** branch a partir de `homolog` @ `48c71f8` (Planos 1–4 mergeados). `git config user`: `VitorHugoVH` / `vhfraga007@gmail.com`. Conventional Commits.
- **Sem Docker / sem Postgres local.** Migration aplicada com `pnpm db:push` no projeto dev; pgTAP com `pnpm db:test` (runner Node `supabase/tests/run.mjs`). Antes de qualquer `db:*`: `set -a && . ./.env && set +a`.
- **Se este ambiente de execução não tiver `.env`/link Supabase** (confirmar com `ls supabase/.temp/` e `env | grep SUPABASE` antes da Task 1): escrever e commitar a migration + o pgTAP com verificação estática máxima (ler o plpgsql, conferir cada tabela/coluna/enum contra os arquivos do Plano 1/4, traçar cada assert à mão), **sem rodar** `db:push`/`db:test`. Regenerar `packages/db-types/index.ts` também fica pendente — hand-add a entrada da função nova em `Database["public"]["Functions"]` (mesmo padrão do Plano 4, Task 4), no formato que `supabase gen types` produziria. Isso é uma decisão que se toma uma vez, no início da Task 1, e vale pro resto do plano — não repetir a checagem em cada task.
- Migration nova sempre com teste pgTAP em `supabase/tests/*.test.sql` (`begin … select plan(N); … select * from finish(); rollback;`). Migration sem teste não é considerada pronta.
- Toda função/trigger SQL: `language plpgsql`/`sql`, `security definer`, `set search_path = ''`, objetos schema-qualificados (`public.`, `auth.`). Comparação de `auth.uid()` contra um "dono" usa `is distinct from` (nunca `= ` nem `not in` com possível `NULL` — `NULL NOT IN (...)` é `NULL`, não `TRUE`, e o guard nunca dispara).
- `CodigoRepo` (`apps/mobile/src/shared/api/repositories/types.ts`) já mapeia `PT401→nao_autorizado`, `PT404→nao_encontrado`, `PT409→conflito` (Plano 4) — **sem mudança nesse arquivo neste plano**.
- Toda edição no barrel `apps/mobile/src/shared/api/repositories/index.ts` é **aditiva** (adicionar import + entrada + `export type`, nunca reescrever o arquivo) — mais de uma task mexe nele.
- Nenhum `*.test.*` dentro de `apps/mobile/app/`. Todo hook react-query nos testes usa `criarWrapperQuery()` de `@/test/criarWrapperQuery` (nunca `new QueryClient` inline), instanciado **dentro de `beforeEach`**, não no escopo do módulo. Seletores Zustand em telas são atômicos: `useAuthStore((s) => s.usuarioId)`.
- Repositories: cada método `.supabase.ts`: `try` a chamada → mapeia linha→domínio camelCase → retorna; `catch (e) { throw normalizarErro(e) }`; `{ error }` não-nulo → `throw normalizarErro(error)`. Nunca vaza `PostgrestError`.
- `RepoError` importa de `@/shared/api/repositories` (não de `.../types` direto) nos arquivos de feature — `import { RepoError } from "@/shared/api/repositories"`.
- Gate final: `tsc --noEmit` 0 · `jest` verde e auto-encerrando · `eslint` 0 erros · `expo-doctor` 18/18 (ou as falhas de rede documentadas se o sandbox não tiver acesso à API da Expo) · `expo export --platform ios` EXIT 0 · `pnpm db:push`/`pnpm db:test` (só se `.env` existir).

---

## File Structure

```
supabase/migrations/<TS>_fn_cancelar_contratacao.sql
supabase/tests/0026_fn_cancelar_contratacao.test.sql
packages/db-types/index.ts                                        (modificar — hand-add, ver Task 1)

apps/mobile/src/features/contratacoes/
  types/contratacao.types.ts
  hooks/useContratacaoPorProposta.ts  useMinhasContratacoes.ts  useCancelarContratacao.ts
  components/ContratacaoRow.tsx
  screens/ContratacaoScreen.tsx  ContratacaoScreen.test.tsx
  screens/TrabalhosScreen.tsx  TrabalhosScreen.test.tsx           (substitui features/shell/screens/TrabalhosScreen.tsx)

apps/mobile/src/features/tarefas/
  types/tarefa.types.ts
  hooks/useTarefasDaDemanda.ts  useMarcarTarefaConcluida.ts
  components/TarefaRow.tsx

apps/mobile/src/shared/api/repositories/
  contratacoes/contratacoesRepository.ts  .supabase.ts  .supabase.test.ts
  tarefas/tarefasRepository.ts  .supabase.ts  .supabase.test.ts
  index.ts                                                        (modificar, aditivo)

apps/mobile/src/shared/lib/formatarBRL.ts  formatarBRL.test.ts
apps/mobile/src/features/propostas/components/PropostaCard.tsx        (modificar — usa formatarBRL)
apps/mobile/src/features/propostas/components/ContratoGeradoCard.tsx  (modificar — usa formatarBRL)
apps/mobile/src/features/conversas/screens/ConversaScreen.tsx         (modificar — Pressable no CONTRATO_GERADO)
apps/mobile/src/features/conversas/screens/ConversaScreen.test.tsx    (modificar — +1 caso)

apps/mobile/app/(app)/contratacao/[id].tsx     (novo — id = proposta_id)
apps/mobile/app/(app)/(tabs)/trabalhos.tsx     (modificar — reaponta import)
apps/mobile/app/(app)/(tabs)/_layout.tsx       (modificar — tira o gate de modo da aba Trabalhos)
```

## Contexto de esquema (fatos verificados — não re-descobrir)

- **`contratacoes`** (`20260908144223_contratacoes.sql` + `20260908200154_rls_hardening.sql`): `id, demanda_id (nullable, FK demandas_servico ON DELETE SET NULL), proposta_id uuid NOT NULL UNIQUE FK propostas ON DELETE RESTRICT, titulo_servico text NOT NULL, cliente_id, prestador_id, valor_total numeric(10,2) CHECK >=0, valor_entrada/valor_final/taxa_plataforma GENERATED, status default 'AGUARDANDO_PAGAMENTO', entrada_paga/final_pago/avaliado bool default false, data_agendada text, data_conclusao timestamptz, created_at, updated_at`. Trigger `contratacoes_set_updated_at` já existe. **`grant` NENHUM pra `authenticated` em `INSERT`/`UPDATE`/`DELETE`** (comentário explícito: `-- NADA de escrita p/ contratacoes / pagamentos (só service_role)`) — só `grant select` (policy `contratacoes_select_partes`: cliente ou prestador). Toda escrita **tem** que ser por RPC `SECURITY DEFINER`.
- **`tarefas_demanda`** (`20260908143144_demandas.sql` + RLS): `id, demanda_id (FK demandas_servico CASCADE), nome_tarefa text NOT NULL, descricao text, concluida boolean default false, created_at`. RLS: `tarefas_select_quem_ve_demanda` (quem vê a demanda vê as tarefas); `tarefas_write_cliente_dono` (`for all` — só o cliente dono da demanda). `grant select/insert/update/delete to authenticated` já concedidos (Plano 1) — o repo escreve direto, sem RPC.
- **`demandas_servico.status`** — enum `status_demanda('ABERTA','EM_NEGOCIACAO','CONTRATADA','FINALIZADA','CANCELADA')`.
- **`propostas`**: `conversa_id` é `not null` — sempre dá pra achar a conversa a partir de uma proposta.
- **`notificacoes`**: colunas `usuario_id, titulo, mensagem, tipo (tipo_notificacao: PROPOSTA|PAGAMENTO|MENSAGEM|CONTRATACAO|AVALIACAO), referencia_id, lida, created_at`.
- **`mensagens`**: `tipo_mensagem` inclui `'SISTEMA'`. `handle_new_mensagem` (Plano 1/4) já trata qualquer `tipo` fora da lista explícita no `else`-arm com `left(coalesce(nullif(new.corpo,''),''),120)` — se o `corpo` não for vazio, o resumo da conversa funciona certo sem tocar nesse trigger.
- **`perfis_publicos`** view: `usuario_id, nome, foto_perfil_url` (entre outras colunas).
- **RLS `contratacoes` / `tarefas_demanda`**: confirmadas acima — não precisam de migração neste plano.
- **App**: `supabase` de `@/shared/api/supabaseClient`; `queryClient` de `@/shared/query/queryClient`; `useAuthStore` (`s.usuarioId: string | null`); `useUiModeStore` (`s.modo: 'contratar'|'prestar'`); `repositories` barrel em `@/shared/api/repositories` (hoje: `categorias, enderecos, demandas, prestadores, conversas, mensagens, propostas`). Átomos: `Botao({ titulo, onPress, carregando?, desabilitado?, variante?: 'primario'|'perigo'|'secundario' })`, `CampoTexto(TextInputProps & { erro?: string })`; `CarregandoEstado()` sem props; `ErroEstado({ mensagem, onRetry? })`; `VazioEstado({ mensagem })`. `traduzErroRepo(e): string`. `criarWrapperQuery()` em `@/test/criarWrapperQuery`.
- **`ConversaScreen.tsx`** (Plano 4, arquivo final) — `renderItem`, caso `"CONTRATO_GERADO"` (linhas 118–121 no HEAD atual):
  ```tsx
  if (item.tipo === "CONTRATO_GERADO") {
    const p = propostasQ.data?.find((x) => x.id === item.propostaId);
    return <ContratoGeradoCard valor={p?.valor ?? 0} />;
  }
  ```
- **`ContratoGeradoCard.tsx`** (Plano 4, atual):
  ```tsx
  import { Text, View } from "react-native";
  export function ContratoGeradoCard({ valor }: { valor: number }) {
    return (
      <View className="bg-sf-surface-variant border border-sf-outline rounded-xl px-4 py-3 mb-2">
        <Text className="text-sf-dark-green text-sm font-semibold">Contrato gerado</Text>
        <Text className="text-sf-text text-base mt-1">R$ {valor.toFixed(2)}</Text>
      </View>
    );
  }
  ```
- **`PropostaCard.tsx`** (Plano 4, linha do valor): `<Text className="text-sf-text text-lg font-semibold">R$ {proposta.valor.toFixed(2)}</Text>`.
- **`(tabs)/_layout.tsx`** (atual):
  ```tsx
  <Tabs.Screen name="trabalhos" options={{ title: "Trabalhos", href: prestar ? "/(app)/(tabs)/trabalhos" : null }} />
  ```
- **`app/(app)/(tabs)/trabalhos.tsx`** (atual): `import { TrabalhosScreen } from "@/features/shell/screens/TrabalhosScreen"; export default function TrabalhosRoute() { return <TrabalhosScreen />; }`.
- **`ConversasListScreen.tsx`** (Plano 4) é o modelo de tela-lista a seguir:
  ```tsx
  export function ConversasListScreen() {
    useConversasRealtime();
    const q = useMinhasConversas();
    return (
      <View className="flex-1 bg-sf-bg">
        {q.isLoading ? <CarregandoEstado /> :
         q.isError || !q.data ? <ErroEstado mensagem={traduzErroRepo(q.error)} onRetry={() => q.refetch()} /> :
         q.data.length === 0 ? <VazioEstado mensagem="Nenhuma conversa ainda." /> :
         <FlatList data={q.data} keyExtractor={(c) => c.id}
                   renderItem={({ item }) => <ConversaRow conversa={item} onPress={() => router.push(`/conversa/${item.id}`)} />} />}
      </View>
    );
  }
  ```
- **`useMinhasConversas.ts`** (Plano 4) é o modelo de hook `useQuery` simples a seguir (ver Task 6).
- **`conversasRepository.supabase.ts`** (Plano 4) é o modelo de repo a seguir para `listarMinhas`/`obterPorX` com resolução de "outro" via `perfis_publicos` (ver Task 3).
- **db-types `Functions`** atual (ordem alfabética): `fn_aceitar_proposta, fn_e_participante, fn_recusar_proposta, fn_tem_perfil_prestador`. `fn_cancelar_contratacao` entra **antes** de `fn_e_participante`.

---

## Task 1: Migração `fn_cancelar_contratacao` + pgTAP + hand-add em `db-types`

**Files:**
- Create: `supabase/migrations/<TS>_fn_cancelar_contratacao.sql` (gerar com `pnpm db:new fn_cancelar_contratacao`; se falhar por falta de link, criar à mão com timestamp UTC `> 20260910000004`, ex. `20260910120001`)
- Test: `supabase/tests/0026_fn_cancelar_contratacao.test.sql`
- Modify: `packages/db-types/index.ts` (só o bloco `Functions`, aditivo)

**Interfaces:**
- Produces: `public.fn_cancelar_contratacao(p_contratacao_id uuid) returns void`, `SECURITY DEFINER`, idempotente. Consumida por `contratacoesRepository.cancelar` (Task 3).

- [ ] **Step 1: Confirmar se há `.env`/link neste ambiente de execução**

```bash
ls supabase/.temp/ 2>&1; env | grep -i SUPABASE
```
Se **não** houver: todo o resto desta task é "escrever + verificar estaticamente + commitar", **sem** `db:push`/`db:test`. Anotar isso no relatório da task. Se houver: rodar `db:push`/`db:test` normalmente nos Steps 4/5.

- [ ] **Step 2: Escrever o teste pgTAP**

`supabase/tests/0026_fn_cancelar_contratacao.test.sql`:

```sql
begin;
select plan(13);

select tests.create_supabase_user('t5_cli');
select tests.create_supabase_user('t5_pre');
select tests.create_supabase_user('t5_outro');

insert into public.categoria_servico (id, nome, icone_key)
values ('c5555555-0000-0000-0000-000000000001', 'T5 Marcenaria', 'x');

-- Cenario A (feliz, DEMANDA): demanda ja CONTRATADA + contratacao AGUARDANDO_PAGAMENTO
insert into public.demandas_servico (id, cliente_id, categoria_id, titulo, descricao, status)
values ('d5555555-0000-0000-0000-000000000001', tests.get_supabase_uid('t5_cli'),
        'c5555555-0000-0000-0000-000000000001', 'Estante sob medida', 'x', 'CONTRATADA');
insert into public.conversas (id, tipo, demanda_id, cliente_id, prestador_id)
values ('a5555555-0000-0000-0000-000000000001', 'DEMANDA',
        'd5555555-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t5_cli'), tests.get_supabase_uid('t5_pre'));
insert into public.propostas (id, demanda_id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b5555555-0000-0000-0000-000000000001', 'd5555555-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t5_pre'), tests.get_supabase_uid('t5_cli'),
        'a5555555-0000-0000-0000-000000000001', 500.00, 'faco a estante');
insert into public.contratacoes (id, demanda_id, proposta_id, titulo_servico, cliente_id, prestador_id, valor_total, status)
values ('e5555555-0000-0000-0000-000000000001', 'd5555555-0000-0000-0000-000000000001',
        'b5555555-0000-0000-0000-000000000001', 'Estante sob medida',
        tests.get_supabase_uid('t5_cli'), tests.get_supabase_uid('t5_pre'), 500.00, 'AGUARDANDO_PAGAMENTO');

-- (1) authz: quem nao e cliente nem prestador nao cancela
select tests.authenticate_as('t5_outro');
select throws_ok(
  $$ select public.fn_cancelar_contratacao('e5555555-0000-0000-0000-000000000001') $$,
  'PT401', null, 'nao-parte nao cancela (PT401)');
reset role;

-- (2) inexistente
select tests.authenticate_as('t5_cli');
select throws_ok(
  $$ select public.fn_cancelar_contratacao('00000000-0000-0000-0000-0000000000ff') $$,
  'PT404', null, 'contratacao inexistente (PT404)');
reset role;

-- (3) feliz: prestador cancela
select tests.authenticate_as('t5_pre');
select lives_ok(
  $$ select public.fn_cancelar_contratacao('e5555555-0000-0000-0000-000000000001') $$,
  'prestador cancela sem erro');
reset role;

select is((select status::text from public.contratacoes where id = 'e5555555-0000-0000-0000-000000000001'),
          'CANCELADA', 'contratacao CANCELADA');
select is((select status::text from public.demandas_servico where id = 'd5555555-0000-0000-0000-000000000001'),
          'ABERTA', 'demanda volta pra ABERTA');
select is((select count(*)::int from public.mensagens
             where conversa_id = 'a5555555-0000-0000-0000-000000000001' and tipo = 'SISTEMA'),
          1, 'mensagem SISTEMA inserida');
select is((select corpo from public.mensagens
             where conversa_id = 'a5555555-0000-0000-0000-000000000001' and tipo = 'SISTEMA'),
          'Contratação cancelada.', 'corpo da mensagem SISTEMA');
select is((select count(*)::int from public.notificacoes
             where usuario_id = tests.get_supabase_uid('t5_cli') and tipo = 'CONTRATACAO'
               and referencia_id = 'e5555555-0000-0000-0000-000000000001'),
          1, 'notificacao pra quem NAO cancelou (cliente)');

-- (4) idempotente: 2a chamada nao lanca e nao duplica a mensagem
select tests.authenticate_as('t5_cli');
select lives_ok(
  $$ select public.fn_cancelar_contratacao('e5555555-0000-0000-0000-000000000001') $$,
  '2a chamada idempotente');
reset role;
select is((select count(*)::int from public.mensagens
             where conversa_id = 'a5555555-0000-0000-0000-000000000001' and tipo = 'SISTEMA'),
          1, 'sem 2a mensagem SISTEMA (idempotencia)');

-- Cenario B (conflito): contratacao ja alem de AGUARDANDO_PAGAMENTO
insert into public.demandas_servico (id, cliente_id, categoria_id, titulo, descricao, status)
values ('d5555555-0000-0000-0000-000000000002', tests.get_supabase_uid('t5_cli'),
        'c5555555-0000-0000-0000-000000000001', 'Armario', 'x', 'CONTRATADA');
insert into public.conversas (id, tipo, demanda_id, cliente_id, prestador_id)
values ('a5555555-0000-0000-0000-000000000002', 'DEMANDA',
        'd5555555-0000-0000-0000-000000000002',
        tests.get_supabase_uid('t5_cli'), tests.get_supabase_uid('t5_pre'));
insert into public.propostas (id, demanda_id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b5555555-0000-0000-0000-000000000002', 'd5555555-0000-0000-0000-000000000002',
        tests.get_supabase_uid('t5_pre'), tests.get_supabase_uid('t5_cli'),
        'a5555555-0000-0000-0000-000000000002', 300.00, 'armario');
insert into public.contratacoes (id, demanda_id, proposta_id, titulo_servico, cliente_id, prestador_id, valor_total, status)
values ('e5555555-0000-0000-0000-000000000002', 'd5555555-0000-0000-0000-000000000002',
        'b5555555-0000-0000-0000-000000000002', 'Armario',
        tests.get_supabase_uid('t5_cli'), tests.get_supabase_uid('t5_pre'), 300.00, 'AGENDADA');

select tests.authenticate_as('t5_cli');
select throws_ok(
  $$ select public.fn_cancelar_contratacao('e5555555-0000-0000-0000-000000000002') $$,
  'PT409', null, 'contratacao ja AGENDADA nao cancela (PT409)');
reset role;

-- Cenario C (DIRETA): sem demanda_id
insert into public.conversas (id, tipo, cliente_id, prestador_id)
values ('a5555555-0000-0000-0000-000000000003', 'DIRETA',
        tests.get_supabase_uid('t5_cli'), tests.get_supabase_uid('t5_pre'));
insert into public.propostas (id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b5555555-0000-0000-0000-000000000003',
        tests.get_supabase_uid('t5_pre'), tests.get_supabase_uid('t5_cli'),
        'a5555555-0000-0000-0000-000000000003', 150.00, 'servico direto');
insert into public.contratacoes (proposta_id, titulo_servico, cliente_id, prestador_id, valor_total, status)
values ('b5555555-0000-0000-0000-000000000003', 'servico direto',
        tests.get_supabase_uid('t5_cli'), tests.get_supabase_uid('t5_pre'), 150.00, 'AGUARDANDO_PAGAMENTO');

select tests.authenticate_as('t5_cli');
select lives_ok(
  format($$ select public.fn_cancelar_contratacao(
    (select id from public.contratacoes where proposta_id = 'b5555555-0000-0000-0000-000000000003')
  ) $$),
  'cancela contratacao DIRETA sem erro');
reset role;
select is((select status::text from public.contratacoes where proposta_id = 'b5555555-0000-0000-0000-000000000003'),
          'CANCELADA', 'contratacao DIRETA CANCELADA');
select is((select count(*)::int from public.mensagens
             where conversa_id = 'a5555555-0000-0000-0000-000000000003' and tipo = 'SISTEMA'),
          1, 'mensagem SISTEMA na conversa DIRETA');

select * from finish();
rollback;
```

> Contar os asserts reais acima e ajustar `select plan(13);` se divergir. `reset role;` é obrigatório antes de todo `insert`/`select` administrativo feito fora de `tests.authenticate_as(...)` — sem isso a sessão continua com o papel `authenticated` da chamada anterior e os inserts diretos em `contratacoes` (sem policy de INSERT) falham.

- [ ] **Step 3: Escrever a migration**

`supabase/migrations/<TS>_fn_cancelar_contratacao.sql`:

```sql
-- Plano 5 — cancelamento de contratacao antes de qualquer pagamento.
-- contratacoes nao tem NENHUMA policy de UPDATE pra authenticated (so service_role) —
-- toda escrita e por RPC SECURITY DEFINER, mesmo padrao do Plano 4.

create or replace function public.fn_cancelar_contratacao(p_contratacao_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contr    public.contratacoes%rowtype;
  v_conversa uuid;
  v_outro    uuid;
begin
  select * into v_contr from public.contratacoes where id = p_contratacao_id for update;
  if not found then
    raise exception 'contratacao_inexistente' using errcode = 'PT404';
  end if;

  if (select auth.uid()) is distinct from v_contr.cliente_id
     and (select auth.uid()) is distinct from v_contr.prestador_id then
    raise exception 'nao_autorizado' using errcode = 'PT401';
  end if;

  if v_contr.status = 'CANCELADA' then
    return;
  end if;

  if v_contr.status <> 'AGUARDANDO_PAGAMENTO' then
    raise exception 'contratacao_indisponivel' using errcode = 'PT409';
  end if;

  update public.contratacoes set status = 'CANCELADA' where id = p_contratacao_id;

  if v_contr.demanda_id is not null then
    update public.demandas_servico
      set status = 'ABERTA'
      where id = v_contr.demanda_id and status = 'CONTRATADA';
  end if;

  select conversa_id into v_conversa from public.propostas where id = v_contr.proposta_id;

  insert into public.mensagens (conversa_id, remetente_id, tipo, corpo)
  values (v_conversa, (select auth.uid()), 'SISTEMA', 'Contratação cancelada.');

  v_outro := case
    when (select auth.uid()) = v_contr.cliente_id then v_contr.prestador_id
    else v_contr.cliente_id
  end;

  insert into public.notificacoes (usuario_id, titulo, mensagem, tipo, referencia_id)
  values (v_outro, 'Contratação cancelada', 'A contratação foi cancelada.', 'CONTRATACAO', p_contratacao_id);
end;
$$;

revoke execute on function public.fn_cancelar_contratacao(uuid) from public, anon;
grant execute on function public.fn_cancelar_contratacao(uuid) to authenticated;
```

- [ ] **Step 4: Aplicar e rodar (só se houver `.env`/link — ver Step 1)**

```bash
set -a && . ./.env && set +a
pnpm db:push
node supabase/tests/run.mjs 2>&1 | grep 0026
```
Esperado: `✓ 0026_fn_cancelar_contratacao.test.sql — 13 ok`. Se não houver `.env`: pular este step, e no relatório da task escrever a verificação estática (cada tabela/coluna referenciada confirmada contra os arquivos de migration do Plano 1, o `is distinct from` conferido pra não deixar `auth.uid() null` passar, e o traço de cada um dos 13 asserts contra o corpo da função).

- [ ] **Step 5: Hand-add em `packages/db-types/index.ts` (só se `db:types` não rodar — mesma condição do Step 1)**

No bloco `Database["public"]["Functions"]`, adicionar **antes** de `fn_e_participante` (ordem alfabética), com a formatação exata dos vizinhos:

```ts
      fn_cancelar_contratacao: {
        Args: { p_contratacao_id: string }
        Returns: undefined
      }
```

Rodar `pnpm --filter @servico-feito/mobile exec tsc --noEmit` pra confirmar que a edição não quebra nada (0 erros). Se houver `.env`, rodar `pnpm db:types` normalmente em vez do hand-add (ele substitui/confirma a entrada).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/<TS>_fn_cancelar_contratacao.sql supabase/tests/0026_fn_cancelar_contratacao.test.sql packages/db-types/index.ts
git commit -m "feat(db): fn_cancelar_contratacao (Plano 5)"
```

---

## Task 2: Tipos de domínio — `Contratacao` e `Tarefa`

**Files:**
- Create: `apps/mobile/src/features/contratacoes/types/contratacao.types.ts`
- Create: `apps/mobile/src/features/tarefas/types/tarefa.types.ts`

**Interfaces:**
- Produces:

```ts
// contratacao.types.ts
export interface Contratacao {
  id: string;
  demandaId: string | null;
  propostaId: string;
  tituloServico: string;
  clienteId: string;
  prestadorId: string;
  valorTotal: number;
  valorEntrada: number | null;
  valorFinal: number | null;
  taxaPlataforma: number | null;
  status: string;
  entradaPaga: boolean;
  finalPago: boolean;
  avaliado: boolean;
  dataAgendada: string | null;
  dataConclusao: string | null;
  outroId: string;
  outroNome: string | null;
  outroFotoUrl: string | null;
  createdAt: string;
}
```

```ts
// tarefa.types.ts
export interface Tarefa {
  id: string;
  demandaId: string;
  nomeTarefa: string;
  descricao: string | null;
  concluida: boolean;
  createdAt: string;
}
```

- [ ] **Step 1: Criar os dois arquivos** com exatamente o conteúdo acima.
- [ ] **Step 2: Verificar tipo**: `pnpm --filter @servico-feito/mobile exec tsc --noEmit` → 0 erros.
- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/contratacoes/types/contratacao.types.ts apps/mobile/src/features/tarefas/types/tarefa.types.ts
git commit -m "feat(mobile): tipos de dominio de contratacao e tarefa (Plano 5)"
```

---

## Task 3: `contratacoesRepository`

**Files:**
- Create: `apps/mobile/src/shared/api/repositories/contratacoes/{contratacoesRepository.ts, contratacoesRepository.supabase.ts, contratacoesRepository.supabase.test.ts}`
- Modify: `apps/mobile/src/shared/api/repositories/index.ts` (aditivo)

**Interfaces:**
- Consumes: `Contratacao` de `@/features/contratacoes/types/contratacao.types`; `normalizarErro` de `../types`.
- Produces:

```ts
export interface ContratacoesRepository {
  obterPorProposta(propostaId: string, usuarioId: string): Promise<Contratacao>;
  listarMinhas(usuarioId: string): Promise<Contratacao[]>;
  cancelar(contratacaoId: string): Promise<void>;
}
```
Barrel: `repositories.contratacoes`.

**Implementação** — segue o mesmo formato de `conversasRepository.supabase.ts` (Plano 4: `SELECT_*` const, `type Linha... = Database["public"]["Tables"]["contratacoes"]["Row"]`, `interface Outro { nome; foto_perfil_url }`, `paraContratacao(l, usuarioId, outro)`, `carregarOutros`/lookup individual não propagando erro):

```ts
const SELECT_CONTRATACAO =
  "id, demanda_id, proposta_id, titulo_servico, cliente_id, prestador_id, valor_total, valor_entrada, valor_final, taxa_plataforma, status, entrada_paga, final_pago, avaliado, data_agendada, data_conclusao, created_at";

function num(v: number | string | null): number | null {
  if (v === null) return null;
  return typeof v === "string" ? Number(v) : v;
}

function paraContratacao(l: LinhaContratacao, usuarioId: string, outro: Outro | null): Contratacao {
  const ehCliente = usuarioId === l.cliente_id;
  return {
    id: l.id,
    demandaId: l.demanda_id,
    propostaId: l.proposta_id,
    tituloServico: l.titulo_servico,
    clienteId: l.cliente_id,
    prestadorId: l.prestador_id,
    valorTotal: num(l.valor_total) ?? 0,
    valorEntrada: num(l.valor_entrada),
    valorFinal: num(l.valor_final),
    taxaPlataforma: num(l.taxa_plataforma),
    status: l.status,
    entradaPaga: l.entrada_paga,
    finalPago: l.final_pago,
    avaliado: l.avaliado,
    dataAgendada: l.data_agendada,
    dataConclusao: l.data_conclusao,
    outroId: ehCliente ? l.prestador_id : l.cliente_id,
    outroNome: outro?.nome ?? null,
    outroFotoUrl: outro?.foto_perfil_url ?? null,
    createdAt: l.created_at,
  };
}
```

- `obterPorProposta(propostaId, usuarioId)`: `.select(SELECT_CONTRATACAO).eq("proposta_id", propostaId).single()`; resolve o "outro" com 1 `maybeSingle` em `perfis_publicos` (igual `conversasRepository.obter`) — erro nessa 2ª query **não propaga**.
- `listarMinhas(usuarioId)`: `.or('cliente_id.eq.<uid>,prestador_id.eq.<uid>')`, `.order("created_at", { ascending: false })`; resolve os "outros" em lote com `.in("usuario_id", [...ids])` — igual `conversasRepository.listarMinhas` / `carregarOutros`, mesma tolerância a falha.
- `cancelar(contratacaoId)`: `const { error } = await supabase.rpc("fn_cancelar_contratacao", { p_contratacao_id: contratacaoId }); if (error) throw normalizarErro(error);`.
- Todo método: `try { … } catch (e) { throw normalizarErro(e) }`.

- [ ] **Step 1: Escrever o teste que falha** (`contratacoesRepository.supabase.test.ts`) — usar `const supa = require("@/shared/api/supabaseClient").supabase;` + `jest.spyOn(supa, "from"/"rpc")`, `afterEach(jest.restoreAllMocks)`. Casos: `obterPorProposta` mapeia todos os campos + resolve `outroNome`; `obterPorProposta` com falha na 2ª query devolve `outroNome: null` sem lançar; `listarMinhas` resolve `naoLidas`-equivalente (aqui não existe `naoLidas`, então: mapeia `outroId` certo pro papel de cada linha + ordena por `created_at desc`); `cancelar` chama `supabase.rpc("fn_cancelar_contratacao", { p_contratacao_id: <id> })`; `cancelar` com `{ error: { code: "PT409" } }` rejeita `code: "conflito"`; `cancelar` com `{ error: { code: "PT401" } }` rejeita `nao_autorizado"`.
- [ ] **Step 2: Rodar e confirmar falha** — `pnpm --filter @servico-feito/mobile test -- contratacoesRepository` → FAIL.
- [ ] **Step 3: Criar a interface + impl + barrel**. No `index.ts`: import `contratacoesRepositorySupabase`, `contratacoes: contratacoesRepositorySupabase` no objeto `repositories`, `export type { ContratacoesRepository } from "./contratacoes/contratacoesRepository";`.
- [ ] **Step 4: Rodar e confirmar verde** + `tsc --noEmit` 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/shared/api/repositories/contratacoes apps/mobile/src/shared/api/repositories/index.ts
git commit -m "feat(mobile): contratacoesRepository (Plano 5)"
```

---

## Task 4: `tarefasRepository`

**Files:**
- Create: `apps/mobile/src/shared/api/repositories/tarefas/{tarefasRepository.ts, tarefasRepository.supabase.ts, tarefasRepository.supabase.test.ts}`
- Modify: `apps/mobile/src/shared/api/repositories/index.ts` (aditivo)

**Interfaces:**
- Consumes: `Tarefa` de `@/features/tarefas/types/tarefa.types`; `normalizarErro`.
- Produces:

```ts
export interface TarefasRepository {
  listarDaDemanda(demandaId: string): Promise<Tarefa[]>;
  marcarConcluida(tarefaId: string, concluida: boolean): Promise<void>;
}
```
Barrel: `repositories.tarefas`.

**Implementação:**
```ts
const SELECT_TAREFA = "id, demanda_id, nome_tarefa, descricao, concluida, created_at";

function paraTarefa(l: LinhaTarefa): Tarefa {
  return {
    id: l.id, demandaId: l.demanda_id, nomeTarefa: l.nome_tarefa,
    descricao: l.descricao, concluida: l.concluida, createdAt: l.created_at,
  };
}
```
- `listarDaDemanda(demandaId)`: `.select(SELECT_TAREFA).eq("demanda_id", demandaId).order("created_at", { ascending: true })`.
- `marcarConcluida(tarefaId, concluida)`: `const { error } = await supabase.from("tarefas_demanda").update({ concluida }).eq("id", tarefaId); if (error) throw normalizarErro(error);` (RLS barra o prestador — vira `nao_autorizado`).
- Todo método: `try { … } catch (e) { throw normalizarErro(e) }`.

- [ ] **Step 1: Escrever o teste que falha** — `listarDaDemanda` mapeia + ordena; `marcarConcluida` faz `update({ concluida: true })` com `.eq("id", tarefaId)`; `marcarConcluida` com `{ error: { code: "42501" } }` rejeita `nao_autorizado`.
- [ ] **Step 2: Rodar e confirmar falha**.
- [ ] **Step 3: Criar interface + impl + barrel** (`repositories.tarefas`, `export type { TarefasRepository }`).
- [ ] **Step 4: Rodar e confirmar verde** + `tsc` 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/shared/api/repositories/tarefas apps/mobile/src/shared/api/repositories/index.ts
git commit -m "feat(mobile): tarefasRepository (Plano 5)"
```

---

## Task 5: `formatarBRL` + retrofit em `PropostaCard`/`ContratoGeradoCard`

**Files:**
- Create: `apps/mobile/src/shared/lib/formatarBRL.ts`, `formatarBRL.test.ts`
- Modify: `apps/mobile/src/features/propostas/components/PropostaCard.tsx`
- Modify: `apps/mobile/src/features/propostas/components/ContratoGeradoCard.tsx`

**Interfaces:**
- Produces: `export function formatarBRL(v: number): string`.

```ts
export function formatarBRL(v: number): string {
  return "R$ " + v.toFixed(2).replace(".", ",");
}
```
(sem separador de milhar — aceitável no MVP.)

- [ ] **Step 1: Escrever o teste que falha** (`formatarBRL.test.ts`):
```ts
import { formatarBRL } from "./formatarBRL";

it.each([
  [300, "R$ 300,00"],
  [0, "R$ 0,00"],
  [199.9, "R$ 199,90"],
  [1234.5, "R$ 1234,50"],
])("formata %s -> %s", (v, esperado) => expect(formatarBRL(v)).toBe(esperado));
```
- [ ] **Step 2: Rodar e confirmar falha** — `pnpm --filter @servico-feito/mobile test -- formatarBRL` → FAIL (módulo não existe).
- [ ] **Step 3: Implementar** `formatarBRL.ts`.
- [ ] **Step 4: Retrofit** — em `PropostaCard.tsx`: importar `formatarBRL` de `@/shared/lib/formatarBRL`, trocar `` `R$ ${proposta.valor.toFixed(2)}` `` por `` `${formatarBRL(proposta.valor)}` `` (ou remover o `R$ ` literal já embutido no helper e usar só `formatarBRL(proposta.valor)` — **não duplicar o prefixo `R$`**). Mesma troca em `ContratoGeradoCard.tsx` (`R$ {valor.toFixed(2)}` → `{formatarBRL(valor)}`).
- [ ] **Step 5: Rodar `formatarBRL` + as suítes de `PropostaCard`/`ContratoGeradoCard` existentes (Plano 4) e confirmar que não quebraram**:
```bash
pnpm --filter @servico-feito/mobile test -- "formatarBRL|PropostaCard"
```
`PropostaCard.test.tsx` (Plano 4) tem um `getByText("R$ 300.00")` que agora vira `"R$ 300,00"` — **atualizar essa asserção** pro novo formato (é o único lugar que quebra; conferir se `ContratoGeradoCard` tem teste próprio — hoje não tem, só é exercitado indiretamente por `ConversaScreen.test.tsx`, que não afirma o texto do valor — conferir mesmo assim).
- [ ] **Step 6: `tsc --noEmit`** → 0.
- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/shared/lib/formatarBRL.ts apps/mobile/src/shared/lib/formatarBRL.test.ts apps/mobile/src/features/propostas/components/PropostaCard.tsx apps/mobile/src/features/propostas/components/ContratoGeradoCard.tsx apps/mobile/src/features/propostas/components/PropostaCard.test.tsx
git commit -m "feat(mobile): formatarBRL + retrofit em PropostaCard/ContratoGeradoCard (Plano 5)"
```

---

## Task 6: Hooks de contratação — `useContratacaoPorProposta`, `useMinhasContratacoes`, `useCancelarContratacao`

**Files:**
- Create: `apps/mobile/src/features/contratacoes/hooks/{useContratacaoPorProposta.ts, useMinhasContratacoes.ts, useCancelarContratacao.ts}`
- Test: `apps/mobile/src/features/contratacoes/hooks/contratacoesHooks.test.tsx`

**Interfaces:**
- Consumes: `repositories.contratacoes` (Task 3); `Contratacao` (Task 2); `useAuthStore`; `queryClient`.
- Produces:

```ts
// useContratacaoPorProposta.ts — modelo: useMinhasConversas.ts (Plano 4)
export function useContratacaoPorProposta(propostaId: string) {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  return useQuery<Contratacao>({
    queryKey: ["contratacao", "proposta", propostaId],
    enabled: !!propostaId && !!usuarioId,
    queryFn: () => repositories.contratacoes.obterPorProposta(propostaId, usuarioId ?? ""),
  });
}

// useMinhasContratacoes.ts
export function useMinhasContratacoes() {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  return useQuery<Contratacao[]>({
    queryKey: ["contratacoes", "minhas"],
    enabled: !!usuarioId,
    queryFn: () => repositories.contratacoes.listarMinhas(usuarioId ?? ""),
  });
}

// useCancelarContratacao.ts
export function useCancelarContratacao(propostaId: string, demandaId: string | null) {
  return useMutation<void, unknown, string>({   // variavel = contratacaoId
    mutationFn: (contratacaoId) => repositories.contratacoes.cancelar(contratacaoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratacao", "proposta", propostaId] });
      queryClient.invalidateQueries({ queryKey: ["contratacoes", "minhas"] });
      queryClient.invalidateQueries({ queryKey: ["conversas", "minhas"] });
      if (demandaId) {
        queryClient.invalidateQueries({ queryKey: ["demandas", "detalhe", demandaId] });
        queryClient.invalidateQueries({ queryKey: ["demandas", "abertas"] });
      }
    },
  });
}
```

- [ ] **Step 1: Escrever o teste que falha** (`contratacoesHooks.test.tsx`) — `jest.mock("@/shared/api/repositories", ...)`, `jest.mock("@/shared/store/authStore", ...)`, `jest.mock("@/shared/query/queryClient", () => ({ queryClient: { invalidateQueries: jest.fn() } }))`, `criarWrapperQuery()` **dentro de `beforeEach`**. Casos:
  1. `useContratacaoPorProposta("p1")` → chama `obterPorProposta("p1", "u1")`.
  2. `useMinhasContratacoes()` → chama `listarMinhas("u1")`.
  3. `useCancelarContratacao("p1", "d1")` sucesso → `invalidateQueries` chamado pras 5 chaves (`["contratacao","proposta","p1"]`, `["contratacoes","minhas"]`, `["conversas","minhas"]`, `["demandas","detalhe","d1"]`, `["demandas","abertas"]`).
  4. `useCancelarContratacao("p1", null)` sucesso → **sem** `["demandas","detalhe",…]`, as outras 3 continuam.
  5. `useCancelarContratacao` rejeitando (`{ code: "conflito" }`) → `isError` true, `invalidateQueries` não chamado.
- [ ] **Step 2: Rodar e confirmar falha**.
- [ ] **Step 3: Implementar os 3 hooks**.
- [ ] **Step 4: Rodar e confirmar verde** + `tsc` 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/contratacoes/hooks apps/mobile/src/features/contratacoes/hooks/contratacoesHooks.test.tsx
git commit -m "feat(mobile): hooks de contratacao (Plano 5)"
```

---

## Task 7: Hooks de tarefas — `useTarefasDaDemanda`, `useMarcarTarefaConcluida`

**Files:**
- Create: `apps/mobile/src/features/tarefas/hooks/{useTarefasDaDemanda.ts, useMarcarTarefaConcluida.ts}`
- Test: `apps/mobile/src/features/tarefas/hooks/tarefasHooks.test.tsx`

**Interfaces:**
- Consumes: `repositories.tarefas` (Task 4); `Tarefa` (Task 2); `queryClient`.
- Produces:

```ts
export function useTarefasDaDemanda(demandaId: string) {
  return useQuery<Tarefa[]>({
    queryKey: ["tarefas", "demanda", demandaId],
    enabled: !!demandaId,
    queryFn: () => repositories.tarefas.listarDaDemanda(demandaId),
  });
}

export function useMarcarTarefaConcluida(demandaId: string) {
  return useMutation<void, unknown, { tarefaId: string; concluida: boolean }>({
    mutationFn: (v) => repositories.tarefas.marcarConcluida(v.tarefaId, v.concluida),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tarefas", "demanda", demandaId] }),
  });
}
```

- [ ] **Step 1: Escrever o teste que falha** — `useTarefasDaDemanda("d1")` chama `listarDaDemanda("d1")`; `useTarefasDaDemanda("")` fica `idle` (gate `enabled`); `useMarcarTarefaConcluida("d1")` com `mutate({ tarefaId: "t1", concluida: true })` chama `marcarConcluida("t1", true)` e invalida `["tarefas","demanda","d1"]`.
- [ ] **Step 2: Rodar e confirmar falha**.
- [ ] **Step 3: Implementar os 2 hooks**.
- [ ] **Step 4: Rodar e confirmar verde** + `tsc` 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/tarefas/hooks apps/mobile/src/features/tarefas/hooks/tarefasHooks.test.tsx
git commit -m "feat(mobile): hooks de tarefas (Plano 5)"
```

---

## Task 8: `ContratacaoRow` + `TarefaRow`

**Files:**
- Create: `apps/mobile/src/features/contratacoes/components/ContratacaoRow.tsx`
- Create: `apps/mobile/src/features/tarefas/components/TarefaRow.tsx`

Componentes puros, sem hooks nem store — seguem o mesmo estilo de `ConversaRow.tsx` (Plano 4: `Pressable` + `accessibilityRole="button"` + tokens `sf-*`).

**Interfaces:**
```ts
// ContratacaoRow.tsx
export function ContratacaoRow({ contratacao, onPress }: { contratacao: Contratacao; onPress: () => void }) { … }
// mostra: status em PT (mapa local — ver ContratacaoScreen, Task 9, pra manter o mapa num só lugar; se
// ContratacaoRow precisar do mesmo mapa, extrair um `statusContratacaoLabel(status): string` em
// `@/features/contratacoes/lib/statusContratacaoLabel.ts` e os dois (Row e Screen) importam de lá),
// contratacao.tituloServico, contratacao.outroNome ?? "Usuário", formatarBRL(contratacao.valorTotal).

// TarefaRow.tsx
export function TarefaRow({
  tarefa, interativo, onToggle,
}: { tarefa: Tarefa; interativo: boolean; onToggle: () => void }) { … }
// checkbox (View simples com sf-* tokens, sem lib de checkbox) + tarefa.nomeTarefa;
// Pressable com onPress={interativo ? onToggle : undefined}; opacidade reduzida quando !interativo.
```

Criar `apps/mobile/src/features/contratacoes/lib/statusContratacaoLabel.ts`:
```ts
const LABELS: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  AGENDADA: "Agendada",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};
export function statusContratacaoLabel(status: string): string {
  return LABELS[status] ?? status;
}
```

- [ ] **Step 1: Criar `statusContratacaoLabel.ts`** com o conteúdo acima.
- [ ] **Step 2: Criar `ContratacaoRow.tsx`** — `Pressable` (`accessibilityRole="button"`, `onPress`), mostra `statusContratacaoLabel(contratacao.status)`, `contratacao.tituloServico`, `contratacao.outroNome ?? "Usuário"`, `formatarBRL(contratacao.valorTotal)`. Tokens `sf-*` (mirror `ConversaRow.tsx`).
- [ ] **Step 3: Criar `TarefaRow.tsx`** — conforme a interface acima.
- [ ] **Step 4: `tsc --noEmit`** → 0. (Sem teste dedicado — são presentacionais simples, exercitados pelas telas nas Tasks 9/10.)
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/contratacoes/components/ContratacaoRow.tsx apps/mobile/src/features/contratacoes/lib/statusContratacaoLabel.ts apps/mobile/src/features/tarefas/components/TarefaRow.tsx
git commit -m "feat(mobile): ContratacaoRow, TarefaRow e statusContratacaoLabel (Plano 5)"
```

---

## Task 9: `ContratacaoScreen` + rota `contratacao/[id].tsx`

**Files:**
- Create: `apps/mobile/src/features/contratacoes/screens/{ContratacaoScreen.tsx, ContratacaoScreen.test.tsx}`
- Create: `apps/mobile/app/(app)/contratacao/[id].tsx`

**Interfaces:**
- Consumes: `useContratacaoPorProposta`, `useCancelarContratacao` (Task 6); `useTarefasDaDemanda`, `useMarcarTarefaConcluida` (Task 7); `TarefaRow` (Task 8); `statusContratacaoLabel` (Task 8); `formatarBRL` (Task 5); `useAuthStore`; `Botao`, `CarregandoEstado`, `ErroEstado`, `traduzErroRepo`; `RepoError` de `@/shared/api/repositories`; `Alert` de `react-native`; `router` de `expo-router`.

**Contrato:**

`apps/mobile/src/features/contratacoes/screens/ContratacaoScreen.tsx` — `id` é o `proposta_id` (a única chave que o card do chat conhece):

```tsx
export function ContratacaoScreen({ id }: { id: string }) {
  const usuarioId = useAuthStore((s) => s.usuarioId);
  const cq = useContratacaoPorProposta(id);
  const c = cq.data;

  const tarefasQ = useTarefasDaDemanda(c?.demandaId ?? "");
  const marcarTarefa = useMarcarTarefaConcluida(c?.demandaId ?? "");
  const cancelar = useCancelarContratacao(id, c?.demandaId ?? null);

  if (cq.isLoading) return <CarregandoEstado />;
  if (cq.isError || !c) return <ErroEstado mensagem={traduzErroRepo(cq.error)} onRetry={() => cq.refetch()} />;

  const souCliente = usuarioId === c.clienteId;

  function confirmarCancelamento() {
    Alert.alert(
      "Cancelar contratação?",
      "Isso não pode ser desfeito.",
      [
        { text: "Voltar", style: "cancel" },
        { text: "Cancelar contratação", style: "destructive", onPress: () => cancelar.mutate(c!.id) },
      ],
    );
  }

  return (
    <View className="flex-1 bg-sf-bg">
      <View className="flex-row items-center gap-3 px-4 py-3 border-b border-sf-outline bg-sf-bg">
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
          <Text className="text-sf-primary text-base">‹ Voltar</Text>
        </Pressable>
        <Text className="text-sf-text text-lg font-semibold" numberOfLines={1}>Contratação</Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        <Text className="text-2xl font-bold text-sf-text">{c.tituloServico}</Text>
        <Text className="text-sf-muted text-sm mt-0.5">{statusContratacaoLabel(c.status)}</Text>
        <Text className="text-sf-text text-lg font-semibold mt-2">{formatarBRL(c.valorTotal)}</Text>
        <Text className="text-sf-body text-sm mt-1">{c.outroNome ?? "Usuário"}</Text>

        {c.status === "AGUARDANDO_PAGAMENTO" ? (
          <View className="mt-6">
            <Text className="text-sf-muted text-sm mb-3">Pagamento estará disponível em breve.</Text>
            <Botao
              titulo="Cancelar contratação"
              variante="perigo"
              carregando={cancelar.isPending}
              onPress={confirmarCancelamento}
            />
            {erroContratacao(cancelar.error) ? (
              <Text className="text-sf-status-red mt-2">{erroContratacao(cancelar.error)}</Text>
            ) : null}
          </View>
        ) : null}

        {c.demandaId ? (
          <View className="mt-6 mb-10">
            <Text className="text-sf-text font-semibold mb-1">Tarefas</Text>
            {(tarefasQ.data ?? []).map((t) => (
              <TarefaRow
                key={t.id}
                tarefa={t}
                interativo={souCliente}
                onToggle={() => marcarTarefa.mutate({ tarefaId: t.id, concluida: !t.concluida })}
              />
            ))}
          </View>
        ) : (
          <View className="mb-10" />
        )}
      </ScrollView>
    </View>
  );
}
```

`erroContratacao(e: unknown): string | null` — local, mesmo padrão de `erroProposta` (`ConversaScreen.tsx`, Plano 4):
```ts
const ERRO_CONTRATACAO_GENERICO = "Não foi possível concluir. Tente de novo.";

export function erroContratacao(e: unknown): string | null {
  if (!e) return null;
  if (e instanceof RepoError) {
    switch (e.code) {
      case "nao_autorizado":
        return "Você não pode cancelar esta contratação.";
      case "conflito":
        return "Esta contratação não pode mais ser cancelada.";
      case "nao_encontrado":
        return "Contratação não encontrada.";
      default:
        return ERRO_CONTRATACAO_GENERICO;
    }
  }
  return ERRO_CONTRATACAO_GENERICO;
}
```
(`export` igual `erroProposta`, pra poder testar direto — ver Step 1.)

`apps/mobile/app/(app)/contratacao/[id].tsx`:
```tsx
import { useLocalSearchParams } from "expo-router";
import { ContratacaoScreen } from "@/features/contratacoes/screens/ContratacaoScreen";
export default function ContratacaoRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ContratacaoScreen id={id ?? ""} />;
}
```

## Test — `ContratacaoScreen.test.tsx` (NÃO sob `app/`)

Mockar `useContratacaoPorProposta`, `useTarefasDaDemanda`, `useMarcarTarefaConcluida`, `useCancelarContratacao`, `useAuthStore`, `expo-router` (`router.back`), e **`Alert`** de `react-native` via `jest.spyOn(Alert, "alert")`. Casos:
1. `status: "AGUARDANDO_PAGAMENTO"` → botão "Cancelar contratação" presente; press → `Alert.alert` chamado; invocar manualmente o `onPress` do botão `{ text: "Cancelar contratação" }` capturado no mock → `cancelar.mutate` chamado com `c.id`.
2. `status: "AGENDADA"` → botão "Cancelar contratação" ausente (`queryByText`).
3. `demandaId` não-nulo + `tarefasQ.data = [{ concluida: false, ... }]` + `souCliente = true` → `TarefaRow` interativo, `fireEvent.press` no checkbox → `marcarTarefa.mutate` chamado com `{ tarefaId, concluida: true }`.
4. mesmo cenário mas `souCliente = false` (usuarioId = prestadorId) → toggle não dispara `marcarTarefa.mutate` (checkbox não-interativo).
5. `cancelar.error = new RepoError("conflito", "x")` → texto de `erroContratacao` presente.
6. `erroContratacao` testado isoladamente (`it.each` dos 3 códigos + genérico + `null`), igual o padrão do `erroProposta` (Plano 4).

- [ ] **Step 1: Ler `ConversaScreen.tsx`/`.test.tsx`** (Plano 4, caminho já mapeado no Contexto de esquema) pra confirmar o padrão de cabeçalho/erro local antes de escrever.
- [ ] **Step 2: Escrever `ContratacaoScreen.test.tsx`** (6 casos acima). Ask now if unclear sobre como mockar `Alert.alert` de forma que capture o array de botões.
- [ ] **Step 3: Rodar e confirmar falha** — `pnpm --filter @servico-feito/mobile test -- ContratacaoScreen` → FAIL.
- [ ] **Step 4: Implementar `ContratacaoScreen.tsx`** + a rota.
- [ ] **Step 5: Rodar e confirmar verde** + `tsc --noEmit` 0.
- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/contratacoes/screens/ContratacaoScreen.tsx apps/mobile/src/features/contratacoes/screens/ContratacaoScreen.test.tsx "apps/mobile/app/(app)/contratacao/[id].tsx"
git commit -m "feat(mobile): tela de contratacao (detalhe, checklist, cancelar) (Plano 5)"
```

---

## Task 10: `TrabalhosScreen` (substitui o stub do shell) + wiring da aba

**Files:**
- Create: `apps/mobile/src/features/contratacoes/screens/{TrabalhosScreen.tsx, TrabalhosScreen.test.tsx}`
- Delete: `apps/mobile/src/features/shell/screens/TrabalhosScreen.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/trabalhos.tsx`
- Modify: `apps/mobile/app/(app)/(tabs)/_layout.tsx`

**Interfaces:**
- Consumes: `useMinhasContratacoes` (Task 6); `ContratacaoRow` (Task 8); estados/`traduzErroRepo`; `router`.

**Contrato** — mesmo shape do `ConversasListScreen.tsx` (Plano 4, colado no Contexto de esquema):

```tsx
export function TrabalhosScreen() {
  const q = useMinhasContratacoes();
  return (
    <View className="flex-1 bg-sf-bg">
      {q.isLoading ? (
        <CarregandoEstado />
      ) : q.isError || !q.data ? (
        <ErroEstado mensagem={traduzErroRepo(q.error)} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <VazioEstado mensagem="Nenhuma contratação ainda." />
      ) : (
        <FlatList
          data={q.data}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <ContratacaoRow contratacao={item} onPress={() => router.push(`/contratacao/${item.propostaId}`)} />
          )}
        />
      )}
    </View>
  );
}
```
(**sem** `use…Realtime()` — não há realtime pra contratações neste plano.)

`app/(app)/(tabs)/trabalhos.tsx`:
```tsx
import { TrabalhosScreen } from "@/features/contratacoes/screens/TrabalhosScreen";
export default function TrabalhosRoute() { return <TrabalhosScreen />; }
```

`app/(app)/(tabs)/_layout.tsx` — trocar a linha da aba `trabalhos` de:
```tsx
<Tabs.Screen name="trabalhos" options={{ title: "Trabalhos", href: prestar ? "/(app)/(tabs)/trabalhos" : null }} />
```
para (sem gate de modo — cliente também vê as próprias contratações):
```tsx
<Tabs.Screen name="trabalhos" options={{ title: "Trabalhos" }} />
```
(**não mexer** nas linhas de `buscar`/`vagas` — continuam com o gate de modo que já tinham.)

## Test — `TrabalhosScreen.test.tsx`

Mesmo padrão de `ConversasListScreen.test.tsx` (Plano 4): mockar `useMinhasContratacoes`, `expo-router`. Casos: loading; vazio (`"Nenhuma contratação ainda."`); lista com 1 item (`ContratacaoRow` renderiza status/título/outro/valor) + `fireEvent.press` → `router.push("/contratacao/<propostaId>")`.

- [ ] **Step 1: Escrever `TrabalhosScreen.test.tsx`**.
- [ ] **Step 2: Rodar e confirmar falha**.
- [ ] **Step 3: Implementar `TrabalhosScreen.tsx`**; deletar o stub do shell; atualizar `trabalhos.tsx` e `_layout.tsx`.
- [ ] **Step 4: Rodar e confirmar verde** — testes + `tsc --noEmit` 0. Rodar também `pnpm --filter @servico-feito/mobile test -- tabsLayout` (Plano 2, `src/app-tests/tabsLayout.test.tsx` — confirmar se esse teste afirma o `href` condicional da aba `trabalhos`; se afirmar, **atualizar** a asserção pra refletir a aba sempre visível — não afrouxar as outras).
- [ ] **Step 5: `grep -rn "shell/screens/TrabalhosScreen" apps/mobile`** → vazio.
- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/contratacoes/screens/TrabalhosScreen.tsx apps/mobile/src/features/contratacoes/screens/TrabalhosScreen.test.tsx "apps/mobile/app/(app)/(tabs)/trabalhos.tsx" "apps/mobile/app/(app)/(tabs)/_layout.tsx"
git rm apps/mobile/src/features/shell/screens/TrabalhosScreen.tsx
# se o Step 4 tocou em src/app-tests/tabsLayout.test.tsx, incluir no add
git commit -m "feat(mobile): tela Trabalhos = minhas contratacoes; aba visivel nos 2 modos (Plano 5)"
```

---

## Task 11: Wiring — `ContratoGeradoCard` clicável no `ConversaScreen`

**Files:**
- Modify: `apps/mobile/src/features/conversas/screens/ConversaScreen.tsx`
- Modify: `apps/mobile/src/features/conversas/screens/ConversaScreen.test.tsx`

**Mudança** — no `renderItem`, caso `"CONTRATO_GERADO"` (arquivo atual, ver Contexto de esquema), envolver o `ContratoGeradoCard` (componente puro do Plano 4, **não mexido**) num `Pressable`:

```tsx
if (item.tipo === "CONTRATO_GERADO") {
  const p = propostasQ.data?.find((x) => x.id === item.propostaId);
  return (
    <Pressable onPress={() => item.propostaId && router.push(`/contratacao/${item.propostaId}`)}>
      <ContratoGeradoCard valor={p?.valor ?? 0} />
    </Pressable>
  );
}
```
(`Pressable` e `router` já importados no arquivo — Plano 4.)

- [ ] **Step 1: Escrever o caso de teste que falha** — em `ConversaScreen.test.tsx`, no cenário existente que renderiza `tipo: "CONTRATO_GERADO"` (ver o caso 3 do Plano 4: `getByText(/Contrato gerado/)`), adicionar `fireEvent.press` no elemento e `expect(router.push).toHaveBeenCalledWith("/contratacao/<propostaId do fixture>")`. Se o teste atual não tiver um elemento facilmente clicável (ex.: `Text` sem role), usar `fireEvent.press(getByText(/Contrato gerado/))` — o `Pressable` propaga o evento pro filho.
- [ ] **Step 2: Rodar e confirmar falha** — `pnpm --filter @servico-feito/mobile test -- ConversaScreen` → FAIL só no novo caso.
- [ ] **Step 3: Implementar a mudança** no `renderItem`.
- [ ] **Step 4: Rodar a suíte inteira de `ConversaScreen` e confirmar verde** (os outros 5+ casos não podem quebrar) + `tsc --noEmit` 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/conversas/screens/ConversaScreen.tsx apps/mobile/src/features/conversas/screens/ConversaScreen.test.tsx
git commit -m "feat(mobile): card de contrato gerado navega pra tela de contratacao (Plano 5)"
```

---

## Task 12: Gate final e follow-ups

**Files:** conforme necessário pra zerar lint/tsc.

- [ ] **Step 1: pgTAP (só se `.env` existir — mesma checagem da Task 1)**

```bash
set -a && . ./.env && set +a
node supabase/tests/run.mjs
```
Esperado: `todos os testes pgTAP passaram` (0000–0026). Se não houver `.env`: pular, e anotar a pendência (ver Step 7).

- [ ] **Step 2: `tsc`**

Run: `pnpm --filter @servico-feito/mobile exec tsc --noEmit` → 0 erros.

- [ ] **Step 3: Jest completo**

Run: `pnpm --filter @servico-feito/mobile test` → verde, auto-encerra. Conferir a contagem de suítes/testes cresceu em relação ao HEAD pré-Plano-5 (44 suites / 172 testes) e nada regrediu.

- [ ] **Step 4: ESLint**

Run: `pnpm --filter @servico-feito/mobile exec eslint .` → 0 erros (warnings `import/first` pré-existentes tolerados).

- [ ] **Step 5: expo-doctor + export**

```bash
pnpm --filter @servico-feito/mobile exec expo-doctor
pnpm --filter @servico-feito/mobile exec expo export --platform ios
```
Esperado: 18/18 (ou as 2 falhas de rede pra API da Expo, se o sandbox não tiver acesso — não é defeito, documentar); `expo export` EXIT 0. Isso valida a rota nova `contratacao/[id].tsx` no `app/`.

- [ ] **Step 6: Limpar o artefato de export**

```bash
rm -rf apps/mobile/dist
```

- [ ] **Step 7: Registrar pendências**

Anotar (em relatório final, sem arquivo novo necessário):
- Se `.env` não existiu neste ambiente: `pnpm db:push && node supabase/tests/run.mjs && pnpm db:types` fica pendente pro usuário rodar no projeto dev — esperar pgTAP `0026` (13 ok) verde e regen limpo de `packages/db-types/index.ts` (substitui o hand-add da Task 1).
- Fora de escopo confirmado no design: Pix/EFI real (Plano 6), `EM_ANDAMENTO`/`concluir-execucao`, avaliações (Plano 7), reagendar/disputa/reembolso.

- [ ] **Step 8: Commit final (se houve ajuste de lint/tsc)**

```bash
git add -A
git commit -m "chore(mobile): gate final do Plano 5 (tsc/lint)"
```

- [ ] **Step 9: Finalizar a branch** — usar `superpowers:finishing-a-development-branch` (base `homolog`).

---

## Self-Review

**1. Cobertura da spec:**

| Item da spec | Task |
|---|---|
| `fn_cancelar_contratacao` (idempotente, PT401/404/409, reverte demanda, mensagem SISTEMA, notificação) | 1 |
| `contratacoesRepository` (`obterPorProposta`, `listarMinhas`, `cancelar`) | 3 |
| `tarefasRepository` (`listarDaDemanda`, `marcarConcluida`, escrita direta) | 4 |
| `formatarBRL` + retrofit `PropostaCard`/`ContratoGeradoCard` | 5 |
| Hooks de contratação (3) + invalidação cross-domínio | 6 |
| Hooks de tarefas (2) | 7 |
| `ContratacaoRow`, `TarefaRow`, `statusContratacaoLabel` | 8 |
| `ContratacaoScreen` (detalhe, cancelar com confirmação, checklist gated por papel) + rota | 9 |
| `TrabalhosScreen` (substitui stub) + aba visível nos 2 modos | 10 |
| `ContratoGeradoCard` clicável | 11 |
| Gate final | 12 |
| **Fora de escopo** (Pix/EFI, EM_ANDAMENTO, avaliações) | — nenhuma task cobre; correto |

**2. Placeholders:** nenhum "TODO"/"TBD". O único ponto de decisão aberta na Task 8 (`ContratacaoRow` reusar `statusContratacaoLabel` em vez de duplicar o mapa) já vem resolvido com o arquivo compartilhado — não é um placeholder, é a decisão tomada.

**3. Consistência de tipos:** `Contratacao`/`Tarefa` (Task 2) usados idênticos em Tasks 3, 6, 8, 9, 10. `repositories.{contratacoes,tarefas}` (Tasks 3–4) consumidos por Tasks 6–7. `formatarBRL` (Task 5) consumido por Tasks 8, 9, 10 e retrofitado em componentes do Plano 4. Query keys (`["contratacao","proposta",propostaId]`, `["contratacoes","minhas"]`, `["tarefas","demanda",demandaId]`) idênticas em todas as ocorrências (Tasks 6, 7, 9, 10). Rota `contratacao/[id].tsx` com `id = proposta_id` consistente entre Task 9 (a tela), Task 10 (`ContratacaoRow.onPress`) e Task 11 (`ConversaScreen`).
