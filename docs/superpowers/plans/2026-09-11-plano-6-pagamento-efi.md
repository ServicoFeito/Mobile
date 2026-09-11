# Plano 6 — Pagamento Pix/EFI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar o ciclo Contratação → Pagamento → Execução → Pagamento final: entrada 50% via Pix/EFI libera a execução (`AGENDADA`), o prestador marca início/fim (`EM_ANDAMENTO`), o pagamento final 50% confirma a conclusão (`CONCLUIDA`).

**Architecture:** Duas peças novas: (1) duas RPCs `SECURITY DEFINER` (`fn_iniciar_execucao`, `fn_concluir_execucao`) no mesmo padrão idempotente/SQLSTATE de `fn_aceitar_proposta`/`fn_cancelar_contratacao`, pra transições que são só banco; (2) duas Edge Functions Deno (`criar-cobranca-pix`, `efi-webhook`) — as únicas que falam com a EFI (OAuth + mTLS) ou recebem HTTP público. `fn_aceitar_proposta` (Plano 4) ganha um fix: hoje não cria o `pagamentos` ENTRADA que deveria. Repository/hook/tela seguem o padrão dos Planos 3–5.

**Tech Stack:** Expo SDK 52 · Expo Router 4 · RN 0.76.9 · TypeScript 5.6 strict + `noUncheckedIndexedAccess` · `@supabase/supabase-js` 2.x (app) e `npm:@supabase/supabase-js@2` (Deno) · `@tanstack/react-query` 5 · Zustand 5 · NativeWind 4.1.23 · Jest (`jest-expo`) + `@testing-library/react-native` · Postgres + pgTAP · Deno (Supabase Edge Functions) + `npm:node-forge` (extração do `.p12`).

**Spec:** `docs/superpowers/specs/2026-09-11-plano-6-pagamento-efi-design.md`

## Global Constraints

- **Base:** branch a partir de `homolog` @ `a5067d4` (Planos 1–5 mergeados + spec deste plano commitada). `git config user`: `VitorHugoVH` / `vhfraga007@gmail.com`. Conventional Commits.
- **Sem Docker / sem Postgres local.** Migration aplicada com `pnpm db:push`; pgTAP com `pnpm db:test` (`supabase/tests/run.mjs`). Antes de qualquer `db:*`: `set -a && . ./.env && set +a`.
- **Se este ambiente de execução não tiver `.env`/link Supabase** (confirmar com `ls supabase/.temp/` e `env | grep SUPABASE` antes da Task 1): escrever e commitar migration + pgTAP com verificação estática máxima (ler o plpgsql, conferir cada tabela/coluna/enum contra os arquivos dos Planos 1/4/5, traçar cada assert à mão), **sem rodar** `db:push`/`db:test`. `packages/db-types/index.ts`: hand-add as entradas novas em `Database["public"]["Functions"]`, no formato exato que `supabase gen types` produziria. Decisão tomada uma vez no início da Task 1, vale pro resto do plano.
- **Edge Functions nunca rodam nem fazem deploy nesta sessão** (sem `SUPABASE_ACCESS_TOKEN`/projeto linkado, sem acesso à sandbox EFI). `criar-cobranca-pix` e `efi-webhook` são escritas e revisadas estaticamente (ler o TypeScript linha a linha contra a doc da API EFI referenciada na spec, conferir tipos e o fluxo de erro) — **nenhum comando `supabase functions deploy`/`serve` é executado por um worker desta plano**. Isso é uma decisão do usuário (spec §1), documentar no relatório de cada task de Edge Function.
- `supabase/functions/**/*.ts` **não** entra no `tsc --noEmit` do workspace mobile (é Deno, roda fora do `apps/mobile/tsconfig`) — não rodar `tsc` contra esses arquivos; a verificação é leitura cuidadosa + comparação com a doc EFI da spec.
- Migration nova sempre com teste pgTAP em `supabase/tests/*.test.sql` (`begin … select plan(N); … select * from finish(); rollback;`). Migration sem teste não é considerada pronta.
- Toda função/trigger SQL: `language plpgsql`, `security definer`, `set search_path = ''`, objetos schema-qualificados (`public.`, `auth.`). Comparação de `auth.uid()` contra um "dono" usa `is distinct from` (nunca `=` nem `not in` com possível `NULL`).
- `CodigoRepo` (`apps/mobile/src/shared/api/repositories/types.ts`) já mapeia `PT401→nao_autorizado`, `PT404→nao_encontrado`, `PT409→conflito` (Plano 4) — **sem mudança nesse arquivo**. Edge Functions respondem o mesmo formato `{ error: { code } }` com status HTTP 401/404/409/502 pra que `normalizarErro` trate igual.
- Toda edição no barrel `apps/mobile/src/shared/api/repositories/index.ts` é **aditiva**.
- Nenhum `*.test.*` dentro de `apps/mobile/app/`. Todo hook react-query nos testes usa `criarWrapperQuery()` de `@/test/criarWrapperQuery`, instanciado **dentro de `beforeEach`**. Seletores Zustand em telas são atômicos.
- Repositories: cada método `.supabase.ts`: `try` a chamada → mapeia linha→domínio camelCase → retorna; `catch (e) { throw normalizarErro(e) }`; `{ error }` não-nulo → `throw normalizarErro(error)`. Nunca vaza `PostgrestError`/erro cru de `functions.invoke`.
- `RepoError` importa de `@/shared/api/repositories` nos arquivos de feature.
- Gate final: `tsc --noEmit` 0 · `jest` verde e auto-encerrando · `eslint` 0 erros · `expo-doctor` 18/18 (ou falhas de rede documentadas) · `expo export --platform ios` EXIT 0 · `pnpm db:push`/`pnpm db:test` (só se `.env` existir).

---

## File Structure

```
supabase/migrations/<TS1>_fn_aceitar_proposta_pagamento_entrada.sql
supabase/migrations/<TS2>_fn_execucao_pagamento.sql
supabase/tests/0024_fn_propostas.test.sql                         (modificar — +2 asserts)
supabase/tests/0027_fn_execucao_pagamento.test.sql
packages/db-types/index.ts                                        (modificar — hand-add, ver Task 2)
supabase/config.toml                                               (modificar — verify_jwt=false pra efi-webhook)

supabase/functions/
  _shared/cors.ts
  _shared/auth.ts
  _shared/efi.ts
  criar-cobranca-pix/index.ts
  efi-webhook/index.ts

apps/mobile/src/features/pagamentos/
  types/pagamento.types.ts
  hooks/usePagamentoPendente.ts  useCriarCobranca.ts  usePagamentoStatus.ts
  screens/PagamentoScreen.tsx  PagamentoScreen.test.tsx

apps/mobile/src/features/contratacoes/
  hooks/useIniciarExecucao.ts  useConcluirExecucao.ts  (novos, ao lado dos do Plano 5)
  screens/ContratacaoScreen.tsx  ContratacaoScreen.test.tsx           (modificar)

apps/mobile/src/shared/api/repositories/
  pagamentos/pagamentosRepository.ts  .supabase.ts  .supabase.test.ts
  contratacoes/contratacoesRepository.ts  .supabase.ts  .supabase.test.ts  (modificar — +2 métodos)
  index.ts                                                          (modificar, aditivo)

apps/mobile/app/(app)/pagamento/[contratacaoId].tsx                 (novo)

apps/mobile/package.json  pnpm-lock.yaml                            (modificar — +expo-clipboard)
```

## Contexto de esquema (fatos verificados — não re-descobrir)

- **`pagamentos`** (`20260908144223_contratacoes.sql`): `id, contratacao_id uuid NOT NULL FK contratacoes ON DELETE CASCADE, valor numeric(10,2) CHECK >=0, tipo tipo_pagamento NOT NULL ('ENTRADA'|'FINAL'), status status_pagamento NOT NULL default 'PENDENTE' ('PENDENTE'|'PROCESSANDO'|'PAGO'|'CANCELADO'|'EXPIRADO'), gateway text default 'EFI_PIX', txid text UNIQUE, efi_loc_id bigint, pix_copia_cola text, qr_code_base64 text, data_pagamento timestamptz, created_at, updated_at`. `unique (contratacao_id, tipo)` — só um pagamento de cada tipo por contratação. Trigger `pagamentos_set_updated_at` já existe. RLS/grants: **igual `contratacoes`** — sem `INSERT`/`UPDATE` pra `authenticated`, só `service_role`/RPC (`20260908152214_rls_contratacoes.sql` + `20260908200154_rls_hardening.sql`).
- **`contratacoes`**: como documentado no Plano 5 — sem grant de escrita pra `authenticated`. `valor_entrada`/`valor_final` são `numeric(10,2) generated always as (round(valor_total * 0.50, 2)) stored`.
- **`fn_aceitar_proposta`** (`supabase/migrations/20260910000003_fn_propostas.sql`, íntegra atual — Plano 4/5):
  ```sql
  create or replace function public.fn_aceitar_proposta(p_proposta_id uuid)
  returns uuid
  language plpgsql
  security definer
  set search_path = ''
  as $$
  declare
    v_prop         public.propostas%rowtype;
    v_titulo       text;
    v_contratacao  uuid;
    v_dem_status   public.status_demanda;
  begin
    select * into v_prop from public.propostas where id = p_proposta_id for update;
    if not found then
      raise exception 'proposta_inexistente' using errcode = 'PT404';
    end if;

    if (select auth.uid()) is distinct from v_prop.cliente_id then
      raise exception 'nao_autorizado' using errcode = 'PT401';
    end if;

    if v_prop.status = 'ACEITA' then
      select id into v_contratacao from public.contratacoes where proposta_id = p_proposta_id;
      if v_contratacao is null then
        raise exception 'contratacao_ausente' using errcode = 'PT409';
      end if;
      return v_contratacao;
    end if;

    if v_prop.status not in ('ENVIADA', 'VISUALIZADA') then
      raise exception 'proposta_indisponivel' using errcode = 'PT409';
    end if;

    if v_prop.demanda_id is not null then
      select status into v_dem_status from public.demandas_servico where id = v_prop.demanda_id for update;
      if v_dem_status in ('CONTRATADA', 'FINALIZADA', 'CANCELADA') then
        raise exception 'demanda_indisponivel' using errcode = 'PT409';
      end if;
    end if;

    update public.propostas set status = 'ACEITA' where id = p_proposta_id;

    if v_prop.demanda_id is not null then
      update public.propostas
        set status = 'RECUSADA'
        where demanda_id = v_prop.demanda_id and id <> p_proposta_id and status in ('ENVIADA', 'VISUALIZADA');
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
      raise exception 'proposta_indisponivel' using errcode = 'PT409';
    end;

    if v_prop.demanda_id is not null then
      update public.demandas_servico set status = 'CONTRATADA' where id = v_prop.demanda_id;
    end if;

    insert into public.mensagens (conversa_id, remetente_id, tipo, corpo, proposta_id)
    values (v_prop.conversa_id, v_prop.prestador_id, 'CONTRATO_GERADO', 'Contrato gerado', p_proposta_id);

    insert into public.notificacoes (usuario_id, titulo, mensagem, tipo, referencia_id)
    values (v_prop.prestador_id, 'Proposta aceita', 'Sua proposta foi aceita. O contrato foi gerado.', 'CONTRATACAO', v_contratacao);

    return v_contratacao;
  end;
  $$;

  revoke execute on function public.fn_aceitar_proposta(uuid) from public, anon;
  revoke execute on function public.fn_recusar_proposta(uuid) from public, anon;
  grant execute on function public.fn_aceitar_proposta(uuid) to authenticated;
  grant execute on function public.fn_recusar_proposta(uuid) to authenticated;
  ```
  `fn_recusar_proposta` está no mesmo arquivo, **não muda** — só reproduzido acima porque os dois `revoke`/`grant` finais do arquivo cobrem as duas funções; o `create or replace` da Task 1 mexe **só** em `fn_aceitar_proposta`, o resto do arquivo original fica igual.
- **`ContratacaoScreen.tsx`** (Plano 5, atual — íntegra, é o arquivo que a Task 12 modifica):
  ```tsx
  import { Alert, Pressable, ScrollView, Text, View } from "react-native";
  import { router } from "expo-router";
  import { RepoError } from "@/shared/api/repositories";
  import { Botao } from "@/shared/components/atoms/Botao";
  import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";
  import { ErroEstado } from "@/shared/components/molecules/ErroEstado";
  import { traduzErroRepo } from "@/shared/lib/traduzErroRepo";
  import { formatarBRL } from "@/shared/lib/formatarBRL";
  import { useAuthStore } from "@/shared/store/authStore";
  import { statusContratacaoLabel } from "@/features/contratacoes/lib/statusContratacaoLabel";
  import { useContratacaoPorProposta } from "@/features/contratacoes/hooks/useContratacaoPorProposta";
  import { useCancelarContratacao } from "@/features/contratacoes/hooks/useCancelarContratacao";
  import { useTarefasDaDemanda } from "@/features/tarefas/hooks/useTarefasDaDemanda";
  import { useMarcarTarefaConcluida } from "@/features/tarefas/hooks/useMarcarTarefaConcluida";
  import { TarefaRow } from "@/features/tarefas/components/TarefaRow";

  const ERRO_CONTRATACAO_GENERICO = "Não foi possível concluir. Tente de novo.";

  export function erroContratacao(e: unknown): string | null {
    if (!e) return null;
    if (e instanceof RepoError) {
      switch (e.code) {
        case "nao_autorizado": return "Você não pode cancelar esta contratação.";
        case "conflito": return "Esta contratação não pode mais ser cancelada.";
        case "nao_encontrado": return "Contratação não encontrada.";
        default: return ERRO_CONTRATACAO_GENERICO;
      }
    }
    return ERRO_CONTRATACAO_GENERICO;
  }

  export function ContratacaoScreen({ id }: { id: string }) {
    const usuarioId = useAuthStore((s) => s.usuarioId);
    const cq = useContratacaoPorProposta(id);
    const c = cq.data;

    const tarefasQ = useTarefasDaDemanda(c?.demandaId ?? "");
    const marcarTarefa = useMarcarTarefaConcluida(c?.demandaId ?? "");
    const cancelar = useCancelarContratacao(id, c?.demandaId ?? null);

    if (cq.isLoading) return <CarregandoEstado />;
    if (cq.isError || !c) {
      return <ErroEstado mensagem={traduzErroRepo(cq.error)} onRetry={() => cq.refetch()} />;
    }

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
          <Text className="text-sf-text text-lg font-semibold" numberOfLines={1}>
            Contratação
          </Text>
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

          {c.demandaId && (tarefasQ.data ?? []).length > 0 ? (
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
- **`Botao`** (`@/shared/components/atoms/Botao`): `{ titulo, onPress, carregando?, desabilitado?, variante?: "primario"|"perigo"|"secundario" }` — sem variante nova necessária neste plano.
- **`useCancelarContratacao.ts`** / **`useContratacaoPorProposta.ts`** (Plano 5) são os modelos de mutation/query a seguir (mutation com `onSuccess` invalidando por `queryKey`; query com `enabled` guard).
- **`mensagens`**: `remetente_id uuid NOT NULL FK usuarios`, `corpo text NOT NULL default ''`. `handle_new_mensagem` (`20260910000001_chat_triggers.sql`) já tem o `case` `'PAGAMENTO_CONFIRMADO' then '💰 Pagamento confirmado'` pronto — **nenhuma mudança de trigger neste plano**. Como o webhook roda sem `auth.uid()` (endpoint público, `service_role`), o `remetente_id` da mensagem `PAGAMENTO_CONFIRMADO` usa `contratacao.cliente_id` (quem pagou) — decisão deste plano, documentada na Task 6.
- **`notificacoes`**: `usuario_id, titulo, mensagem, tipo (tipo_notificacao: PROPOSTA|PAGAMENTO|MENSAGEM|CONTRATACAO|AVALIACAO), referencia_id, lida, created_at`. Pagamento usa `tipo = 'PAGAMENTO'`.
- **`repositories/index.ts`** atual (barrel, Plano 5): objeto `repositories` com `categorias, enderecos, demandas, prestadores, conversas, mensagens, propostas, contratacoes, tarefas`; `export type { ... }` por repo; `export { RepoError, normalizarErro }` + `export type { CodigoRepo, PageParams, Pagina }` de `./types`. Este plano adiciona `pagamentos` ao objeto e `export type { PagamentosRepository }`.
- **`packages/db-types/index.ts`** — bloco `Database["public"]["Functions"]` atual, em ordem alfabética: `fn_aceitar_proposta` (`Args: { p_proposta_id: string }`, `Returns: string`), `fn_cancelar_contratacao` (`Args: { p_contratacao_id: string }`, `Returns: undefined`), `fn_e_participante` (`Args: { p_conversa_id: string }`, `Returns: boolean`), `fn_recusar_proposta` (`Args: { p_proposta_id: string }`, `Returns: undefined`), `fn_tem_perfil_prestador` (`Args: { p_usuario_id?: string }`, `Returns: boolean`). `fn_concluir_execucao` entra **entre** `fn_cancelar_contratacao` e `fn_e_participante`; `fn_iniciar_execucao` entra **entre** `fn_e_participante` e `fn_recusar_proposta`.
- **`apps/mobile/package.json`** `dependencies` (ordem alfabética real do arquivo): `@babel/runtime, @react-native-async-storage/async-storage, @react-navigation/native, @supabase/supabase-js, @tanstack/react-query, expo, expo-constants, expo-linking, expo-router, expo-secure-store, expo-status-bar, nativewind, react, react-native, react-native-css-interop, react-native-gesture-handler, react-native-reanimated, react-native-safe-area-context, react-native-screens, zustand`. `expo-clipboard` entra entre `expo` e `expo-constants` (ordem alfabética: `expo-cl` < `expo-co`).
- **`supabase/config.toml`** já tem o bloco `[edge_runtime] enabled = true` e um exemplo comentado `# [functions.MY_FUNCTION_NAME] ... # verify_jwt = true` — a Task 11 descomenta/adapta pra `[functions.efi-webhook]` com `verify_jwt = false`.
- **`supabase/tests/`** numerados até `0026_fn_cancelar_contratacao.test.sql` (Plano 5) — próximo arquivo é `0027`.
- **App**: `supabase` de `@/shared/api/supabaseClient`; `queryClient` de `@/shared/query/queryClient`; `useAuthStore` (`s.usuarioId: string | null`); `criarWrapperQuery()` em `@/test/criarWrapperQuery`; `traduzErroRepo(e): string`.

---

## Task 1: Fix `fn_aceitar_proposta` — cria `pagamentos` ENTRADA

**Files:**
- Create: `supabase/migrations/<TS1>_fn_aceitar_proposta_pagamento_entrada.sql` (gerar com `pnpm db:new fn_aceitar_proposta_pagamento_entrada`; se falhar por falta de link, criar à mão com timestamp UTC `> 20260910120001`, ex. `20260911090001`)
- Modify: `supabase/tests/0024_fn_propostas.test.sql`

**Interfaces:**
- Produces: `fn_aceitar_proposta` continua com a mesma assinatura (`p_proposta_id uuid) returns uuid`) — sem mudança de tipo, `db-types` não precisa de edição nesta task.

- [ ] **Step 1: Confirmar se há `.env`/link neste ambiente de execução**

```bash
ls supabase/.temp/ 2>&1; env | grep -i SUPABASE
```
Sem `.env`/link: resto da task é escrever + verificar estaticamente + commitar, sem `db:push`/`db:test`.

- [ ] **Step 2: Escrever a migration** — `create or replace function public.fn_aceitar_proposta`, corpo **idêntico** ao reproduzido na seção "Contexto de esquema" acima, com uma linha nova inserida logo **antes** do `insert into public.mensagens`:

```sql
create or replace function public.fn_aceitar_proposta(p_proposta_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prop         public.propostas%rowtype;
  v_titulo       text;
  v_contratacao  uuid;
  v_dem_status   public.status_demanda;
begin
  select * into v_prop from public.propostas where id = p_proposta_id for update;
  if not found then
    raise exception 'proposta_inexistente' using errcode = 'PT404';
  end if;

  if (select auth.uid()) is distinct from v_prop.cliente_id then
    raise exception 'nao_autorizado' using errcode = 'PT401';
  end if;

  if v_prop.status = 'ACEITA' then
    select id into v_contratacao from public.contratacoes where proposta_id = p_proposta_id;
    if v_contratacao is null then
      raise exception 'contratacao_ausente' using errcode = 'PT409';
    end if;
    return v_contratacao;
  end if;

  if v_prop.status not in ('ENVIADA', 'VISUALIZADA') then
    raise exception 'proposta_indisponivel' using errcode = 'PT409';
  end if;

  if v_prop.demanda_id is not null then
    select status into v_dem_status from public.demandas_servico where id = v_prop.demanda_id for update;
    if v_dem_status in ('CONTRATADA', 'FINALIZADA', 'CANCELADA') then
      raise exception 'demanda_indisponivel' using errcode = 'PT409';
    end if;
  end if;

  update public.propostas set status = 'ACEITA' where id = p_proposta_id;

  if v_prop.demanda_id is not null then
    update public.propostas
      set status = 'RECUSADA'
      where demanda_id = v_prop.demanda_id and id <> p_proposta_id and status in ('ENVIADA', 'VISUALIZADA');
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
    raise exception 'proposta_indisponivel' using errcode = 'PT409';
  end;

  if v_prop.demanda_id is not null then
    update public.demandas_servico set status = 'CONTRATADA' where id = v_prop.demanda_id;
  end if;

  -- Plano 6: cria o pagamento ENTRADA que fecha o ciclo de pagamento. O valor
  -- replica a formula da coluna gerada contratacoes.valor_entrada
  -- (round(valor_total * 0.50, 2)); valor_total = v_prop.valor por construcao.
  insert into public.pagamentos (contratacao_id, valor, tipo)
  values (v_contratacao, round(v_prop.valor * 0.50, 2), 'ENTRADA');

  insert into public.mensagens (conversa_id, remetente_id, tipo, corpo, proposta_id)
  values (v_prop.conversa_id, v_prop.prestador_id, 'CONTRATO_GERADO', 'Contrato gerado', p_proposta_id);

  insert into public.notificacoes (usuario_id, titulo, mensagem, tipo, referencia_id)
  values (v_prop.prestador_id, 'Proposta aceita', 'Sua proposta foi aceita. O contrato foi gerado.', 'CONTRATACAO', v_contratacao);

  return v_contratacao;
end;
$$;
```

Sem `revoke`/`grant` no fim — já feitos pela migration original e `create or replace` não os reseta.

- [ ] **Step 3: Estender o pgTAP em `supabase/tests/0024_fn_propostas.test.sql`**

Mudar `select plan(24);` (linha 2) para `select plan(27);` (24 originais + 3 novos — ver Step 3 abaixo).

Depois da linha (atual) `select is((select valor_total from public.contratacoes where proposta_id = 'b3333333-0000-0000-0000-000000000001'), 450.00, 'valor_total = valor da proposta');`, adicionar:

```sql
select is((select valor::numeric from public.pagamentos
             where contratacao_id = (select id from public.contratacoes where proposta_id = 'b3333333-0000-0000-0000-000000000001')
               and tipo = 'ENTRADA'),
          225.00, 'pagamento ENTRADA criado com metade do valor');
select is((select status::text from public.pagamentos
             where contratacao_id = (select id from public.contratacoes where proposta_id = 'b3333333-0000-0000-0000-000000000001')
               and tipo = 'ENTRADA'),
          'PENDENTE', 'pagamento ENTRADA comeca PENDENTE');
```

Depois da linha (atual) `select ok((select demanda_id from public.contratacoes where proposta_id = 'b3333333-0000-0000-0000-000000000004') is null, 'DIRETA: contratacao sem demanda_id');`, adicionar (cobre o caminho DIRETA, valor 200.00 → entrada 100.00):

```sql
select is((select valor::numeric from public.pagamentos
             where contratacao_id = (select id from public.contratacoes where proposta_id = 'b3333333-0000-0000-0000-000000000004')
               and tipo = 'ENTRADA'),
          100.00, 'DIRETA: pagamento ENTRADA tambem criado');
```

Isso soma 3 asserts novos aos 24 originais — conferir a contagem real do arquivo final bate com `plan(...)` antes de seguir (contar todo `select is/ok/throws_ok/lives_ok(` de nível superior, não os aninhados em `format($$...$$)`).

- [ ] **Step 4: Aplicar e rodar (só se houver `.env`/link — Step 1)**

```bash
set -a && . ./.env && set +a
pnpm db:push
node supabase/tests/run.mjs 2>&1 | grep 0024
```
Esperado: `✓ 0024_fn_propostas.test.sql — 26 ok`. Sem `.env`: verificação estática — reler o corpo inteiro da função contra a versão no "Contexto de esquema" (só a linha do `insert into pagamentos` é nova), traçar os 3 asserts novos à mão.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/<TS1>_fn_aceitar_proposta_pagamento_entrada.sql supabase/tests/0024_fn_propostas.test.sql
git commit -m "fix(db): fn_aceitar_proposta cria pagamento ENTRADA (Plano 6)"
```

---

## Task 2: Migração `fn_iniciar_execucao` + `fn_concluir_execucao` + pgTAP + `db-types`

**Files:**
- Create: `supabase/migrations/<TS2>_fn_execucao_pagamento.sql` (`pnpm db:new fn_execucao_pagamento`; à mão, timestamp `> <TS1>`, ex. `20260911090002`)
- Create: `supabase/tests/0027_fn_execucao_pagamento.test.sql`
- Modify: `packages/db-types/index.ts`

**Interfaces:**
- Produces:
  - `public.fn_iniciar_execucao(p_contratacao_id uuid) returns void`, `SECURITY DEFINER`, idempotente. Consumida por `contratacoesRepository.iniciarExecucao` (Task 4).
  - `public.fn_concluir_execucao(p_contratacao_id uuid) returns uuid`, `SECURITY DEFINER`, idempotente (devolve o `pagamento_id` `FINAL`). Consumida por `contratacoesRepository.concluirExecucao` (Task 4).

- [ ] **Step 1: Escrever o teste pgTAP** — `supabase/tests/0027_fn_execucao_pagamento.test.sql`:

```sql
begin;
select plan(16);

select tests.create_supabase_user('t6_cli');
select tests.create_supabase_user('t6_pre');
select tests.create_supabase_user('t6_outro');

insert into public.categoria_servico (id, nome, icone_key)
values ('c6666666-0000-0000-0000-000000000001', 'T6 Eletrica', 'x');

-- Cenario A: contratacao AGENDADA (pronta pra iniciar)
insert into public.demandas_servico (id, cliente_id, categoria_id, titulo, descricao, status)
values ('d6666666-0000-0000-0000-000000000001', tests.get_supabase_uid('t6_cli'),
        'c6666666-0000-0000-0000-000000000001', 'Troca de disjuntor', 'x', 'CONTRATADA');
insert into public.propostas (id, demanda_id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b6666666-0000-0000-0000-000000000001', 'd6666666-0000-0000-0000-000000000001',
        tests.get_supabase_uid('t6_pre'), tests.get_supabase_uid('t6_cli'),
        gen_random_uuid(), 400.00, 'troca disjuntor');
-- conversa_id da proposta acima nao referencia uma conversa real -- ok pra esses testes,
-- fn_iniciar_execucao/fn_concluir_execucao nunca leem propostas.conversa_id.
insert into public.contratacoes (id, demanda_id, proposta_id, titulo_servico, cliente_id, prestador_id, valor_total, status)
values ('e6666666-0000-0000-0000-000000000001', 'd6666666-0000-0000-0000-000000000001',
        'b6666666-0000-0000-0000-000000000001', 'Troca de disjuntor',
        tests.get_supabase_uid('t6_cli'), tests.get_supabase_uid('t6_pre'), 400.00, 'AGENDADA');

-- (1) authz iniciar: nao-prestador nao inicia
select tests.authenticate_as('t6_outro');
select throws_ok(
  $$ select public.fn_iniciar_execucao('e6666666-0000-0000-0000-000000000001') $$,
  'PT401', null, 'nao-prestador nao inicia (PT401)');
reset role;

-- (2) inicar: inexistente
select tests.authenticate_as('t6_pre');
select throws_ok(
  $$ select public.fn_iniciar_execucao('00000000-0000-0000-0000-0000000000ff') $$,
  'PT404', null, 'contratacao inexistente (PT404)');
reset role;

-- (3)+(4) iniciar: feliz
select tests.authenticate_as('t6_pre');
select lives_ok(
  $$ select public.fn_iniciar_execucao('e6666666-0000-0000-0000-000000000001') $$,
  'prestador inicia sem erro');
reset role;
select is((select status::text from public.contratacoes where id = 'e6666666-0000-0000-0000-000000000001'),
          'EM_ANDAMENTO', 'contratacao EM_ANDAMENTO');

-- (5) iniciar: idempotente
select tests.authenticate_as('t6_pre');
select lives_ok(
  $$ select public.fn_iniciar_execucao('e6666666-0000-0000-0000-000000000001') $$,
  '2a chamada idempotente (ja EM_ANDAMENTO)');
reset role;

-- (6) iniciar: conflito -- outra contratacao ainda AGUARDANDO_PAGAMENTO
insert into public.demandas_servico (id, cliente_id, categoria_id, titulo, descricao, status)
values ('d6666666-0000-0000-0000-000000000002', tests.get_supabase_uid('t6_cli'),
        'c6666666-0000-0000-0000-000000000001', 'Instalacao de tomada', 'x', 'CONTRATADA');
insert into public.propostas (id, demanda_id, prestador_id, cliente_id, conversa_id, valor, descricao)
values ('b6666666-0000-0000-0000-000000000002', 'd6666666-0000-0000-0000-000000000002',
        tests.get_supabase_uid('t6_pre'), tests.get_supabase_uid('t6_cli'),
        gen_random_uuid(), 200.00, 'tomada nova');
insert into public.contratacoes (id, demanda_id, proposta_id, titulo_servico, cliente_id, prestador_id, valor_total, status)
values ('e6666666-0000-0000-0000-000000000002', 'd6666666-0000-0000-0000-000000000002',
        'b6666666-0000-0000-0000-000000000002', 'Instalacao de tomada',
        tests.get_supabase_uid('t6_cli'), tests.get_supabase_uid('t6_pre'), 200.00, 'AGUARDANDO_PAGAMENTO');

select tests.authenticate_as('t6_pre');
select throws_ok(
  $$ select public.fn_iniciar_execucao('e6666666-0000-0000-0000-000000000002') $$,
  'PT409', null, 'AGUARDANDO_PAGAMENTO nao inicia (PT409)');
reset role;

-- ============================================================================
-- fn_concluir_execucao (usa a contratacao e...01, ja EM_ANDAMENTO)
-- ============================================================================

-- (7) authz concluir: nao-prestador nao conclui
select tests.authenticate_as('t6_outro');
select throws_ok(
  $$ select public.fn_concluir_execucao('e6666666-0000-0000-0000-000000000001') $$,
  'PT401', null, 'nao-prestador nao conclui (PT401)');
reset role;

-- (8) concluir: inexistente
select tests.authenticate_as('t6_pre');
select throws_ok(
  $$ select public.fn_concluir_execucao('00000000-0000-0000-0000-0000000000ff') $$,
  'PT404', null, 'contratacao inexistente (PT404)');
reset role;

-- (9) concluir: conflito -- e...02 ainda AGUARDANDO_PAGAMENTO
select tests.authenticate_as('t6_pre');
select throws_ok(
  $$ select public.fn_concluir_execucao('e6666666-0000-0000-0000-000000000002') $$,
  'PT409', null, 'AGUARDANDO_PAGAMENTO nao conclui (PT409)');
reset role;

-- (10)-(14) concluir: feliz
select tests.authenticate_as('t6_pre');
select lives_ok(
  $$ select public.fn_concluir_execucao('e6666666-0000-0000-0000-000000000001') $$,
  'prestador conclui sem erro');
reset role;
select is((select status::text from public.contratacoes where id = 'e6666666-0000-0000-0000-000000000001'),
          'EM_ANDAMENTO', 'contratacao continua EM_ANDAMENTO (so o webhook conclui de verdade)');
select ok((select data_conclusao from public.contratacoes where id = 'e6666666-0000-0000-0000-000000000001') is not null,
          'data_conclusao preenchida');
select is((select valor::numeric from public.pagamentos
             where contratacao_id = 'e6666666-0000-0000-0000-000000000001' and tipo = 'FINAL'),
          200.00, 'pagamento FINAL = valor_final (metade de 400.00)');
select is((select status::text from public.pagamentos
             where contratacao_id = 'e6666666-0000-0000-0000-000000000001' and tipo = 'FINAL'),
          'PENDENTE', 'pagamento FINAL comeca PENDENTE');

-- (15)+(16) concluir: idempotente -- mesmo id de pagamento, mesmo se a
-- contratacao ja tivesse avancado por fora (aqui simulado so pela 2a chamada)
select tests.authenticate_as('t6_pre');
select is(
  (select public.fn_concluir_execucao('e6666666-0000-0000-0000-000000000001')),
  (select id from public.pagamentos where contratacao_id = 'e6666666-0000-0000-0000-000000000001' and tipo = 'FINAL'),
  '2a chamada devolve o mesmo pagamento_id');
reset role;
select is((select count(*)::int from public.pagamentos
             where contratacao_id = 'e6666666-0000-0000-0000-000000000001' and tipo = 'FINAL'),
          1, 'sem 2o pagamento FINAL');

select * from finish();
rollback;
```

Contar os `select throws_ok/lives_ok/is/ok(` de nível superior acima e conferir que bate com `plan(16)` — ajustar se divergir.

- [ ] **Step 2: Escrever a migration** — `supabase/migrations/<TS2>_fn_execucao_pagamento.sql`:

```sql
-- Plano 6 -- transicoes AGENDADA->EM_ANDAMENTO e EM_ANDAMENTO->(pagamento FINAL
-- pendente). Nao estao na spec-mae (so existiam no Kotlin antigo como update
-- direto pelo prestador) -- RPC SECURITY DEFINER, mesmo padrao de
-- fn_cancelar_contratacao (Plano 5): contratacoes nao tem NENHUMA policy de
-- UPDATE pra authenticated.

create or replace function public.fn_iniciar_execucao(p_contratacao_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contr public.contratacoes%rowtype;
begin
  select * into v_contr
    from public.contratacoes
    where id = p_contratacao_id
    for update;
  if not found then
    raise exception 'contratacao_inexistente' using errcode = 'PT404';
  end if;

  if (select auth.uid()) is distinct from v_contr.prestador_id then
    raise exception 'nao_autorizado' using errcode = 'PT401';
  end if;

  if v_contr.status = 'EM_ANDAMENTO' then
    return;
  end if;

  if v_contr.status <> 'AGENDADA' then
    raise exception 'contratacao_indisponivel' using errcode = 'PT409';
  end if;

  update public.contratacoes set status = 'EM_ANDAMENTO' where id = p_contratacao_id;
end;
$$;

create or replace function public.fn_concluir_execucao(p_contratacao_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_contr     public.contratacoes%rowtype;
  v_pagamento uuid;
begin
  select * into v_contr
    from public.contratacoes
    where id = p_contratacao_id
    for update;
  if not found then
    raise exception 'contratacao_inexistente' using errcode = 'PT404';
  end if;

  if (select auth.uid()) is distinct from v_contr.prestador_id then
    raise exception 'nao_autorizado' using errcode = 'PT401';
  end if;

  select id into v_pagamento
    from public.pagamentos
    where contratacao_id = p_contratacao_id and tipo = 'FINAL';
  if v_pagamento is not null then
    return v_pagamento;
  end if;

  if v_contr.status <> 'EM_ANDAMENTO' then
    raise exception 'contratacao_indisponivel' using errcode = 'PT409';
  end if;

  update public.contratacoes set data_conclusao = now() where id = p_contratacao_id;

  insert into public.pagamentos (contratacao_id, valor, tipo)
  values (p_contratacao_id, v_contr.valor_final, 'FINAL')
  returning id into v_pagamento;

  return v_pagamento;
end;
$$;

revoke execute on function public.fn_iniciar_execucao(uuid) from public, anon;
revoke execute on function public.fn_concluir_execucao(uuid) from public, anon;
grant execute on function public.fn_iniciar_execucao(uuid) to authenticated;
grant execute on function public.fn_concluir_execucao(uuid) to authenticated;
```

- [ ] **Step 3: Aplicar e rodar (só se houver `.env`/link)**

```bash
set -a && . ./.env && set +a
pnpm db:push
node supabase/tests/run.mjs 2>&1 | grep 0027
```
Esperado: `✓ 0027_fn_execucao_pagamento.test.sql — 16 ok`. Sem `.env`: verificação estática — traçar os 16 asserts à mão contra o corpo das duas funções, conferir `is distinct from` nas duas, conferir `valor_final` é lido do `%rowtype` (coluna gerada, populada no `select ... for update`).

- [ ] **Step 4: Hand-add em `packages/db-types/index.ts` (só se `db:types` não rodar)**

No bloco `Database["public"]["Functions"]`, inserir (ordem alfabética — ver "Contexto de esquema"):

```ts
      fn_concluir_execucao: {
        Args: { p_contratacao_id: string }
        Returns: string
      }
```
**entre** `fn_cancelar_contratacao` e `fn_e_participante`, e:

```ts
      fn_iniciar_execucao: {
        Args: { p_contratacao_id: string }
        Returns: undefined
      }
```
**entre** `fn_e_participante` e `fn_recusar_proposta`. Rodar `pnpm --filter @servico-feito/mobile exec tsc --noEmit` → 0 erros. Se houver `.env`, rodar `pnpm db:types` em vez do hand-add.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/<TS2>_fn_execucao_pagamento.sql supabase/tests/0027_fn_execucao_pagamento.test.sql packages/db-types/index.ts
git commit -m "feat(db): fn_iniciar_execucao e fn_concluir_execucao (Plano 6)"
```

---

## Task 3: Tipo de domínio `Pagamento`

**Files:**
- Create: `apps/mobile/src/features/pagamentos/types/pagamento.types.ts`

**Interfaces:**
- Produces:

```ts
export interface Pagamento {
  id: string;
  contratacaoId: string;
  valor: number;
  tipo: "ENTRADA" | "FINAL";
  status: "PENDENTE" | "PROCESSANDO" | "PAGO" | "CANCELADO" | "EXPIRADO";
  txid: string | null;
  efiLocId: number | null;
  pixCopiaCola: string | null;
  qrCodeBase64: string | null;
  dataPagamento: string | null;
  createdAt: string;
}
```

- [ ] **Step 1: Criar o arquivo** com exatamente o conteúdo acima.
- [ ] **Step 2: Verificar tipo**: `pnpm --filter @servico-feito/mobile exec tsc --noEmit` → 0 erros.
- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/pagamentos/types/pagamento.types.ts
git commit -m "feat(mobile): tipo de dominio Pagamento (Plano 6)"
```

---

## Task 4: `pagamentosRepository`

**Files:**
- Create: `apps/mobile/src/shared/api/repositories/pagamentos/{pagamentosRepository.ts, pagamentosRepository.supabase.ts, pagamentosRepository.supabase.test.ts}`
- Modify: `apps/mobile/src/shared/api/repositories/index.ts` (aditivo)

**Interfaces:**
- Consumes: `Pagamento` de `@/features/pagamentos/types/pagamento.types`; `normalizarErro` de `../types`; `supabase` de `@/shared/api/supabaseClient`.
- Produces:

```ts
export interface PagamentosRepository {
  buscarPendente(contratacaoId: string): Promise<Pagamento | null>;
  criarCobranca(pagamentoId: string): Promise<Pagamento>;
  obterPorId(pagamentoId: string): Promise<Pagamento>;
}
```
Barrel: `repositories.pagamentos`.

**Implementação** — mesmo formato de `contratacoesRepository.supabase.ts` (Plano 5): `import type { Database } from "@servico-feito/db-types"; type LinhaPagamento = Database["public"]["Tables"]["pagamentos"]["Row"];`.

```ts
const SELECT_PAGAMENTO =
  "id, contratacao_id, valor, tipo, status, txid, efi_loc_id, pix_copia_cola, qr_code_base64, data_pagamento, created_at";

function num(v: number | string): number {
  return typeof v === "string" ? Number(v) : v;
}

function paraPagamento(l: LinhaPagamento): Pagamento {
  return {
    id: l.id,
    contratacaoId: l.contratacao_id,
    valor: num(l.valor),
    tipo: l.tipo,
    status: l.status,
    txid: l.txid,
    efiLocId: l.efi_loc_id,
    pixCopiaCola: l.pix_copia_cola,
    qrCodeBase64: l.qr_code_base64,
    dataPagamento: l.data_pagamento,
    createdAt: l.created_at,
  };
}
```

- `buscarPendente(contratacaoId)`: `.select(SELECT_PAGAMENTO).eq("contratacao_id", contratacaoId).in("status", ["PENDENTE", "PROCESSANDO"]).order("created_at", { ascending: false }).limit(1).maybeSingle()`; `data` nulo → devolve `null` (não é erro).
- `criarCobranca(pagamentoId)`: `const { data, error } = await supabase.functions.invoke("criar-cobranca-pix", { body: { pagamento_id: pagamentoId } });` — `error` não-nulo (inclui `FunctionsHttpError` com status ≥400) → `throw normalizarErro(error)` (o corpo de erro da função segue `{ error: { code } }`, mesmo formato das RPCs, `normalizarErro` já sabe ler `code`); sucesso → busca a linha atualizada via `obterPorId(pagamentoId)` (a função só devolve `{ txid, pixCopiaCola, qrCodeBase64, status }`, mais simples reler a linha completa do banco do que remapear a resposta da function).
- `obterPorId(pagamentoId)`: `.select(SELECT_PAGAMENTO).eq("id", pagamentoId).single()`.
- Todo método: `try { … } catch (e) { throw normalizarErro(e) }`.

- [ ] **Step 1: Escrever o teste que falha** (`pagamentosRepository.supabase.test.ts`) — `const supa = require("@/shared/api/supabaseClient").supabase;` + `jest.spyOn(supa, "from"/"functions")`, `afterEach(jest.restoreAllMocks)`. Casos: `buscarPendente` mapeia todos os campos quando existe; `buscarPendente` sem linha (`maybeSingle` devolve `{ data: null, error: null }`) devolve `null`; `criarCobranca` chama `supabase.functions.invoke("criar-cobranca-pix", { body: { pagamento_id: "p1" } })` e depois lê a linha via `.from("pagamentos")`; `criarCobranca` com `error` da function rejeita via `normalizarErro`; `obterPorId` mapeia todos os campos.
- [ ] **Step 2: Rodar e confirmar falha** — `pnpm --filter @servico-feito/mobile test -- pagamentosRepository` → FAIL.
- [ ] **Step 3: Criar a interface + impl + barrel**. No `index.ts`: import `pagamentosRepositorySupabase`, `pagamentos: pagamentosRepositorySupabase` no objeto `repositories`, `export type { PagamentosRepository } from "./pagamentos/pagamentosRepository";`.
- [ ] **Step 4: Rodar e confirmar verde** + `tsc --noEmit` 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/shared/api/repositories/pagamentos apps/mobile/src/shared/api/repositories/index.ts
git commit -m "feat(mobile): pagamentosRepository (Plano 6)"
```

---

## Task 5: `contratacoesRepository` — `iniciarExecucao`/`concluirExecucao`

**Files:**
- Modify: `apps/mobile/src/shared/api/repositories/contratacoes/contratacoesRepository.ts`
- Modify: `apps/mobile/src/shared/api/repositories/contratacoes/contratacoesRepository.supabase.ts`
- Modify: `apps/mobile/src/shared/api/repositories/contratacoes/contratacoesRepository.supabase.test.ts`

**Interfaces:**
- Produces (adiciona à interface `ContratacoesRepository` existente, sem remover nada):

```ts
export interface ContratacoesRepository {
  obterPorProposta(propostaId: string, usuarioId: string): Promise<Contratacao>;
  listarMinhas(usuarioId: string): Promise<Contratacao[]>;
  cancelar(contratacaoId: string): Promise<void>;
  iniciarExecucao(contratacaoId: string): Promise<void>;
  concluirExecucao(contratacaoId: string): Promise<string>;
}
```

**Implementação** — `contratacoesRepository.supabase.ts` exporta `contratacoesRepositorySupabase: ContratacoesRepository` como um objeto literal (`{ async obterPorProposta(...) {...}, async listarMinhas(...) {...}, async cancelar(...) {...} }`); os 2 métodos novos entram **depois** de `cancelar` (última entrada do objeto), como mais duas propriedades — vírgula depois de `cancelar`'s `}` que hoje fecha o objeto:

```ts
  async iniciarExecucao(contratacaoId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc("fn_iniciar_execucao", {
        p_contratacao_id: contratacaoId,
      });
      if (error) throw normalizarErro(error);
    } catch (e) {
      throw normalizarErro(e);
    }
  },

  async concluirExecucao(contratacaoId: string): Promise<string> {
    try {
      const { data, error } = await supabase.rpc("fn_concluir_execucao", {
        p_contratacao_id: contratacaoId,
      });
      if (error) throw normalizarErro(error);
      return data as string;
    } catch (e) {
      throw normalizarErro(e);
    }
  },
```

- [ ] **Step 1: Escrever o teste que falha** (adicionar casos em `contratacoesRepository.supabase.test.ts`, mesmo arquivo do Plano 5): `iniciarExecucao` chama `supabase.rpc("fn_iniciar_execucao", { p_contratacao_id: <id> })`; `iniciarExecucao` com `{ error: { code: "PT409" } }` rejeita `conflito`; `concluirExecucao` chama `supabase.rpc("fn_concluir_execucao", { p_contratacao_id: <id> })` e devolve `data` (o `pagamento_id`); `concluirExecucao` com `{ error: { code: "PT401" } }` rejeita `nao_autorizado`.
- [ ] **Step 2: Rodar e confirmar falha** — `pnpm --filter @servico-feito/mobile test -- contratacoesRepository`.
- [ ] **Step 3: Adicionar os 2 métodos** na interface e na implementação (arquivo existente, edição aditiva — não reescrever os métodos já presentes).
- [ ] **Step 4: Rodar e confirmar verde** + `tsc` 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/shared/api/repositories/contratacoes
git commit -m "feat(mobile): contratacoesRepository.iniciarExecucao/concluirExecucao (Plano 6)"
```

---

## Task 6: Edge Functions — infraestrutura compartilhada (`_shared/`)

**Files:**
- Create: `supabase/functions/_shared/cors.ts`
- Create: `supabase/functions/_shared/auth.ts`

**Interfaces:**
- Produces: `CORS_HEADERS` (objeto de headers); `getUsuarioAutenticado(req: Request): Promise<string>` (lança `Response` 401 se JWT ausente/inválido — padrão Deno de "throw a Response" pra ser capturado no `catch` do handler).

`supabase/functions/_shared/cors.ts`:
```ts
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

`supabase/functions/_shared/auth.ts`:
```ts
import { createClient } from "npm:@supabase/supabase-js@2";

export async function getUsuarioAutenticado(req: Request): Promise<string> {
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!jwt) {
    throw new Response(JSON.stringify({ error: { code: "nao_autorizado" } }), { status: 401 });
  }
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await supa.auth.getUser(jwt);
  if (error || !data.user) {
    throw new Response(JSON.stringify({ error: { code: "nao_autorizado" } }), { status: 401 });
  }
  return data.user.id;
}
```
`SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente em toda Edge Function pelo runtime Supabase — não entram em `supabase secrets set`.

- [ ] **Step 1: Criar os dois arquivos** com exatamente o conteúdo acima.
- [ ] **Step 2: Revisão estática** — conferir que `getUsuarioAutenticado` lança `Response` (não `Error`) e que quem chamar precisa de um `try/catch` que devolva esse `Response` direto (documentar isso no handler das Tasks 8/9). Sem `tsc`/teste automatizado (Deno, fora do workspace mobile — ver Global Constraints).
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/cors.ts supabase/functions/_shared/auth.ts
git commit -m "feat(functions): auth e cors compartilhados (Plano 6)"
```

---

## Task 7: Edge Functions — cliente EFI (`_shared/efi.ts`)

**Files:**
- Create: `supabase/functions/_shared/efi.ts`

**Interfaces:**
- Produces: `getAccessToken(): Promise<string>`; `criarCobranca(txid: string, valor: number, chavePix: string): Promise<{ locId: number; pixCopiaCola: string; qrCodeBase64: string }>`.

```ts
import forge from "npm:node-forge@1";

interface CertPem { certChain: string; privateKey: string; }

let certCache: CertPem | null = null;

function extrairCertPem(base64P12: string): CertPem {
  if (certCache) return certCache;
  const der = forge.util.decode64(base64P12);
  const asn1 = forge.asn1.fromDer(der);
  // Sem senha propria no .p12 do repo Kotlin (confirmar no primeiro deploy real;
  // se houver senha, vira o secret EFI_CERT_P12_SENHA e entra no 3o argumento abaixo).
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, "");

  let certPem = "";
  let keyPem = "";
  for (const safeContents of p12.safeContents) {
    for (const safeBag of safeContents.safeBags) {
      if (safeBag.type === forge.pki.oids.certBag && safeBag.cert) {
        certPem = forge.pki.certificateToPem(safeBag.cert);
      }
      if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag && safeBag.key) {
        keyPem = forge.pki.privateKeyToPem(safeBag.key);
      }
    }
  }
  if (!certPem || !keyPem) throw new Error("efi_cert_p12_invalido");

  certCache = { certChain: certPem, privateKey: keyPem };
  return certCache;
}

function clienteMtls(): Deno.HttpClient {
  const cert = extrairCertPem(Deno.env.get("EFI_CERT_P12_BASE64")!);
  return Deno.createHttpClient({ certChain: cert.certChain, privateKey: cert.privateKey });
}

let tokenCache: { token: string; expiraEm: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiraEm > Date.now()) return tokenCache.token;

  const basic = btoa(`${Deno.env.get("EFI_CLIENT_ID")}:${Deno.env.get("EFI_CLIENT_SECRET")}`);
  const resp = await fetch("https://pix.api.efipay.com.br/oauth/token", {
    method: "POST",
    client: clienteMtls(),
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "client_credentials" }),
  });
  if (!resp.ok) throw new Error(`efi_oauth_falhou:${resp.status}`);
  const data = await resp.json();
  tokenCache = { token: data.access_token, expiraEm: Date.now() + (data.expires_in - 60) * 1000 };
  return tokenCache.token;
}

export async function criarCobranca(txid: string, valor: number, chavePix: string) {
  const token = await getAccessToken();
  const client = clienteMtls();

  const cobResp = await fetch(`https://pix.api.efipay.com.br/v2/cob/${txid}`, {
    method: "PUT",
    client,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      calendario: { expiracao: 3600 },
      valor: { original: valor.toFixed(2) },
      chave: chavePix,
    }),
  });
  if (!cobResp.ok) throw new Error(`efi_cob_falhou:${cobResp.status}`);
  const cob = await cobResp.json();

  const qrResp = await fetch(`https://pix.api.efipay.com.br/v2/loc/${cob.loc.id}/qrcode`, {
    client,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!qrResp.ok) throw new Error(`efi_qrcode_falhou:${qrResp.status}`);
  const qr = await qrResp.json();

  return {
    locId: cob.loc.id as number,
    pixCopiaCola: qr.qrcode as string,
    qrCodeBase64: qr.imagemQrcode as string,
  };
}
```

- [ ] **Step 1: Criar o arquivo** com exatamente o conteúdo acima.
- [ ] **Step 2: Revisão estática contra a doc EFI referenciada na spec** (`docs/superpowers/specs/2026-09-11-plano-6-pagamento-efi-design.md`, seção 3.1) — conferir: `certCache`/`tokenCache` são module-level (cacheiam por cold start, não por request); `extrairCertPem` navega `p12.safeContents[].safeBags[]` procurando `certBag`/`pkcs8ShroudedKeyBag` (API real do `node-forge`, checar contra a versão instalada se possível); `criarCobranca` faz `PUT /v2/cob/{txid}` seguido de `GET /v2/loc/{id}/qrcode`, igual à spec-mãe §10. Anotar no relatório da task: **não testado contra a EFI de verdade nesta sessão** (Global Constraints).
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/_shared/efi.ts
git commit -m "feat(functions): cliente EFI (oauth + mtls + cobranca) (Plano 6)"
```

---

## Task 8: Edge Function `criar-cobranca-pix`

**Files:**
- Create: `supabase/functions/criar-cobranca-pix/index.ts`

**Interfaces:**
- Consumes: `getUsuarioAutenticado`, `CORS_HEADERS` (Task 6); `criarCobranca` (Task 7).
- Produces: endpoint `POST /functions/v1/criar-cobranca-pix`, body `{ pagamento_id: string }` → `{ txid, pixCopiaCola, qrCodeBase64, status }` ou `{ error: { code } }`.

```ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS_HEADERS } from "../_shared/cors.ts";
import { getUsuarioAutenticado } from "../_shared/auth.ts";
import { criarCobranca } from "../_shared/efi.ts";

function erro(code: string, status: number): Response {
  return new Response(JSON.stringify({ error: { code } }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  let usuarioId: string;
  try {
    usuarioId = await getUsuarioAutenticado(req);
  } catch (resp) {
    return resp as Response;
  }

  const { pagamento_id } = await req.json();
  if (!pagamento_id) return erro("pagamento_id_ausente", 400);

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: pagamento, error: errPag } = await service
    .from("pagamentos")
    .select("id, contratacao_id, valor, tipo, status, txid, pix_copia_cola, qr_code_base64, efi_loc_id")
    .eq("id", pagamento_id)
    .single();
  if (errPag || !pagamento) return erro("nao_encontrado", 404);

  const { data: contratacao, error: errContr } = await service
    .from("contratacoes")
    .select("id, cliente_id")
    .eq("id", pagamento.contratacao_id)
    .single();
  if (errContr || !contratacao) return erro("nao_encontrado", 404);

  if (contratacao.cliente_id !== usuarioId) return erro("nao_autorizado", 401);

  if (pagamento.status === "PAGO") return erro("conflito", 409);

  if (pagamento.status === "PROCESSANDO") {
    return new Response(
      JSON.stringify({
        txid: pagamento.txid,
        pixCopiaCola: pagamento.pix_copia_cola,
        qrCodeBase64: pagamento.qr_code_base64,
        status: "PROCESSANDO",
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const prefixo = pagamento.tipo === "ENTRADA" ? "SFENT" : "SFFIN";
  const txid = (prefixo + String(pagamento.id).replace(/-/g, "")).slice(0, 35);

  try {
    const cob = await criarCobranca(txid, pagamento.valor, Deno.env.get("PLATFORM_PIX_KEY")!);

    await service
      .from("pagamentos")
      .update({
        txid,
        efi_loc_id: cob.locId,
        pix_copia_cola: cob.pixCopiaCola,
        qr_code_base64: cob.qrCodeBase64,
        status: "PROCESSANDO",
      })
      .eq("id", pagamento_id);

    return new Response(
      JSON.stringify({ txid, pixCopiaCola: cob.pixCopiaCola, qrCodeBase64: cob.qrCodeBase64, status: "PROCESSANDO" }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  } catch (_e) {
    return erro("gateway_indisponivel", 502);
  }
});
```

Regex EFI pro `txid`: `[a-zA-Z0-9]{26,35}`. `pagamento.id` é um `uuid` sem hífens tem 32 chars; `"SFENT"` (5) + 32 = 37, truncado com `.slice(0, 35)` fica dentro do range — conferir na revisão que `.slice(0, 35)` nunca produz menos de 26 chars (32+5=37 sempre ≥35, então sempre trunca pra exatamente 35 — dentro do range, ok).

- [ ] **Step 1: Criar o arquivo** com exatamente o conteúdo acima.
- [ ] **Step 2: Revisão estática** — conferir contra a spec (seção 3.3): idempotência por `status` (`PAGO`→409, `PROCESSANDO`→reaproveita sem chamar a EFI de novo), autorização (`contratacao.cliente_id !== usuarioId`→401), formato de erro consistente com `normalizarErro` do app (Task 4), `txid` dentro do range EFI. Anotar: **não testado contra a EFI de verdade nesta sessão**.
- [ ] **Step 3: Commit**

```bash
git add supabase/functions/criar-cobranca-pix/index.ts
git commit -m "feat(functions): criar-cobranca-pix (Plano 6)"
```

---

## Task 9: Edge Function `efi-webhook` + `config.toml`

**Files:**
- Create: `supabase/functions/efi-webhook/index.ts`
- Modify: `supabase/config.toml`

**Interfaces:**
- Produces: endpoint público `POST /functions/v1/efi-webhook/:token`, body EFI `{ pix: [{ txid: string, ... }] }`, sempre responde `200`.

```ts
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.pathname.split("/").pop();
  if (token !== Deno.env.get("EFI_WEBHOOK_TOKEN")) {
    return new Response("not found", { status: 404 });
  }

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const body = await req.json();
  const itens: Array<{ txid: string }> = body.pix ?? [];

  for (const item of itens) {
    const { data: pagamento } = await service
      .from("pagamentos")
      .select("id, contratacao_id, status, txid")
      .eq("txid", item.txid)
      .maybeSingle();
    if (!pagamento || pagamento.status === "PAGO") continue;

    await service
      .from("pagamentos")
      .update({ status: "PAGO", data_pagamento: new Date().toISOString() })
      .eq("id", pagamento.id);

    const { data: contratacao } = await service
      .from("contratacoes")
      .select("id, cliente_id, prestador_id, proposta_id")
      .eq("id", pagamento.contratacao_id)
      .single();
    if (!contratacao) continue;

    if (pagamento.txid.startsWith("SFENT")) {
      await service
        .from("contratacoes")
        .update({ entrada_paga: true, status: "AGENDADA" })
        .eq("id", contratacao.id);
    } else if (pagamento.txid.startsWith("SFFIN")) {
      await service
        .from("contratacoes")
        .update({ final_pago: true, status: "CONCLUIDA" })
        .eq("id", contratacao.id);
    }

    const { data: proposta } = await service
      .from("propostas")
      .select("conversa_id")
      .eq("id", contratacao.proposta_id)
      .single();

    if (proposta) {
      await service.from("mensagens").insert({
        conversa_id: proposta.conversa_id,
        remetente_id: contratacao.cliente_id,
        tipo: "PAGAMENTO_CONFIRMADO",
        corpo: "Pagamento confirmado.",
      });
    }

    await service.from("notificacoes").insert([
      {
        usuario_id: contratacao.cliente_id,
        titulo: "Pagamento confirmado",
        mensagem: "Seu pagamento foi confirmado.",
        tipo: "PAGAMENTO",
        referencia_id: contratacao.id,
      },
      {
        usuario_id: contratacao.prestador_id,
        titulo: "Pagamento confirmado",
        mensagem: "O pagamento foi confirmado.",
        tipo: "PAGAMENTO",
        referencia_id: contratacao.id,
      },
    ]);
  }

  return new Response("ok", { status: 200 });
});
```

`remetente_id: contratacao.cliente_id` pras duas mensagens (ENTRADA e FINAL) — é sempre o cliente quem paga; ver "Contexto de esquema" acima pra rationale.

`supabase/config.toml`: substituir o bloco de exemplo comentado (`# [functions.MY_FUNCTION_NAME] ...`) por:

```toml
[functions.efi-webhook]
verify_jwt = false
```

(a EFI não manda um JWT Supabase — a autenticação do endpoint é o `token` no path, verificado a mão dentro do handler; `criar-cobranca-pix` fica com o default `verify_jwt = true`, sem entrada própria no `config.toml`.)

- [ ] **Step 1: Criar `efi-webhook/index.ts`** com exatamente o conteúdo acima.
- [ ] **Step 2: Editar `supabase/config.toml`** conforme acima.
- [ ] **Step 3: Revisão estática** — conferir contra a spec (seção 3.4): sempre `200` (mesmo item não encontrado → `continue`, nunca aborta o loop nem retorna erro); idempotência (`status === "PAGO"` → `continue`); prefixo `SFENT`/`SFFIN` bate com o `txid` montado na Task 8; `remetente_id`/`corpo` de `mensagens` respeitam `NOT NULL` (schema da seção "Contexto de esquema"); os 2 `insert` em `notificacoes` cobrem cliente e prestador. Anotar: **não testado contra a EFI de verdade nesta sessão** — o primeiro teste real é o usuário registrar essa URL no painel EFI e disparar um Pix de homologação.
- [ ] **Step 4: Commit**

```bash
git add supabase/functions/efi-webhook/index.ts supabase/config.toml
git commit -m "feat(functions): efi-webhook (Plano 6)"
```

---

## Task 10: Hooks de pagamento

**Files:**
- Create: `apps/mobile/src/features/pagamentos/hooks/{usePagamentoPendente.ts, useCriarCobranca.ts, usePagamentoStatus.ts}`
- Test: `apps/mobile/src/features/pagamentos/hooks/pagamentosHooks.test.tsx`

**Interfaces:**
- Consumes: `repositories.pagamentos` (Task 4); `Pagamento` (Task 3); `queryClient`.
- Produces:

```ts
// usePagamentoPendente.ts
export function usePagamentoPendente(contratacaoId: string) {
  return useQuery<Pagamento | null>({
    queryKey: ["pagamento", "pendente", contratacaoId],
    enabled: !!contratacaoId,
    queryFn: () => repositories.pagamentos.buscarPendente(contratacaoId),
  });
}

// useCriarCobranca.ts
export function useCriarCobranca() {
  return useMutation<Pagamento, unknown, string>({   // variavel = pagamentoId
    mutationFn: (pagamentoId) => repositories.pagamentos.criarCobranca(pagamentoId),
    onSuccess: (pagamento) => {
      queryClient.setQueryData(["pagamento", pagamento.id], pagamento);
    },
  });
}

// usePagamentoStatus.ts
export function usePagamentoStatus(pagamentoId: string | null) {
  return useQuery<Pagamento>({
    queryKey: ["pagamento", pagamentoId],
    enabled: !!pagamentoId,
    queryFn: () => repositories.pagamentos.obterPorId(pagamentoId as string),
    refetchInterval: (query) => (query.state.data?.status === "PROCESSANDO" ? 5000 : false),
  });
}
```

- [ ] **Step 1: Escrever o teste que falha** (`pagamentosHooks.test.tsx`) — `jest.mock("@/shared/api/repositories", ...)`, `jest.mock("@/shared/query/queryClient", () => ({ queryClient: { setQueryData: jest.fn(), invalidateQueries: jest.fn() } }))`, `criarWrapperQuery()` dentro de `beforeEach`. Casos:
  1. `usePagamentoPendente("c1")` → chama `buscarPendente("c1")`.
  2. `usePagamentoPendente("")` → `enabled` falso, query fica `idle` (`fetchStatus === "idle"`, sem chamar o repo).
  3. `useCriarCobranca()` sucesso → `queryClient.setQueryData(["pagamento", pagamento.id], pagamento)` chamado com o pagamento devolvido.
  4. `usePagamentoStatus("p1")` → chama `obterPorId("p1")`.
  5. `usePagamentoStatus(null)` → `enabled` falso.
- [ ] **Step 2: Rodar e confirmar falha**.
- [ ] **Step 3: Implementar os 3 hooks**.
- [ ] **Step 4: Rodar e confirmar verde** + `tsc` 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/pagamentos/hooks apps/mobile/src/features/pagamentos/hooks/pagamentosHooks.test.tsx
git commit -m "feat(mobile): hooks de pagamento (Plano 6)"
```

---

## Task 11: Hooks `useIniciarExecucao`/`useConcluirExecucao`

**Files:**
- Create: `apps/mobile/src/features/contratacoes/hooks/{useIniciarExecucao.ts, useConcluirExecucao.ts}`
- Test: adicionar casos ao teste de hooks de contratação existente do Plano 5 (`contratacoesHooks.test.tsx`)

**Interfaces:**
- Consumes: `repositories.contratacoes` (Task 5); `queryClient`.
- Produces:

```ts
// useIniciarExecucao.ts
export function useIniciarExecucao(propostaId: string) {
  return useMutation<void, unknown, string>({   // variavel = contratacaoId
    mutationFn: (contratacaoId) => repositories.contratacoes.iniciarExecucao(contratacaoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratacao", "proposta", propostaId] });
      queryClient.invalidateQueries({ queryKey: ["contratacoes", "minhas"] });
    },
  });
}

// useConcluirExecucao.ts
export function useConcluirExecucao(propostaId: string) {
  return useMutation<string, unknown, string>({   // variavel = contratacaoId, retorna pagamento_id
    mutationFn: (contratacaoId) => repositories.contratacoes.concluirExecucao(contratacaoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contratacao", "proposta", propostaId] });
      queryClient.invalidateQueries({ queryKey: ["contratacoes", "minhas"] });
      queryClient.invalidateQueries({ queryKey: ["pagamento", "pendente"] });
    },
  });
}
```

`useConcluirExecucao` também invalida `["pagamento", "pendente"]` (chave parcial — invalida qualquer `["pagamento","pendente", <qualquer contratacaoId>]`, TanStack Query faz match por prefixo) pra que `ContratacaoScreen` (Task 12) veja o novo pagamento `FINAL` pendente sem precisar de um refetch manual.

- [ ] **Step 1: Escrever o teste que falha** (casos novos em `contratacoesHooks.test.tsx`) — `useIniciarExecucao("p1")` com `mutate("c1")` chama `iniciarExecucao("c1")` e invalida as 2 chaves; `useConcluirExecucao("p1")` com `mutate("c1")` chama `concluirExecucao("c1")` e invalida as 3 chaves (a 3ª com `exact: false` implícito — conferir que o mock de `invalidateQueries` foi chamado com `{ queryKey: ["pagamento","pendente"] }`, sem o 3º elemento).
- [ ] **Step 2: Rodar e confirmar falha**.
- [ ] **Step 3: Implementar os 2 hooks**.
- [ ] **Step 4: Rodar e confirmar verde** + `tsc` 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/contratacoes/hooks
git commit -m "feat(mobile): useIniciarExecucao e useConcluirExecucao (Plano 6)"
```

---

## Task 12: `expo-clipboard` + `PagamentoScreen` + rota

**Files:**
- Modify: `apps/mobile/package.json` (dependency nova)
- Create: `apps/mobile/src/features/pagamentos/screens/{PagamentoScreen.tsx, PagamentoScreen.test.tsx}`
- Create: `apps/mobile/app/(app)/pagamento/[contratacaoId].tsx`

**Interfaces:**
- Consumes: `usePagamentoPendente`, `useCriarCobranca`, `usePagamentoStatus` (Task 10); `RepoError` de `@/shared/api/repositories`; `Botao`, `CarregandoEstado`, `ErroEstado`, `traduzErroRepo`; `router` de `expo-router`; `useLocalSearchParams` de `expo-router`; `Clipboard` de `expo-clipboard`.

- [ ] **Step 1: Adicionar `expo-clipboard` em `apps/mobile/package.json`**, entre `"expo"` e `"expo-constants"` (ordem alfabética — ver "Contexto de esquema"):
```json
    "expo-clipboard": "~7.0.0",
```
Rodar `pnpm install` na raiz do monorepo pra atualizar `pnpm-lock.yaml`. Se não houver acesso à rede/registro npm neste ambiente: documentar no relatório da task (mesma situação de rede documentada em `expo-doctor` nos planos anteriores) e deixar a instalação pendente pro usuário — os steps seguintes (código da tela) não dependem do pacote estar de fato baixado pra serem escritos corretamente, só pra rodar `jest`/`expo export` no final.

- [ ] **Step 2: Escrever o teste que falha** (`PagamentoScreen.test.tsx`) — mock de `usePagamentoPendente`/`useCriarCobranca`/`usePagamentoStatus` (jest.mock dos módulos de hook, não do repo). Casos:
  1. Sem pagamento pendente (`usePagamentoPendente` devolve `{ data: null, isLoading: false }`): mostra "Nada pendente pra pagar" + botão voltar.
  2. Pagamento `PENDENTE`: dispara `useCriarCobranca().mutate` uma única vez no mount (spy no `mutate` mockado, conferir `toHaveBeenCalledTimes(1)` mesmo após um re-render forçado).
  3. `usePagamentoStatus` devolvendo `status: "PROCESSANDO"` com `qrCodeBase64`/`pixCopiaCola`: renderiza `Image` (`testID="pagamento-qr"`) e o texto do copia-e-cola; botão "Copiar código" chama `Clipboard.setStringAsync` (mock de `expo-clipboard`) com o valor certo.
  4. `status: "PAGO"`: mostra tela de sucesso; botão "Voltar" chama `router.back()` (mock de `expo-router`).
  5. Erro na criação da cobrança (`useCriarCobranca().error` setado): mostra `erroPagamento(...)` + botão "Tentar de novo" que rechama `mutate`.
- [ ] **Step 3: Rodar e confirmar falha**.
- [ ] **Step 4: Implementar `PagamentoScreen.tsx`**:

```tsx
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";
import { router } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { RepoError } from "@/shared/api/repositories";
import { Botao } from "@/shared/components/atoms/Botao";
import { CarregandoEstado } from "@/shared/components/molecules/CarregandoEstado";
import { usePagamentoPendente } from "@/features/pagamentos/hooks/usePagamentoPendente";
import { useCriarCobranca } from "@/features/pagamentos/hooks/useCriarCobranca";
import { usePagamentoStatus } from "@/features/pagamentos/hooks/usePagamentoStatus";

const ERRO_PAGAMENTO_GENERICO = "Não foi possível concluir. Tente de novo.";

export function erroPagamento(e: unknown): string | null {
  if (!e) return null;
  if (e instanceof RepoError) {
    if (e.code === "gateway_indisponivel") {
      return "Não foi possível gerar o pagamento agora. Tente de novo.";
    }
    return ERRO_PAGAMENTO_GENERICO;
  }
  return ERRO_PAGAMENTO_GENERICO;
}

export function PagamentoScreen({ contratacaoId }: { contratacaoId: string }) {
  const pendenteQ = usePagamentoPendente(contratacaoId);
  const criarCobranca = useCriarCobranca();
  const disparado = useRef(false);
  const [copiado, setCopiado] = useState(false);

  const pagamentoIdInicial = pendenteQ.data?.id ?? null;
  const statusQ = usePagamentoStatus(pagamentoIdInicial);

  useEffect(() => {
    if (disparado.current) return;
    if (pendenteQ.data && pendenteQ.data.status === "PENDENTE") {
      disparado.current = true;
      criarCobranca.mutate(pendenteQ.data.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendenteQ.data]);

  if (pendenteQ.isLoading) return <CarregandoEstado />;

  if (!pendenteQ.data) {
    return (
      <View className="flex-1 bg-sf-bg items-center justify-center px-6">
        <Text className="text-sf-text text-base mb-4">Nada pendente pra pagar.</Text>
        <Botao titulo="Voltar" onPress={() => router.back()} />
      </View>
    );
  }

  const pagamento = statusQ.data ?? pendenteQ.data;

  if (pagamento.status === "PAGO") {
    return (
      <View className="flex-1 bg-sf-bg items-center justify-center px-6">
        <Text className="text-sf-text text-xl font-bold mb-2">Pagamento confirmado!</Text>
        <Botao titulo="Voltar" onPress={() => router.back()} />
      </View>
    );
  }

  async function copiarCodigo() {
    if (!pagamento.pixCopiaCola) return;
    await Clipboard.setStringAsync(pagamento.pixCopiaCola);
    setCopiado(true);
  }

  return (
    <View className="flex-1 bg-sf-bg px-6 pt-10 items-center">
      <Text className="text-sf-text text-lg font-semibold mb-4">
        {pendenteQ.data.tipo === "ENTRADA" ? "Pagamento de entrada" : "Pagamento final"}
      </Text>

      {criarCobranca.isPending || (!pagamento.qrCodeBase64 && statusQ.isLoading) ? (
        <ActivityIndicator />
      ) : pagamento.qrCodeBase64 ? (
        <>
          <Image
            testID="pagamento-qr"
            source={{ uri: pagamento.qrCodeBase64 }}
            className="w-64 h-64 mb-4"
          />
          <Text selectable className="text-sf-body text-xs text-center mb-4 px-2">
            {pagamento.pixCopiaCola}
          </Text>
          <Botao
            titulo={copiado ? "Copiado!" : "Copiar código"}
            variante="secundario"
            onPress={copiarCodigo}
          />
        </>
      ) : null}

      {erroPagamento(criarCobranca.error) ? (
        <View className="mt-4 items-center">
          <Text className="text-sf-status-red mb-2">{erroPagamento(criarCobranca.error)}</Text>
          <Botao
            titulo="Tentar de novo"
            onPress={() => {
              disparado.current = false;
              criarCobranca.mutate(pendenteQ.data!.id);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 5: Criar a rota** `apps/mobile/app/(app)/pagamento/[contratacaoId].tsx`:

```tsx
import { useLocalSearchParams } from "expo-router";
import { PagamentoScreen } from "@/features/pagamentos/screens/PagamentoScreen";

export default function PagamentoRoute() {
  const { contratacaoId } = useLocalSearchParams<{ contratacaoId: string }>();
  return <PagamentoScreen contratacaoId={contratacaoId} />;
}
```

- [ ] **Step 6: Rodar e confirmar verde** + `tsc --noEmit` 0.
- [ ] **Step 7: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml apps/mobile/src/features/pagamentos/screens apps/mobile/app/\(app\)/pagamento
git commit -m "feat(mobile): PagamentoScreen (QR/copia-e-cola/polling) (Plano 6)"
```

---

## Task 13: `ContratacaoScreen` — CTAs de pagamento/execução

**Files:**
- Modify: `apps/mobile/src/features/contratacoes/screens/ContratacaoScreen.tsx`
- Modify: `apps/mobile/src/features/contratacoes/screens/ContratacaoScreen.test.tsx`

**Interfaces:**
- Consumes: `usePagamentoPendente` (Task 10); `useIniciarExecucao`, `useConcluirExecucao` (Task 11); tudo que já era consumido (ver íntegra em "Contexto de esquema").

**Mudança:** o bloco `{c.status === "AGUARDANDO_PAGAMENTO" ? (...) : null}` (aviso "Pagamento estará disponível em breve" + botão Cancelar) vira:

```tsx
const pendenteQ = usePagamentoPendente(c.id);
const iniciar = useIniciarExecucao(id);
const concluir = useConcluirExecucao(id);
```
(declarar logo abaixo de `cancelar`, antes do primeiro `return` condicional.)

```tsx
{c.status === "AGUARDANDO_PAGAMENTO" ? (
  <View className="mt-6">
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

{souCliente && pendenteQ.data ? (
  <View className="mt-6">
    <Botao
      titulo={pendenteQ.data.tipo === "ENTRADA" ? "Pagar entrada" : "Pagar final"}
      onPress={() => router.push(`/pagamento/${c.id}`)}
    />
  </View>
) : null}

{!souCliente && c.status === "AGENDADA" ? (
  <View className="mt-6">
    <Botao
      titulo="Iniciar serviço"
      carregando={iniciar.isPending}
      onPress={() => iniciar.mutate(c.id)}
    />
    {erroContratacao(iniciar.error) ? (
      <Text className="text-sf-status-red mt-2">{erroContratacao(iniciar.error)}</Text>
    ) : null}
  </View>
) : null}

{!souCliente && c.status === "EM_ANDAMENTO" && !pendenteQ.data ? (
  <View className="mt-6">
    <Botao
      titulo="Finalizar serviço"
      carregando={concluir.isPending}
      onPress={() => concluir.mutate(c.id)}
    />
    {erroContratacao(concluir.error) ? (
      <Text className="text-sf-status-red mt-2">{erroContratacao(concluir.error)}</Text>
    ) : null}
  </View>
) : null}
```

O aviso "Pagamento estará disponível em breve." é **removido** (o placeholder do Plano 5 deixa de existir — o CTA real de pagamento toma o lugar dele, condicionado a `pendenteQ.data` existir). `erroContratacao` (já existente no arquivo) não muda — os erros de `iniciar`/`concluir` reaproveitam os mesmos 4 casos (`nao_autorizado`/`conflito`/`nao_encontrado`/genérico), já cobrem RPC `PT401`/`PT409`/`PT404`.

Import novo no topo: `import { usePagamentoPendente } from "@/features/pagamentos/hooks/usePagamentoPendente"; import { useIniciarExecucao } from "@/features/contratacoes/hooks/useIniciarExecucao"; import { useConcluirExecucao } from "@/features/contratacoes/hooks/useConcluirExecucao";`.

- [ ] **Step 1: Escrever os testes que falham** (adicionar casos em `ContratacaoScreen.test.tsx`, arquivo existente do Plano 5) — mockar `usePagamentoPendente`/`useIniciarExecucao`/`useConcluirExecucao` junto dos mocks já existentes. Casos:
  1. Cliente com `pendenteQ.data.tipo === "ENTRADA"`: botão "Pagar entrada" visível, `onPress` chama `router.push("/pagamento/<c.id>")`.
  2. Cliente com `pendenteQ.data.tipo === "FINAL"`: botão "Pagar final".
  3. Cliente sem `pendenteQ.data`: nenhum botão de pagar.
  4. Prestador, `status: "AGENDADA"`: botão "Iniciar serviço" visível, `onPress` chama `iniciar.mutate(c.id)`.
  5. Prestador, `status: "EM_ANDAMENTO"`, sem `pendenteQ.data`: botão "Finalizar serviço" visível, `onPress` chama `concluir.mutate(c.id)`.
  6. Prestador, `status: "EM_ANDAMENTO"`, **com** `pendenteQ.data` (FINAL já processando): nenhum botão de ação pro prestador.
  7. `status: "AGUARDANDO_PAGAMENTO"`: botão Cancelar continua visível (regressão do Plano 5), aviso antigo "Pagamento estará disponível em breve" **não** está mais no texto renderizado.
- [ ] **Step 2: Rodar e confirmar falha**.
- [ ] **Step 3: Aplicar a mudança** descrita acima.
- [ ] **Step 4: Rodar e confirmar verde** + `tsc --noEmit` 0.
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/contratacoes/screens/ContratacaoScreen.tsx apps/mobile/src/features/contratacoes/screens/ContratacaoScreen.test.tsx
git commit -m "feat(mobile): CTAs de pagamento/execucao na ContratacaoScreen (Plano 6)"
```

---

## Task 14: Segredos — documentação operacional

**Files:**
- Modify: `docs/superpowers/plans/2026-09-08-fundacao-checklist-operacional.md`

Adicionar uma seção nova (não mexer nos itens EFI já resolvidos como "não rotacionar" — ver histórico do arquivo) com o comando de `supabase secrets set` da spec (seção 7) e o lembrete de que `EFI_WEBHOOK_TOKEN` é um valor novo (não existia no Kotlin), gerado pelo usuário no momento de registrar o webhook no painel EFI. Isso é só documentação — sem código, sem teste.

- [ ] **Step 1: Adicionar a seção** ao checklist, junto às pendências já existentes de "Projetos Supabase"/"Rotação de segredos vazados" (ver estrutura do arquivo atual).
- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-09-08-fundacao-checklist-operacional.md
git commit -m "docs: comando de secrets EFI pro Plano 6"
```

---

## Nota final para quem executa

Ao terminar a última task, rodar o gate completo (`tsc --noEmit`, `jest`, `eslint`, `expo-doctor`, `expo export --platform ios`) e reportar no ledger quais dos itens abaixo ficaram **pendentes pro usuário** (nenhum é bloqueio pra considerar o plano "codigo pronto"):

1. `pnpm db:push` + `node supabase/tests/run.mjs` + `pnpm db:types` (se este ambiente não tiver `.env`/link).
2. `supabase functions deploy criar-cobranca-pix efi-webhook` — primeiro deploy real.
3. `supabase secrets set ...` (Task 14) — segredos EFI, incluindo o novo `EFI_WEBHOOK_TOKEN`.
4. Registrar a URL do `efi-webhook` no painel EFI (webhook Pix, chave `PLATFORM_PIX_KEY`).
5. Primeiro teste de ponta a ponta contra a sandbox de homologação EFI — validar principalmente se o `Deno.createHttpClient` com o certChain/privateKey extraídos do `.p12` via `node-forge` realmente estabelece mTLS (risco sinalizado na spec-mãe §10 e na spec deste plano §1).
