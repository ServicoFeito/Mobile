# Plano 5 — Contratação — Design

**Data:** 2026-09-10
**Base:** `homolog` @ `48c71f8` (Planos 1–4 mergeados)
**Spec-mãe:** `docs/superpowers/specs/2026-09-08-migracao-react-native-supabase-design.md` (seções 6, 7, 10)
**Regras de negócio:** `docs/regras-de-negocio/regras-de-negocio.md` (RB07, RB08, RB09, RB16, RB17)
**Plano anterior:** `docs/superpowers/specs/2026-09-09-plano-4-conversas-propostas-design.md`

## 1. Objetivo e escopo

Entregar a **tela de contratação** — o que existe entre "proposta aceita" (fim do
Plano 4) e "pagamento confirmado" (Plano 6, ainda não construído): visualizar a
contratação, acompanhar o checklist de tarefas da demanda, e cancelar antes de
qualquer pagamento. **Sem Pix/EFI real neste plano** — a contratação nasce e fica
em `AGUARDANDO_PAGAMENTO` até o Plano 6 existir.

### Dentro do escopo

- **Migração**: `fn_cancelar_contratacao` (plpgsql `SECURITY DEFINER`, transacional,
  idempotente) — único jeito de escrever em `contratacoes` continua sendo por RPC,
  igual ao padrão do Plano 4 (a tabela não tem nenhuma policy de `UPDATE` pra
  `authenticated`, só leitura). pgTAP.
- **Repository `contratacoes`**: `obterPorProposta`, `listarMinhas`, `cancelar`.
- **Repository `tarefas`**: `listarDaDemanda`, `marcarConcluida` — escrita direta
  (RLS do Plano 1, `tarefas_write_cliente_dono`, já cobre: só o cliente dono da
  demanda escreve).
- **Tela `ContratacaoScreen`**: detalhe (título, status em PT, valor, outra parte),
  aviso de pagamento pendente, botão Cancelar (só em `AGUARDANDO_PAGAMENTO`,
  com confirmação), checklist de tarefas (interativo só pro cliente).
- **Tela `TrabalhosScreen`**: substitui o stub do shell — lista "minhas
  contratações" (cliente vê as que contratou, prestador vê as que executa). Rota
  `app/(app)/contratacao/[id].tsx`, chaveada por **`proposta_id`** (o card do chat
  só tem esse dado).
- **Wiring**: aba "Trabalhos" deixa de ser exclusiva do modo prestar (cliente
  também precisa ver as próprias contratações); `ContratoGeradoCard` (Plano 4,
  componente puro) ganha navegação via um `Pressable` externo no `ConversaScreen`.
- **`formatarBRL`**: helper novo em `shared/lib/`; retrofit nos 2 lugares do
  Plano 4 que formatavam dinheiro cru (`PropostaCard`, `ContratoGeradoCard`).

### Fora do escopo (planos posteriores)

- Pagamento Pix/EFI real (`criar-cobranca-pix`, `efi-webhook`, tabela `pagamentos`)
  — Plano 6. A transição `AGUARDANDO_PAGAMENTO → AGENDADA` só existe quando o
  Plano 6 nascer.
- `EM_ANDAMENTO`, `concluir-execucao`, `data_conclusao` — dependem de pagamento de
  entrada confirmado (Plano 6) e do prestador marcar início (Plano 6/7).
- Avaliações (RB10) — Plano 7, depende de `CONCLUIDA`.
- Editar/adicionar tarefas depois de criada a demanda (Plano 3 só criava o
  registro da demanda; `tarefas_demanda` no MVP é só leitura+conclusão neste
  plano — criação de tarefas fica pra quando existir essa necessidade real).
- Reagendamento, disputa, reembolso.

### O que já existe (Planos 1 e 4) e é só consumido

Tabela `contratacoes` (colunas, RLS `contratacoes_select_partes`, trigger
`contratacoes_set_updated_at`) e `tarefas_demanda` (RLS `tarefas_select_quem_ve_demanda`
+ `tarefas_write_cliente_dono`) — Plano 1. `fn_aceitar_proposta` já cria a
`contratacoes` em `AGUARDANDO_PAGAMENTO` — Plano 4. Enum `status_contratacao`
(`AGUARDANDO_PAGAMENTO, AGENDADA, EM_ANDAMENTO, CONCLUIDA, CANCELADA`) e
`tipo_notificacao` — Plano 1. `handle_new_mensagem` (resumo da conversa) e
`tipo_mensagem` incluindo `SISTEMA` — Plano 1/4, sem alteração.

## 2. Migração

Um arquivo: `supabase/migrations/<TS>_fn_cancelar_contratacao.sql`.
Teste: `supabase/tests/0026_fn_cancelar_contratacao.test.sql`.

`SECURITY DEFINER` + `set search_path = ''`, schema-qualificado, como toda função
do Plano 4.

### 2.1 `fn_cancelar_contratacao(p_contratacao_id uuid) returns void`

1. `select * into v_contr from public.contratacoes where id = p_contratacao_id for update;`
   — não achou ⇒ `raise exception 'contratacao_inexistente' using errcode = 'PT404';`
2. Guarda de autorização: `if auth.uid() not in (v_contr.cliente_id, v_contr.prestador_id) then raise exception 'nao_autorizado' using errcode = 'PT401'; end if;`
   (cliente **ou** prestador podem cancelar antes do pagamento).
3. Idempotência: `if v_contr.status = 'CANCELADA' then return; end if;`
4. Guarda de estado: `if v_contr.status <> 'AGUARDANDO_PAGAMENTO' then raise exception 'contratacao_indisponivel' using errcode = 'PT409'; end if;`
5. `update public.contratacoes set status = 'CANCELADA' where id = p_contratacao_id;`
6. Reverte a demanda, se houver: `if v_contr.demanda_id is not null then update public.demandas_servico set status = 'ABERTA' where id = v_contr.demanda_id and status = 'CONTRATADA'; end if;`
   (o `and status = 'CONTRATADA'` evita sobrescrever um estado que mudou por outro
   caminho — hoje não existe outro caminho, mas é defensivo e barato).
7. Avisa no chat: `select conversa_id into v_conversa from public.propostas where id = v_contr.proposta_id;`
   `insert into public.mensagens (conversa_id, remetente_id, tipo, corpo) values (v_conversa, (select auth.uid()), 'SISTEMA', 'Contratação cancelada.');`
   — `corpo` não-vazio, então o `else`-arm existente de `handle_new_mensagem`
   (Plano 4) já resolve o resumo da conversa corretamente; **nada a mudar** nesse
   trigger.
8. Notifica a **outra parte** (não quem cancelou): `v_outro := case when auth.uid() = v_contr.cliente_id then v_contr.prestador_id else v_contr.cliente_id end;`
   `insert into public.notificacoes (usuario_id, titulo, mensagem, tipo, referencia_id) values (v_outro, 'Contratação cancelada', 'A contratação foi cancelada.', 'CONTRATACAO', p_contratacao_id);`
9. `revoke execute on function public.fn_cancelar_contratacao(uuid) from public, anon; grant execute ... to authenticated;`

### 2.2 pgTAP

- authz: quem não é cliente nem prestador ⇒ `PT401`.
- inexistente ⇒ `PT404`.
- feliz, conversa `DEMANDA`: `status` vira `CANCELADA`; `demandas_servico.status`
  volta `ABERTA`; existe `mensagens` `tipo='SISTEMA'` com o corpo certo; existe
  `notificacoes` pra parte que **não** cancelou (`tipo='CONTRATACAO'`).
- feliz, conversa `DIRETA` (`demanda_id` null): `demandas_servico` não é tocado
  (nenhuma linha muda).
- idempotente: 2ª chamada não lança e não duplica mensagem/notificação.
- conflito: contratação já `AGENDADA` (ou além) ⇒ `PT409`.

## 3. Camada de repositories

Barrel `apps/mobile/src/shared/api/repositories/index.ts` ganha, aditivamente
(mesma regra do Plano 4): `contratacoes` e `tarefas`.

```ts
// contratacoes/contratacoesRepository.ts
interface Contratacao {
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

interface ContratacoesRepository {
  obterPorProposta(propostaId: string, usuarioId: string): Promise<Contratacao>;
  listarMinhas(usuarioId: string): Promise<Contratacao[]>;
  cancelar(contratacaoId: string): Promise<void>;
}

// tarefas/tarefasRepository.ts
interface Tarefa {
  id: string;
  demandaId: string;
  nomeTarefa: string;
  descricao: string | null;
  concluida: boolean;
  createdAt: string;
}

interface TarefasRepository {
  listarDaDemanda(demandaId: string): Promise<Tarefa[]>;
  marcarConcluida(tarefaId: string, concluida: boolean): Promise<void>;
}
```

### 3.1 Implementação

- `SELECT_CONTRATACAO` = `"id, demanda_id, proposta_id, titulo_servico, cliente_id, prestador_id, valor_total, valor_entrada, valor_final, taxa_plataforma, status, entrada_paga, final_pago, avaliado, data_agendada, data_conclusao, created_at"`.
- `paraContratacao(l, usuarioId, outro)` — mesmo padrão do `paraConversa` (Plano
  4): `outroId = usuarioId === l.cliente_id ? l.prestador_id : l.cliente_id`;
  `outroNome`/`outroFotoUrl` de uma 2ª query em `perfis_publicos` (falha nessa 2ª
  query não propaga — degrada pra `null`, igual `conversasRepository.listarMinhas`).
  Valores numéricos (`valor_total`, `valor_entrada`, `valor_final`,
  `taxa_plataforma`) coercidos com `Number(...)` quando vierem como string,
  preservando `null` (mesmo cuidado do `propostasRepository`, Plano 4).
- `obterPorProposta`: `.select(SELECT_CONTRATACAO).eq("proposta_id", propostaId).single()`.
- `listarMinhas`: `.or('cliente_id.eq.<uid>,prestador_id.eq.<uid>')`, `.order("created_at", { ascending: false })`; resolve os "outros" em lote (`.in("usuario_id", [...ids])`), igual `conversasRepository.listarMinhas`.
- `cancelar`: `const { error } = await supabase.rpc("fn_cancelar_contratacao", { p_contratacao_id: contratacaoId }); if (error) throw normalizarErro(error);`.
- `tarefasRepository.listarDaDemanda`: `.select("id, demanda_id, nome_tarefa, descricao, concluida, created_at").eq("demanda_id", demandaId).order("created_at", { ascending: true })`.
- `tarefasRepository.marcarConcluida`: `.from("tarefas_demanda").update({ concluida }).eq("id", tarefaId)`; `{ error }` não-nulo (ex.: RLS 42501 se o prestador tentar) ⇒ `throw normalizarErro(error)` (`nao_autorizado`).
- Todos os métodos: `try { … } catch (e) { throw normalizarErro(e) }`, nunca vazam `PostgrestError` (contrato do Plano 3/4).

## 4. Hooks, telas, rotas, wiring

```
features/contratacoes/
  hooks/      useContratacaoPorProposta.ts  useMinhasContratacoes.ts  useCancelarContratacao.ts
  screens/    ContratacaoScreen.tsx  TrabalhosScreen.tsx      (substitui features/shell/screens/TrabalhosScreen.tsx)
  components/ ContratacaoRow.tsx  StatusBadge.tsx (ou inline — decidir no plano)
  types/      contratacao.types.ts

features/tarefas/
  hooks/      useTarefasDaDemanda.ts  useMarcarTarefaConcluida.ts
  components/ TarefaRow.tsx
  types/      tarefa.types.ts

shared/lib/
  formatarBRL.ts  formatarBRL.test.ts

apps/mobile/app/(app)/contratacao/[id].tsx    → ContratacaoScreen (id = proposta_id)
```

### 4.1 Hooks

```ts
useContratacaoPorProposta(propostaId)
  // useQuery { queryKey: ["contratacao","proposta",propostaId], enabled: !!propostaId,
  //            queryFn: () => repositories.contratacoes.obterPorProposta(propostaId, usuarioId ?? "") }

useMinhasContratacoes()
  // useQuery { queryKey: ["contratacoes","minhas"], enabled: !!usuarioId,
  //            queryFn: () => repositories.contratacoes.listarMinhas(usuarioId ?? "") }

useCancelarContratacao(propostaId: string, demandaId: string | null)
  // useMutation<void, unknown, string>  // variável = contratacaoId
  // mutationFn: (contratacaoId) => repositories.contratacoes.cancelar(contratacaoId)
  // onSuccess: invalida ["contratacao","proposta",propostaId], ["contratacoes","minhas"],
  //            ["conversas","minhas"], e se demandaId: ["demandas","detalhe",demandaId], ["demandas","abertas"]

useTarefasDaDemanda(demandaId: string)
  // useQuery { queryKey: ["tarefas","demanda",demandaId], enabled: !!demandaId,
  //            queryFn: () => repositories.tarefas.listarDaDemanda(demandaId) }

useMarcarTarefaConcluida(demandaId: string)
  // useMutation<void, unknown, { tarefaId: string; concluida: boolean }>
  // mutationFn: (v) => repositories.tarefas.marcarConcluida(v.tarefaId, v.concluida)
  // onSuccess: invalida ["tarefas","demanda",demandaId]
```

### 4.2 `ContratacaoScreen({ id }: { id: string })` — `id` é o `proposta_id`

- `const usuarioId = useAuthStore((s) => s.usuarioId);`
- `const cq = useContratacaoPorProposta(id);` — `isLoading` → `<CarregandoEstado/>`;
  `isError || !cq.data` → `<ErroEstado mensagem={traduzErroRepo(cq.error)} onRetry={() => cq.refetch()}/>`.
- `const c = cq.data;` `const souCliente = usuarioId === c.clienteId;`
- `const tarefasQ = useTarefasDaDemanda(c.demandaId ?? "");`
- Cabeçalho: voltar + "Contratação" (mesmo padrão de `ConversaScreen`, Plano 4).
- Corpo: `c.tituloServico`, selo de status em PT (`AGUARDANDO_PAGAMENTO`→"Aguardando
  pagamento", `AGENDADA`→"Agendada", `EM_ANDAMENTO`→"Em andamento",
  `CONCLUIDA`→"Concluída", `CANCELADA`→"Cancelada"), `formatarBRL(c.valorTotal)`,
  `c.outroNome ?? "Usuário"`.
- Se `c.status === "AGUARDANDO_PAGAMENTO"`: `<Text>` de aviso "Pagamento estará
  disponível em breve." + `Botao` **"Cancelar contratação"** (`variante="perigo"`),
  `onPress` dispara `Alert.alert("Cancelar contratação?", "Isso não pode ser
  desfeito.", [{ text: "Voltar", style: "cancel" }, { text: "Cancelar contratação",
  style: "destructive", onPress: () => cancelar.mutate(c.id) }])` (API real do RN —
  `AlertButton.text`, não `texto`) antes de chamar a mutation. Teste mocka
  `jest.spyOn(Alert, "alert")` e invoca o `onPress` do 2º botão manualmente. Erro
  inline via
  `erroContratacao(cancelar.error)`.
- Se `c.demandaId` não-nulo: seção "Tarefas" — `tarefasQ.data.map(TarefaRow)`;
  `TarefaRow` mostra `nomeTarefa` + checkbox; `onToggle` só habilitado quando
  `souCliente`, dispara `useMarcarTarefaConcluida(c.demandaId).mutate({ tarefaId,
  concluida: !tarefa.concluida })`.
- `erroContratacao(e: unknown): string | null` — local, mesmo padrão do
  `erroProposta` (Plano 4, `ConversaScreen`): `!e` → `null`; `RepoError` →
  `conflito`→"Esta contratação não pode mais ser cancelada.",
  `nao_autorizado`→"Você não pode cancelar esta contratação.", senão genérico;
  não-`RepoError` → genérico.

### 4.3 `TrabalhosScreen()` — substitui `features/shell/screens/TrabalhosScreen.tsx`

`useMinhasContratacoes()`; `isLoading`/`isError`/vazio (`<VazioEstado
mensagem="Nenhuma contratação ainda."/>`) iguais ao padrão do `ConversasListScreen`
(Plano 4); `FlatList` de `ContratacaoRow` (status + título + `outroNome` +
`formatarBRL(valorTotal)`) → `router.push(\`/contratacao/${item.propostaId}\`)`.
Shell stub **deletado**; `app/(app)/(tabs)/trabalhos.tsx` passa a importar de
`@/features/contratacoes/screens/TrabalhosScreen`.

### 4.4 Wiring

- **Tabs** (`app/(app)/(tabs)/_layout.tsx`): a aba "Trabalhos" tem hoje
  `href: prestar ? "/(app)/(tabs)/trabalhos" : null` — só aparece no modo
  prestar. Como cliente também precisa ver as próprias contratações, o gate sai
  (`href` sem condicional — visível nos 2 modos, mesmo título "Trabalhos").
  `buscar`/`vagas` continuam com o gate de modo que já tinham (não mexidos).
- **`ConversaScreen`** (Plano 4): o `renderItem` do caso `"CONTRATO_GERADO"` passa
  a envolver o `ContratoGeradoCard` (componente puro, sem `onPress` — não mexido)
  num `Pressable`: `<Pressable onPress={() => router.push(\`/contratacao/${item.propostaId}\`)}><ContratoGeradoCard valor={p?.valor ?? 0}/></Pressable>`.

### 4.5 `formatarBRL`

`shared/lib/formatarBRL.ts`: `export function formatarBRL(v: number): string { return "R$ " + v.toFixed(2).replace(".", ","); }` — sem separador de milhar
(aceitável no MVP; valores de serviço residencial raramente passam de 4 dígitos).
Retrofit: `PropostaCard.tsx` e `ContratoGeradoCard.tsx` (Plano 4) trocam
`` `R$ ${valor.toFixed(2)}` `` por `formatarBRL(valor)` — troca mecânica, sem
mudar a interface dos componentes.

## 5. Fluxo de dados

Ver tabela de `queryKey` na seção 4.1. Nenhuma chave nova colide com as existentes
(Planos 3/4). `useCancelarContratacao` é o único ponto que invalida através de
domínios (`contratacao`, `conversas`, `demandas`) — mesma forma que
`useAceitarProposta` (Plano 4) já fazia.

## 6. Erros

- Repos sempre entregam `RepoError` (Plano 3/4). `traduzErroRepo` genérico
  cobre os casos sem contexto especial (`TrabalhosScreen`, carregamento da
  `ContratacaoScreen`).
- `erroContratacao` (seção 4.2) cobre o contexto de cancelamento, mesmo padrão do
  `erroProposta` do Plano 4.
- `marcarConcluida` batendo em RLS (prestador, via bug de UI ou corrida) —
  `nao_autorizado`, mostrado inline sob a tarefa; não é um caminho alcançável
  pela UI normal (checkbox não-interativo pro prestador), mas o repo nunca
  assume isso — sempre normaliza o erro real do banco.

## 7. Testes

Ver seção 2.2 (pgTAP) e a lista de testes de jest resumida no design conversado:
repos (`contratacoesRepository`, `tarefasRepository`), hooks (os 5 da seção 4.1,
com foco no conjunto de invalidação do `useCancelarContratacao`), telas
(`ContratacaoScreen` — gate do botão Cancelar por status, checklist gated por
`souCliente`, confirmação antes de cancelar; `TrabalhosScreen` — lista/vazio/erro,
navegação), 1 caso novo em `ConversaScreen.test.tsx` (tap no `ContratoGeradoCard`
navega), `formatarBRL` (unitário). Gate final igual aos Planos 2–4 (`tsc` / `jest`
/ `eslint` / `expo-doctor` / `expo export`), `db:push`/`db:test` pendente pro
usuário se o ambiente de execução não tiver `.env` linkado (mesma situação do
Plano 4, ruling R-DB-ENV).

## 8. Interfaces que os planos seguintes consomem

- `repositories.{contratacoes,tarefas}` — Plano 6 adiciona `pagamentos` no mesmo
  padrão e passa a escrever em `contratacoes` via as próprias RPCs
  (`criar-cobranca-pix`/`efi-webhook` da spec-mãe §10), reaproveitando
  `Contratacao` como tipo de domínio.
  `fn_cancelar_contratacao` — convenção de RPC estreita e idempotente que o
  Plano 6 segue para `concluir-execucao`.
- `ContratacaoScreen` — o Plano 6 adiciona a seção de pagamento (QR/copia-e-cola)
  condicionada a `status === 'AGUARDANDO_PAGAMENTO'` no mesmo arquivo, no lugar
  do aviso "em breve".
- `formatarBRL` — reutilizável em qualquer tela que mostre dinheiro daqui pra
  frente (pagamentos, avaliações com valor, etc.).
