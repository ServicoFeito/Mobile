# Plano 4 — Conversas e propostas — Design

**Data:** 2026-09-09
**Base:** `homolog` @ `146f146` (Planos 1, 2 e 3 mergeados)
**Spec-mãe:** `docs/superpowers/specs/2026-09-08-migracao-react-native-supabase-design.md` (seções 8 e 10)
**Regras de negócio:** `docs/regras-de-negocio/regras-de-negocio.md` (RB04, RB05, RB06, RB07, RB08, RB11)
**Plano anterior:** `docs/superpowers/specs/2026-09-09-plano-3-repositories-descoberta-design.md`

## 1. Objetivo e escopo

Entregar a **conversa** (chat texto entre cliente e prestador) e o **ciclo de
proposta** (o prestador envia, o cliente aceita ou recusa; aceitar gera a
contratação). O chat tem atualização em tempo real. Anexos de mídia
(foto/vídeo/áudio/localização) ficam para o **Plano 4b**.

### Dentro do escopo

- **Migração `conversas_propostas`**: função `fn_aceitar_proposta` (plpgsql,
  `SECURITY DEFINER`, transacional, idempotente); trigger `handle_new_proposta`
  (insere a mensagem `PROPOSTA` automaticamente); trigger `handle_new_mensagem`
  (atualiza os campos de resumo e os contadores de não-lidas em `conversas`);
  índices únicos parciais para deduplicar conversa; `set_updated_at` onde faltar;
  publicação realtime para `mensagens` e `conversas`. Testes pgTAP.
- **Repositories** (`@/shared/api/repositories/`, adicionados ao barrel):
  `conversas`, `mensagens`, `propostas`.
- **Hooks de realtime**: `useMensagensRealtime(conversaId)`,
  `useConversasRealtime()`.
- **Feature `conversas`**: `ConversasListScreen` (substitui o stub do shell),
  `ConversaScreen` (chat), hooks de dados e mutations.
- **Feature `propostas`**: `NovaPropostaScreen` (formulário do prestador),
  `PropostaCard` e card `CONTRATO_GERADO` renderizados dentro da `ConversaScreen`.
- **Wiring** nas telas do Plano 3: `PrestadorPerfilScreen` (cliente inicia
  conversa `DIRETA`), `DemandaDetalheScreen` (prestador inicia conversa `DEMANDA`).
- Novos textos em `traduzErroRepo` para os erros de negócio da RPC.

### Fora do escopo (planos posteriores)

- **Anexos de mídia** — Plano 4b (bucket de Storage, RLS de Storage,
  `anexos_mensagem`, `expo-image-picker` / `expo-av` / `expo-location`, captura e
  render de `FOTO` / `VIDEO` / `AUDIO` / `LOCALIZACAO`).
- **Tela de contratação** e tudo depois dela (pagamento, execução, avaliação) —
  Plano 5+. O Plano 4 para no card `CONTRATO_GERADO` dentro do chat.
- Encerrar / bloquear conversa (`status` `ENCERRADA` / `BLOQUEADA`). No Plano 4 a
  conversa é sempre criada e mantida `ATIVA`.
- Editar / cancelar proposta pelo prestador (`status` `CANCELADA`). O prestador
  só cria; expiração por `validade_dias` (`EXPIRADA`) também fica para depois.
- Push notification. A linha em `notificacoes` é gravada (a `fn_aceitar_proposta`
  insere), mas entrega/leitura de notificação é o Plano 7.
- Indicador de "digitando", recibo de leitura visível ao remetente, busca dentro
  da conversa.

### O que já existe (Plano 1) e é só consumido

Tabelas `conversas`, `participantes_conversa`, `mensagens`, `propostas`,
`contratacoes`, `notificacoes`; enums `tipo_conversa`, `status_conversa`,
`tipo_mensagem`, `status_proposta`, `status_contratacao`; trigger
`handle_new_conversa` (popula `participantes_conversa`); função
`fn_e_participante(uuid)`; RLS de `conversas` / `mensagens` / `propostas`
(migrations `20260908151628_rls_conversas.sql` e `20260908200154_rls_hardening.sql`).
Nenhuma policy nova é necessária — as políticas de `INSERT` já checam
`fn_e_participante` e o `auth.uid()` do remetente / prestador.

## 2. Migração `conversas_propostas`

Um arquivo: `supabase/migrations/<timestamp>_conversas_propostas.sql`.
Teste: `supabase/tests/00XX_conversas_propostas.test.sql`
(`begin … select * from finish(); rollback;`).

Toda função e trigger declara `security definer` e `set search_path = ''` (padrão
do Plano 1); todo objeto do `public` é referenciado com o prefixo `public.`.

### 2.1 `fn_aceitar_proposta(p_proposta_id uuid) returns uuid`

`SECURITY DEFINER`. Retorna o `contratacoes.id`. `grant execute to authenticated`
(revoke de `anon` / `public`).

Passos, numa única transação (a função inteira é o escopo transacional):

1. `select ... into v_prop from public.propostas where id = p_proposta_id for update;`
   — `not found` ⇒ `raise exception 'proposta_inexistente' using errcode = 'PT404';`
2. **Autorização**: `if auth.uid() is distinct from v_prop.cliente_id then raise
   exception 'nao_autorizado' using errcode = 'PT401'; end if;` (só o cliente dono
   da proposta aceita — RB05).
3. **Idempotência**: `if v_prop.status = 'ACEITA' then return (select id from
   public.contratacoes where proposta_id = p_proposta_id); end if;`
4. **Guarda de estado**: `if v_prop.status not in ('ENVIADA','VISUALIZADA') then
   raise exception 'proposta_indisponivel' using errcode = 'PT409'; end if;`
5. `update public.propostas set status = 'ACEITA', updated_at = now() where id =
   p_proposta_id;`
6. **Irmãs** (só quando `v_prop.demanda_id is not null`): `update public.propostas
   set status = 'RECUSADA', updated_at = now() where demanda_id = v_prop.demanda_id
   and id <> p_proposta_id and status in ('ENVIADA','VISUALIZADA');`
7. **Título do serviço**: se `demanda_id` não nulo, `select titulo into
   v_titulo from public.demandas_servico where id = v_prop.demanda_id;` senão
   `v_titulo := left(coalesce(nullif(v_prop.descricao,''), 'Serviço'), 120);`
8. `insert into public.contratacoes (proposta_id, demanda_id, titulo_servico,
   cliente_id, prestador_id, valor_total) values (p_proposta_id, v_prop.demanda_id,
   v_titulo, v_prop.cliente_id, v_prop.prestador_id, v_prop.valor) returning id
   into v_contratacao_id;`
   — a `unique` de `contratacoes.proposta_id` é a rede de segurança: numa corrida,
   a 2ª transação bate `23505`, faz `raise exception 'proposta_indisponivel' using
   errcode = 'PT409'` (capturado num `exception when unique_violation`).
9. `if v_prop.demanda_id is not null then update public.demandas_servico set status
   = 'CONTRATADA', updated_at = now() where id = v_prop.demanda_id; end if;`
10. `insert into public.mensagens (conversa_id, remetente_id, tipo, corpo,
    proposta_id) values (v_prop.conversa_id, v_prop.prestador_id, 'CONTRATO_GERADO',
    'Contrato gerado', p_proposta_id);` — o trigger `handle_new_mensagem` cuida do
    resumo / contadores.
11. `insert into public.notificacoes (usuario_id, tipo, titulo, corpo, ref_id)
    values (v_prop.prestador_id, 'PROPOSTA_ACEITA', 'Proposta aceita', ...,
    v_contratacao_id);` (colunas exatas de `notificacoes` fixadas no plano a partir
    do `db-types`).
12. `return v_contratacao_id;`

### 2.2 Trigger `handle_new_proposta`

`after insert on public.propostas for each row`. Insere a mensagem que representa a
proposta no chat:

```sql
insert into public.mensagens (conversa_id, remetente_id, tipo, corpo, proposta_id)
values (new.conversa_id, new.prestador_id, 'PROPOSTA',
        left(coalesce(nullif(new.descricao, ''), 'Proposta enviada'), 200), new.id);
```

O `handle_new_mensagem` roda em cascata e atualiza `conversas`.

### 2.3 Trigger `handle_new_mensagem`

`after insert on public.mensagens for each row`. Deriva o rótulo de resumo por
tipo e bump dos contadores:

```sql
-- rótulo
v_resumo := case new.tipo
  when 'TEXTO'            then left(new.corpo, 120)
  when 'FOTO'             then '📷 Foto'
  when 'VIDEO'            then '🎥 Vídeo'
  when 'AUDIO'            then '🎙️ Áudio'
  when 'LOCALIZACAO'      then '📍 Localização'
  when 'PROPOSTA'         then '💼 Proposta'
  when 'CONTRATO_GERADO'  then '📄 Contrato gerado'
  when 'PAGAMENTO_CONFIRMADO' then '💰 Pagamento confirmado'
  else left(new.corpo, 120)
end;

update public.conversas c set
  ultima_mensagem       = v_resumo,
  data_ultima_mensagem  = new.created_at,
  nao_lidas_cliente     = c.nao_lidas_cliente
                          + case when new.remetente_id = c.prestador_id then 1 else 0 end,
  nao_lidas_prestador   = c.nao_lidas_prestador
                          + case when new.remetente_id = c.cliente_id then 1 else 0 end,
  updated_at            = now()
where c.id = new.conversa_id;
```

Mensagem do próprio papel não incrementa o contador dele. `CONTRATO_GERADO` é
enviada com `remetente_id = prestador` — conta como não-lida para o cliente, o que
é o comportamento desejado (o cliente vê o badge e volta ao chat).

### 2.4 Dedup de conversa — índices únicos parciais

```sql
create unique index conversas_demanda_prestador_uniq
  on public.conversas (demanda_id, prestador_id) where tipo = 'DEMANDA';

create unique index conversas_direta_par_uniq
  on public.conversas (cliente_id, prestador_id) where tipo = 'DIRETA';
```

O repo faz *find-or-create*; o índice é a autoridade sob corrida (o `insert`
perde a corrida ⇒ `23505` ⇒ o repo re-`select`a a linha vencedora).

### 2.5 Realtime

```sql
alter publication supabase_realtime add table public.mensagens;
alter publication supabase_realtime add table public.conversas;
```

Só consumimos eventos `INSERT` (mensagens) e `INSERT`/`UPDATE` (conversas);
`replica identity default` basta. O RLS de `SELECT` já vigente nas duas tabelas é
aplicado aos eventos de realtime pelo servidor — um usuário só recebe eventos de
conversa em que é participante.

### 2.6 `set_updated_at`

O plano confere, contra o `db-types` e as migrations do Plano 1, se `conversas` e
`propostas` já têm trigger `set_updated_at` (a coluna `updated_at` existe nas
duas). Onde faltar, adiciona `create trigger set_updated_at before update ...
execute function public.set_updated_at();` (a função é do Plano 1). `mensagens`
**não** tem `updated_at` (é append-only) — nada a fazer.

### 2.7 SQLSTATEs de negócio

| `errcode` | Significado | Mapeia para `CodigoRepo` |
|---|---|---|
| `PT401` | quem chamou não é o cliente dono | `nao_autorizado` |
| `PT404` | proposta não existe | `nao_encontrado` |
| `PT409` | proposta não está mais pendente / já contratada | `conflito` |

`normalizarErro` ganha um branch: `PostgrestError.code` em (`PT401`,`PT404`,`PT409`)
⇒ o `CodigoRepo` da tabela. `nao_autorizado`, `nao_encontrado` e `conflito` já
existem no union `CodigoRepo` do Plano 3 — **sem mudança de tipo**.

## 3. Camada de repositories

Diretório `apps/mobile/src/shared/api/repositories/`, mesmo padrão do Plano 3
(interface em `xRepository.ts`, impl em `xRepository.supabase.ts`, cada método
`try` → mapeia linha → domínio → retorna; `catch (e) { throw normalizarErro(e) }`;
`{ error }` não-nulo ⇒ `throw normalizarErro(error)`; nunca vaza `PostgrestError`).

Barrel `index.ts` passa a exportar:

```ts
export const repositories = {
  categorias, enderecos, demandas, prestadores,   // Plano 3
  conversas, mensagens, propostas,                // Plano 4
};
```

### 3.1 `conversas`

```ts
// conversas/conversasRepository.ts
interface Conversa {
  id: string;
  tipo: 'DEMANDA' | 'DIRETA';
  demandaId: string | null;
  clienteId: string;
  prestadorId: string;
  status: string;
  ultimaMensagem: string | null;
  dataUltimaMensagem: string | null;
  naoLidas: number;            // já resolvido para o papel do usuário atual
  outroId: string;            // o outro participante
  outroNome: string | null;
  outroFotoUrl: string | null;
  createdAt: string;
}

interface ConversasRepository {
  listarMinhas(usuarioId: string): Promise<Conversa[]>;
  obter(id: string, usuarioId: string): Promise<Conversa>;
  iniciarDireta(clienteId: string, prestadorId: string): Promise<{ id: string }>;
  iniciarDemanda(demandaId: string, prestadorId: string): Promise<{ id: string }>;
}
```

- `listarMinhas` — `select` em `conversas` com `.or('cliente_id.eq.<uid>,
  prestador_id.eq.<uid>')`, `.order('data_ultima_mensagem', { ascending: false,
  nullsFirst: false })`. `naoLidas` = `nao_lidas_cliente` se `uid === cliente_id`
  senão `nao_lidas_prestador`. Nome / foto do outro: 2ª query em `perfis_publicos`
  com `in ('usuario_id', [ids dos outros])` (mesma estratégia da
  `demandasRepository.obter` do Plano 3 — sem embed de FK).
- `obter` — 1 linha por `id` + a mesma resolução do "outro". Usado pelo cabeçalho
  da `ConversaScreen`.
- `iniciarDireta` — *find-or-create*:
  1. `select id from conversas where tipo='DIRETA' and cliente_id=<c> and
     prestador_id=<p>` → achou ⇒ `return { id }`.
  2. senão `insert { tipo:'DIRETA', cliente_id:<c>, prestador_id:<p>,
     demanda_id: null }`, `.select('id').single()`.
  3. `catch` com `normalizarErro(e).code === 'conflito'` (23505, corrida) ⇒ repete
     o `select` do passo 1 e retorna.
- `iniciarDemanda` — lê `cliente_id` da demanda (`select cliente_id from
  demandas_servico where id=<d>`), depois *find-or-create* com
  `tipo:'DEMANDA'`, `demanda_id:<d>`, `prestador_id:<p>`, `cliente_id` lido. Mesmo
  tratamento de `conflito`.

### 3.2 `mensagens`

```ts
// mensagens/mensagensRepository.ts
interface Mensagem {
  id: string;
  conversaId: string;
  remetenteId: string;
  tipo: string;           // TEXTO | PROPOSTA | CONTRATO_GERADO | ...
  corpo: string;
  propostaId: string | null;
  lida: boolean;
  createdAt: string;
}

interface MensagensRepository {
  listar(conversaId: string, page: PageParams): Promise<Pagina<Mensagem>>;
  enviarTexto(conversaId: string, corpo: string, remetenteId: string): Promise<Mensagem>;
  marcarLidas(conversaId: string, usuarioId: string, papel: 'CLIENTE' | 'PRESTADOR'): Promise<void>;
}
```

- `listar` — keyset **descendente** por `created_at` (mensagem mais nova primeiro):
  `.order('created_at', { ascending: false })`, `if cursor` `.lt('created_at',
  cursor)`, `.limit(limite + 1)`. `proximoCursor` = `created_at` do último item
  mantido quando vieram `limite + 1` linhas; senão `null`. Mesma mecânica keyset do
  Plano 3, e o teste segue o template **R-F** (Ruling do Plano 3: `fetchNextPage()`
  sem `await`, `waitFor(hasNextPage === false)` antes de assertar
  `mock.calls`, `jest.clearAllMocks()` no `beforeEach`).
- `enviarTexto` — `insert { conversa_id, remetente_id: remetenteId, tipo:'TEXTO',
  corpo }`, `.select('*').single()`. `remetenteId` vem do `authStore` **pela
  feature** (o Supabase não injeta `auth.uid()` em `INSERT` client-side, e o
  `WITH CHECK remetente_id = auth.uid()` da RLS rejeita se não bater). Sem
  optimistic update — a mensagem aparece quando o evento realtime chega
  (latência típica < 300 ms; simples, sem reconciliação de estado otimista).
- `marcarLidas` — duas escritas, sem transação (idempotente e sem invariante entre
  elas):
  1. `update mensagens set lida = true where conversa_id = <c> and remetente_id <>
     <uid> and lida = false`.
  2. `update conversas set nao_lidas_<papel> = 0 where id = <c>` (coluna escolhida
     pelo `papel`: `nao_lidas_cliente` ou `nao_lidas_prestador`). A policy
     `mensagens_update_lida_participante` + o trigger `enforce_mensagem_update_scope`
     (Plano 1) já permitem o participante não-remetente mudar só `lida`.

### 3.3 `propostas`

```ts
// propostas/propostasRepository.ts
interface Proposta {
  id: string;
  demandaId: string | null;
  conversaId: string;
  prestadorId: string;
  clienteId: string;
  valor: number;
  taxaPlataforma: number | null;         // GENERATED no banco
  valorLiquidoPrestador: number | null;  // GENERATED no banco
  descricao: string;
  prazoExecucao: string | null;
  validadeDias: number;
  status: string;
  createdAt: string;
}

interface NovaProposta {
  conversaId: string;
  demandaId: string | null;
  clienteId: string;
  prestadorId: string;
  valor: number;
  descricao: string;
  prazoExecucao: string | null;
  validadeDias: number;      // default 7 na tela
}

interface PropostasRepository {
  daConversa(conversaId: string): Promise<Proposta[]>;
  obter(id: string): Promise<Proposta>;
  criar(dados: NovaProposta): Promise<{ id: string }>;
  recusar(id: string): Promise<void>;
  aceitar(propostaId: string): Promise<{ contratacaoId: string }>;
}
```

- `daConversa` — `select * ... where conversa_id = <c> order by created_at asc`.
  Usada para hidratar os `PropostaCard` do histórico (o corpo da mensagem
  `PROPOSTA` só traz a descrição; o card precisa de valor / prazo / status atual).
- `criar` — `insert` do `row` montado de `NovaProposta` (**sem** `status` — o
  default `ENVIADA` é do banco), `.select('id').single()`. O trigger
  `handle_new_proposta` insere a mensagem `PROPOSTA`; a feature não insere mensagem.
- `recusar` — `update propostas set status = 'RECUSADA' where id = <id>`. (Sem RPC:
  recusar não tem efeito colateral transacional; a RLS `propostas_update_participante`
  cobre.) Não gera mensagem no Plano 4.
- `aceitar` — `supabase.rpc('fn_aceitar_proposta', { p_proposta_id: propostaId })`;
  `if (error) throw normalizarErro(error)`; `return { contratacaoId: data as string }`.
  `normalizarErro` mapeia `PT401/PT404/PT409` (§2.7).

## 4. Hooks de realtime

`apps/mobile/src/features/conversas/hooks/`.

### 4.1 `useMensagensRealtime(conversaId: string)`

```ts
useEffect(() => {
  const canal = supabase
    .channel(`msgs:${conversaId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'mensagens',
        filter: `conversa_id=eq.${conversaId}` },
      (payload) => {
        const nova = linhaParaMensagem(payload.new);
        queryClient.setQueryData<InfiniteData<Pagina<Mensagem>>>(
          ['mensagens', conversaId],
          (prev) => {
            if (!prev) return prev;
            const jaExiste = prev.pages.some((pg) =>
              pg.itens.some((m) => m.id === nova.id));
            if (jaExiste) return prev;             // dedup por id (eco do próprio insert)
            const [primeira, ...resto] = prev.pages;
            return {
              ...prev,
              pages: [{ ...primeira, itens: [nova, ...primeira.itens] }, ...resto],
            };
          },
        );
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // pega o gap de uma reconexão
        queryClient.invalidateQueries({ queryKey: ['mensagens', conversaId] });
      }
    });
  return () => { supabase.removeChannel(canal); };
}, [conversaId]);
```

A página 0 do `useInfiniteQuery` é a das mensagens mais novas (ordem
descendente), então o *prepend* nela é correto. Dedup por `id` cobre o eco do
`INSERT` disparado pelo próprio remetente.

### 4.2 `useConversasRealtime()`

Montado no `ConversasListScreen` (fica ativo enquanto a aba de conversas existe na
árvore). Dois listeners porque o Realtime não faz `OR` num `filter` só:

```ts
const usuarioId = useAuthStore((s) => s.usuarioId);
useEffect(() => {
  if (!usuarioId) return;
  const bump = () =>
    queryClient.invalidateQueries({ queryKey: ['conversas', 'minhas'] });
  const canal = supabase
    .channel(`conversas:${usuarioId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'conversas',
        filter: `cliente_id=eq.${usuarioId}` }, bump)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'conversas',
        filter: `prestador_id=eq.${usuarioId}` }, bump)
    .subscribe();
  return () => { supabase.removeChannel(canal); };
}, [usuarioId]);
```

`invalidateQueries` em vez de patch manual: a lista é curta, o refetch é barato e
a reordenação por `data_ultima_mensagem` sai de graça do servidor.

## 5. Features, telas e rotas

```
features/conversas/
  screens/    ConversasListScreen.tsx   (substitui features/shell/screens/ConversasListScreen.tsx)
              ConversaScreen.tsx
  hooks/      useMinhasConversas.ts  useConversa.ts
              useMensagensInfinite.ts  useEnviarTexto.ts  useMarcarLidas.ts
              useIniciarConversa.ts
              useMensagensRealtime.ts  useConversasRealtime.ts
  components/  ConversaRow.tsx  BolhaMensagem.tsx
  types/      conversa.types.ts

features/propostas/
  screens/    NovaPropostaScreen.tsx
  hooks/      usePropostasDaConversa.ts  useCriarProposta.ts
              useRecusarProposta.ts  useAceitarProposta.ts
  components/  PropostaCard.tsx  ContratoGeradoCard.tsx
  types/      proposta.types.ts
```

### Rotas novas (`app/(app)/`, só import + render de screen)

- `conversa/[id].tsx` → `ConversaScreen`
- `conversa/[id]/nova-proposta.tsx` → `NovaPropostaScreen`

`app/(app)/(tabs)/conversas.tsx` já existe (Plano 2) — passa a renderizar
`features/conversas/screens/ConversasListScreen` no lugar do stub.

Regra mantida: nenhum `*.test.*` dentro de `app/`.

### 5.1 `ConversasListScreen`

- `useMinhasConversas()` (`useQuery ['conversas','minhas']`) + `useConversasRealtime()`.
- `FlatList` de `ConversaRow`: foto + nome do outro, `ultimaMensagem`, hora
  relativa de `dataUltimaMensagem`, badge com `naoLidas` quando `> 0`.
- `isLoading` → `<CarregandoEstado/>`; `isError` → `<ErroEstado
  mensagem={traduzErroRepo(error)} onRetry={refetch}/>`; vazio → `<VazioEstado
  mensagem="Nenhuma conversa ainda."/>` (átomos do Plano 2).
- Tap → `router.push(`/conversa/${id}`)`.

### 5.2 `ConversaScreen`

Params `{ id }`. Hooks: `useConversa(id)` (cabeçalho — nome do outro),
`useMensagensInfinite(id)`, `usePropostasDaConversa(id)`,
`useMensagensRealtime(id)`, `useMarcarLidas(id)`.

- **Lista**: `FlatList inverted`, `data = data.pages.flatMap(p => p.itens)` (já vem
  do mais novo para o mais antigo, que é o que `inverted` quer). `onEndReached`
  (que com `inverted` é o topo visual = mensagens mais antigas) →
  `if (hasNextPage && !isFetchingNextPage) fetchNextPage()`.
- **Render por `tipo`**:
  - `TEXTO` → `BolhaMensagem` (alinhada por `remetenteId === meuId`).
  - `PROPOSTA` → `PropostaCard` (busca a proposta em
    `usePropostasDaConversa` por `msg.propostaId`): valor formatado BRL,
    descrição, prazo, `status`. Se **sou o cliente** e `status ∈ {ENVIADA,
    VISUALIZADA}` → botões **Aceitar** / **Recusar**. Senão, só o selo de status.
  - `CONTRATO_GERADO` → `ContratoGeradoCard`: "Contrato gerado" + valor do
    contrato (lido da proposta por `propostaId`). Sem navegação (a tela de
    contratação é o Plano 5).
- **Marcar lida**: `useMarcarLidas(id)` dispara no mount e sempre que uma mensagem
  do outro chega com a tela em foco (`useIsFocused()` do React Navigation).
- **Enviar**: input de texto + botão → `useEnviarTexto(id)` com
  `remetenteId = useAuthStore.getState().usuarioId`. Limpa o input no `onMutate`;
  a bolha aparece pelo realtime.
- **Botão "Enviar proposta"** no cabeçalho: visível só quando
  `uiModeStore.modo === 'prestar'` **e** `usuarioId === conversa.prestadorId`.
  → `router.push(`/conversa/${id}/nova-proposta`)`.

### 5.3 `NovaPropostaScreen`

Params `{ id }` (conversaId). `useConversa(id)` para ter `demandaId` / `clienteId`
/ `prestadorId`.

Formulário: `valor` (numérico, máscara BRL), `descricao` (obrigatória),
`prazoExecucao` (texto livre — ex. "3 dias"), `validadeDias` (numérico, default
`7`). Botão desabilitado enquanto `valor <= 0` ou `descricao` vazia.

Submit → `useCriarProposta()` com `NovaProposta` montado (`clienteId` e
`prestadorId` do `useConversa` + `authStore`; `demandaId` da conversa). `onSuccess`
→ `router.back()` — a `ConversaScreen` recebe a mensagem `PROPOSTA` pelo realtime
(o trigger a inseriu) e o `PropostaCard` renderiza.

### 5.4 Wiring nas telas do Plano 3

- **`PrestadorPerfilScreen`** (cliente vê o prestador): novo botão **"Conversar"**.
  `useIniciarConversa().iniciarDireta(prestadorId)` → `router.push(`/conversa/${id}`)`.
  `clienteId` = `authStore`.
- **`DemandaDetalheScreen`** (prestador vê a demanda): novo botão **"Tenho
  interesse"**, visível só no `modo === 'prestar'`.
  `useIniciarConversa().iniciarDemanda(demandaId, usuarioId)` →
  `router.push(`/conversa/${id}`)`.

## 6. Fluxo de dados (TanStack Query)

| Hook | queryKey | tipo |
|---|---|---|
| `useMinhasConversas()` | `['conversas','minhas']` | `useQuery` |
| `useConversa(id)` | `['conversa', id]` | `useQuery` |
| `useMensagensInfinite(id)` | `['mensagens', id]` | `useInfiniteQuery` |
| `usePropostasDaConversa(id)` | `['propostas','conversa', id]` | `useQuery` |

- `useInfiniteQuery`: `queryFn: ({ pageParam }) => repositories.mensagens.listar(id,
  { limite: 30, cursor: pageParam })`, `initialPageParam: undefined`,
  `getNextPageParam: (ultima) => ultima.proximoCursor ?? undefined`.
- Mutations (todas com `mutationFn` chamando o repo; `remetenteId` / ids de
  `useAuthStore.getState()`):
  - `useEnviarTexto(conversaId)` — não invalida nada (o realtime cobre a lista de
    mensagens; o `handle_new_mensagem` + `useConversasRealtime` cobrem a lista de
    conversas).
  - `useMarcarLidas(conversaId)` — `onSuccess` → `invalidateQueries(['conversas',
    'minhas'])` e `setQueryData(['conversa', conversaId], ...)` zerando `naoLidas`
    localmente (o realtime de `conversas` também chega, mas o feedback do badge tem
    que ser imediato).
  - `useCriarProposta()` — `onSuccess` → `invalidateQueries(['propostas','conversa',
    conversaId])`. A mensagem `PROPOSTA` vem pelo realtime.
  - `useRecusarProposta()` — `onSuccess` → `invalidateQueries(['propostas',
    'conversa', conversaId])`.
  - `useAceitarProposta()` — `onSuccess` → invalida, nesta ordem:
    `['propostas','conversa', conversaId]`, `['mensagens', conversaId]`,
    `['conversa', conversaId]`, `['demandas','detalhe', demandaId]` (key do Plano 3),
    `['demandas','abertas']`, `['conversas','minhas']`.
- `useIniciarConversa()` — objeto com `iniciarDireta` / `iniciarDemanda` (mutations
  ou funções async simples); sem cache próprio, o destino é a navegação. `onSuccess`
  → `invalidateQueries(['conversas','minhas'])`.

## 7. Erros

- Repos sempre entregam `RepoError` (Plano 3). Hooks não capturam; o erro propaga
  para `useQuery` / `useMutation`.
- `traduzErroRepo` (Plano 3, em `shared/lib/`) ganha copy específica para os
  códigos que a RPC produz — os `code` já existem, muda só o texto quando o
  contexto é proposta. Estratégia: `traduzErroRepo(e)` continua genérico; a
  `ConversaScreen` passa um override por contexto:

  | `code` | Copy no contexto de proposta |
  |---|---|
  | `nao_autorizado` | "Só o cliente da demanda pode aceitar esta proposta." |
  | `conflito` | "Esta proposta não está mais disponível." |
  | `nao_encontrado` | "Proposta não encontrada." |
  | `rede` | "Sem conexão. Tente de novo." |

  Implementação: `traduzErroRepo(e, 'proposta')` — 2º parâmetro opcional
  `contexto?: 'proposta'` que troca 3 ramos; o default segue igual ao Plano 3.
- `PropostaCard`: erro de `useAceitarProposta` / `useRecusarProposta` inline em
  `<Text className="text-sf-status-red">`, botões voltam a habilitar.
- `NovaPropostaScreen`: erro da mutation inline, como as telas de auth do Plano 2.
- `iniciarDireta` / `iniciarDemanda` com `conflito` (23505) **não** é erro visível
  — o repo trata internamente (re-`select`) e devolve a conversa existente.
- Falha ao resolver o nome do "outro" (2ª query em `perfis_publicos`) não derruba a
  conversa: `outroNome` fica `null` e a UI cai para "Usuário".
- `QueryCache.onError` global (Plano 2) segue chamando `notificarErroGlobal` — sem
  mudança.

## 8. Testes

### 8.1 pgTAP (`supabase/tests/00XX_conversas_propostas.test.sql`)

- `handle_new_proposta`: após `insert` em `propostas`, existe uma linha em
  `mensagens` com `tipo = 'PROPOSTA'` e `proposta_id` = o id inserido, `remetente_id`
  = `prestador_id`.
- `handle_new_mensagem`:
  - mensagem do cliente ⇒ `nao_lidas_prestador` += 1, `nao_lidas_cliente`
    inalterado;
  - mensagem do prestador ⇒ `nao_lidas_cliente` += 1;
  - `ultima_mensagem` e `data_ultima_mensagem` refletem a última inserida;
  - `tipo = 'PROPOSTA'` ⇒ `ultima_mensagem = '💼 Proposta'`.
- `conversas_demanda_prestador_uniq`: 2ª `insert` com mesmo `(demanda_id,
  prestador_id)` e `tipo='DEMANDA'` ⇒ `throws_ok` (23505). Uma com `tipo='DIRETA'` e
  mesmo par passa.
- `conversas_direta_par_uniq`: idem para `(cliente_id, prestador_id)` /
  `tipo='DIRETA'`.
- `fn_aceitar_proposta` — feliz (com demanda e uma proposta irmã):
  proposta alvo `ACEITA`; irmã `RECUSADA`; existe `contratacoes` com
  `proposta_id` = alvo, `valor_total` = `valor` da proposta; `demandas_servico.status
  = 'CONTRATADA'`; existe `mensagens` `tipo='CONTRATO_GERADO'`; existe `notificacoes`
  para o prestador. (7 asserts.)
- `fn_aceitar_proposta` — idempotente: 2ª chamada retorna o **mesmo**
  `contratacoes.id` e `select count(*) from contratacoes where proposta_id = ...`
  continua `1`.
- `fn_aceitar_proposta` — autorização: `set local role` / `set request.jwt.claims`
  para um `auth.uid()` que não é o cliente ⇒ `throws_ok` com `errcode PT401`.
- `fn_aceitar_proposta` — conflito: proposta já `RECUSADA` ⇒ `throws_ok` `PT409`.
- `fn_aceitar_proposta` — proposta inexistente ⇒ `throws_ok` `PT404`.
- Conversa `DIRETA` (`demanda_id` nulo): `fn_aceitar_proposta` não tenta atualizar
  `demandas_servico`, usa `descricao` como `titulo_servico`, e não mexe em irmãs.

### 8.2 Jest — repos (`.supabase.test.ts`, padrão Plano 3: `mockQuery` / `mkChain`,
assert de `normalizarErro`)

- `conversas.iniciarDireta`: (a) conversa existe ⇒ retorna id sem `insert`;
  (b) não existe ⇒ `insert`; (c) `insert` rejeita 23505 ⇒ re-`select` e retorna a
  linha vencedora.
- `conversas.iniciarDemanda`: lê `cliente_id` da demanda antes do find-or-create.
- `conversas.listarMinhas`: `.or(...)` com os dois `eq`; `.order` desc; `naoLidas`
  resolvido pelo papel; nome do outro vindo da 2ª query.
- `mensagens.listar`: keyset `.lt('created_at', cursor)` só com cursor;
  `.limit(31)`; `proximoCursor` = `created_at` do 30º quando vêm 31; `null` quando
  vêm ≤ 30. **Template R-F** no teste do hook correspondente.
- `mensagens.enviarTexto`: `insert` com `tipo:'TEXTO'` e `remetente_id` = o
  argumento; retorna a linha mapeada.
- `mensagens.marcarLidas`: dois `update` — `mensagens` (`lida=true`,
  `remetente_id <> uid`, `lida=false`) e `conversas` (`nao_lidas_<papel> = 0`);
  `papel='CLIENTE'` toca `nao_lidas_cliente`.
- `propostas.criar`: `insert` sem `status`; retorna `{ id }`.
- `propostas.recusar`: `update status='RECUSADA'` no id.
- `propostas.aceitar`: chama `supabase.rpc('fn_aceitar_proposta', { p_proposta_id })`;
  `{ error: { code: 'PT409' } }` ⇒ rejeita com `RepoError { code: 'conflito' }`;
  `{ error: { code: 'PT401' } }` ⇒ `nao_autorizado`; sucesso ⇒ `{ contratacaoId }`.
- `normalizarErro`: novos casos `PT401 → nao_autorizado`, `PT404 → nao_encontrado`,
  `PT409 → conflito` (adicionar à tabela do teste existente do Plano 3).

### 8.3 Jest — hooks (`renderHook` + `criarWrapperQuery()`, Ruling R6; repos
mockados)

- `useMensagensInfinite`: 2 páginas, `getNextPageParam`; `fetchNextPage()` **sem
  `await`** + `await waitFor(() => expect(result.current.hasNextPage).toBe(false))`
  antes de assertar as chamadas (Ruling R-F); `jest.clearAllMocks()` no `beforeEach`.
- `useMinhasConversas`: mapeia e ordena por `dataUltimaMensagem` desc.
- `useEnviarTexto`: chama `repositories.mensagens.enviarTexto` com os 3 args;
  **não** invalida query nenhuma.
- `useMarcarLidas`: `onSuccess` invalida `['conversas','minhas']` e faz
  `setQueryData(['conversa', id])` zerando `naoLidas`.
- `useCriarProposta`: `onSuccess` invalida `['propostas','conversa', id]`.
- `useAceitarProposta`: sucesso ⇒ `invalidateQueries` chamado para as 6 keys da
  §6; erro `conflito` ⇒ a mutation fica `isError` e não invalida.

### 8.4 Jest — hooks de realtime

- `useMensagensRealtime`: mock de `supabase.channel` ⇒ `{ on: jest.fn()
  .mockReturnThis(), subscribe: jest.fn().mockReturnThis() }` e `supabase
  .removeChannel`. Dispara manualmente o callback registrado no `.on` com um
  `payload.new` ⇒ assert que `queryClient.setQueryData` fez *prepend* na página 0;
  dispara de novo com o **mesmo id** ⇒ estado inalterado (dedup). `unmount()` ⇒
  `removeChannel` chamado.
- `useConversasRealtime`: sem `usuarioId` ⇒ não abre canal; com `usuarioId` ⇒
  dois `.on` (filtros `cliente_id` e `prestador_id`); callback ⇒
  `invalidateQueries(['conversas','minhas'])`; `unmount` ⇒ `removeChannel`.

### 8.5 Jest — screens (só lógica condicional própria)

- `ConversaScreen`: (a) `tipo='PROPOSTA'` + sou cliente + `status='ENVIADA'` ⇒
  botões Aceitar/Recusar presentes; (b) sou prestador ⇒ ausentes, só o selo;
  (c) `tipo='CONTRATO_GERADO'` ⇒ `ContratoGeradoCard` com o valor; (d) botão
  "Enviar proposta" só aparece com `modo='prestar'` e `usuarioId===prestadorId`.
- `NovaPropostaScreen`: botão desabilita com `valor<=0` ou `descricao` vazia;
  submit chama `useCriarProposta` com o payload montado.
- `ConversasListScreen`: badge de `naoLidas` só com `> 0`.

Sem teste para `BolhaMensagem` puro, `ConversaRow` puro, cabeçalho.

### 8.6 Gate do plano (igual Planos 2 e 3)

`tsc --noEmit` 0 · `jest` verde e auto-encerrando · `eslint` 0 erros ·
`expo-doctor` 18/18 · `expo export --platform ios` EXIT 0 ·
`pnpm db:push` aplica a migração no dev · `pnpm db:test` verde (runner pgTAP).

Regras mantidas: nenhum `*.test.*` em `app/`; todo hook react-query nos testes usa
`criarWrapperQuery()` (R6); seletores Zustand atômicos em `app/` (R7);
`process.env.EXPO_PUBLIC_*` literal só em `supabaseClient.ts` (R3).

## 9. Interfaces que os planos seguintes consomem

- Barrel `repositories` += `conversas`, `mensagens`, `propostas` — o Plano 4b
  adiciona `anexos` (ou estende `mensagens`) no mesmo padrão.
- `fn_aceitar_proposta(uuid) → uuid` — o Plano 5 (contratação) parte do
  `contratacoes.id` retornado.
- `Conversa` / `Mensagem` / `Proposta` (tipos de domínio) — o Plano 4b renderiza
  os tipos de mensagem de mídia dentro da mesma `ConversaScreen`; o Plano 5 lê a
  proposta `ACEITA` a partir da conversa.
- `useMensagensRealtime` / `useConversasRealtime` — o Plano 7 (notificações)
  reaproveita o padrão de canal para `notificacoes`.
- SQLSTATEs `PT401` / `PT404` / `PT409` e o branch em `normalizarErro` — convenção
  para toda RPC de negócio dos planos seguintes.
