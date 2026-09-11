# Plano 6 — Pagamento Pix/EFI — Design

**Data:** 2026-09-11
**Base:** `homolog` @ `72e6a3c` (Planos 1–5 mergeados)
**Spec-mãe:** `docs/superpowers/specs/2026-09-08-migracao-react-native-supabase-design.md` (seções 5, 6, 10)
**Regras de negócio:** `docs/regras-de-negocio/regras-de-negocio.md` (RB08, RB09)
**Plano anterior:** `docs/superpowers/specs/2026-09-10-plano-5-contratacao-design.md`

## 1. Objetivo e escopo

Fechar o ciclo **Contratação → Pagamento → Execução → Pagamento final**: entrada
50% via Pix/EFI libera a execução, o prestador marca início/fim, o pagamento
final 50% libera a conclusão. É o primeiro plano com **Edge Functions** (Deno) e
o primeiro a falar com um serviço externo real (EFI).

**Decisão de escopo (usuário, 2026-09-11):** implementação real da EFI
(OAuth + mTLS + webhook) direto nesta fase, sem gateway de abstração. Só
revisão estática nesta sessão — sem `.env`/link Supabase aqui (mesma limitação
dos Planos 1–5, ruling R-DB-ENV), então nenhum código deste plano roda de
verdade antes do usuário fazer `supabase functions deploy` e testar contra a
sandbox de homologação EFI. Risco documentado, aceito.

### Dentro do escopo

- **Migração**: corrige `fn_aceitar_proposta` (Plano 4) — hoje não cria o
  `pagamentos` ENTRADA que a spec-mãe §10 descreve. Duas RPCs novas,
  `fn_iniciar_execucao` e `fn_concluir_execucao` — a transição
  AGENDADA→EM_ANDAMENTO não está na spec-mãe (só existia no Kotlin antigo como
  update direto pelo prestador); tratada aqui no mesmo padrão RPC do Plano 5.
- **Edge Functions**: `criar-cobranca-pix` (OAuth EFI + mTLS + gera QR/copia-e-cola),
  `efi-webhook` (endpoint público, confirma pagamento). Primeira migration de
  infraestrutura `supabase/functions/`.
- **Repository `pagamentos`**: `buscarPendente`, `criarCobranca`, `obterPorId`.
- **`contratacoesRepository`** ganha `iniciarExecucao`, `concluirExecucao`.
- **Tela `PagamentoScreen`** (rota `pagamento/[contratacaoId].tsx`, já prevista
  na árvore da spec-mãe §9): QR + copia-e-cola + polling de status.
- **`ContratacaoScreen`** (Plano 5): troca o placeholder "Pagamento estará
  disponível em breve" por CTAs reais (pagar entrada/final, iniciar/finalizar
  serviço).
- **Segredos**: `supabase secrets set` documentado (execução do usuário).

### Fora do escopo (planos posteriores)

- Avaliações (RB10, Plano 7) — depende de `CONCLUIDA`, que só passa a existir
  de verdade quando o `efi-webhook` confirmar o pagamento `FINAL`.
- Reembolso, disputa, split de repasse pro prestador — não fazem parte do MVP
  (RB "questões em aberto" do negócio).
- Push notification nativa quando o pagamento confirma — `notificacoes`
  continua sendo só a tabela (lida via polling/realtime futuro), sem push.
- Container dedicado pra mTLS — só entra se o mTLS via `Deno.createHttpClient`
  não funcionar de verdade no runtime de Edge Functions (risco já sinalizado
  na spec-mãe §10; o usuário valida isso ao rodar o primeiro `deploy`).

### O que já existe e é só consumido

`contratacoes` (status default `AGUARDANDO_PAGAMENTO`, colunas geradas
`valor_entrada`/`valor_final`/`taxa_plataforma`) e `pagamentos` (tabela,
enums `tipo_pagamento`/`status_pagamento`, RLS `contratacoes_select_partes`
equivalente) — Plano 1. `fn_aceitar_proposta`, `fn_cancelar_contratacao` — Planos
4/5, padrão de RPC `SECURITY DEFINER` + SQLSTATE `PT401`/`PT404`/`PT409` +
`normalizarErro`. `ContratacaoScreen`, `TrabalhosScreen`, `formatarBRL` — Plano 5.

## 2. Migração

Um arquivo: `supabase/migrations/<TS>_fn_execucao_pagamento.sql`.
Teste: `supabase/tests/0027_fn_execucao_pagamento.test.sql`.

### 2.1 Fix do `fn_aceitar_proposta` (Plano 4, gap)

`create or replace function public.fn_aceitar_proposta` — corpo idêntico ao
existente, com uma inserção nova logo antes do `insert into public.mensagens`
(mesma transação, mesma trava de `for update` já tomada):

```sql
insert into public.pagamentos (contratacao_id, valor, tipo)
values (v_contratacao, round(v_prop.valor * 0.50, 2), 'ENTRADA');
```

O valor replica a fórmula da coluna gerada `contratacoes.valor_entrada`
(`round(valor_total * 0.50, 2)`) — não dá pra fazer `select ... returning`
pegar a coluna gerada e reusar porque o `insert` de `contratacoes` já fechou
antes desse ponto; recalcular é mais simples que um `select` extra e o
resultado é idêntico por construção (`valor_total = v_prop.valor`).

### 2.2 `fn_iniciar_execucao(p_contratacao_id uuid) returns void`

```sql
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

  -- idempotente: ja em andamento -> nao faz nada
  if v_contr.status = 'EM_ANDAMENTO' then
    return;
  end if;

  if v_contr.status <> 'AGENDADA' then
    raise exception 'contratacao_indisponivel' using errcode = 'PT409';
  end if;

  update public.contratacoes set status = 'EM_ANDAMENTO' where id = p_contratacao_id;
end;
$$;

revoke execute on function public.fn_iniciar_execucao(uuid) from public, anon;
grant execute on function public.fn_iniciar_execucao(uuid) to authenticated;
```

Só o prestador inicia (RB implícita do fluxo — quem executa marca início).
Sem mensagem/notificação: é um passo operacional, não um evento que as duas
partes precisam ver no chat (diferente de aceite/cancelamento).

### 2.3 `fn_concluir_execucao(p_contratacao_id uuid) returns uuid`

```sql
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

  -- idempotente: ja existe pagamento FINAL -> devolve o existente,
  -- mesmo que a contratacao ja tenha avancado (ex.: CONCLUIDA pelo webhook)
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

revoke execute on function public.fn_concluir_execucao(uuid) from public, anon;
grant execute on function public.fn_concluir_execucao(uuid) to authenticated;
```

`status` **não** muda pra `CONCLUIDA` aqui — só o `efi-webhook`, ao confirmar
o pagamento `FINAL`, faz essa transição (spec-mãe §10). A contratação fica
`EM_ANDAMENTO` com um pagamento `FINAL` `PENDENTE` pendurado até lá.

### 2.4 pgTAP (`0027_fn_execucao_pagamento.test.sql`)

- `fn_aceitar_proposta`: depois de aceitar, existe `pagamentos` `tipo='ENTRADA'`,
  `status='PENDENTE'`, `valor = round(proposta.valor * 0.5, 2)`.
- `fn_iniciar_execucao`: authz (não-prestador → `PT401`), inexistente → `PT404`,
  conflito (status `AGUARDANDO_PAGAMENTO` → `PT409`), feliz (`AGENDADA` →
  `EM_ANDAMENTO`), idempotente (2ª chamada em `EM_ANDAMENTO` não lança).
- `fn_concluir_execucao`: authz, inexistente, conflito (status `AGENDADA` →
  `PT409`), feliz (`EM_ANDAMENTO` → cria `pagamentos` `FINAL` `PENDENTE`,
  `valor = contratacoes.valor_final`, `data_conclusao` preenchida, `status`
  continua `EM_ANDAMENTO`), idempotente (2ª chamada devolve o mesmo
  `pagamento_id`, mesmo se a contratação já tiver avançado por fora).

## 3. Edge Functions

`supabase/functions/`, runtime Deno. Todas usam `service_role` (client
próprio, ignora RLS) — a autorização por chamador é feita a mão dentro de
cada função, igual as RPCs fazem com `auth.uid()`.

```
supabase/functions/
  _shared/
    efi.ts     # getAccessToken, criarCobranca, buscarQrcode, extrairCertPem
    auth.ts    # getUsuarioAutenticado(req)
    cors.ts    # headers CORS padrão (reuso simples)
  criar-cobranca-pix/index.ts
  efi-webhook/index.ts
```

### 3.1 `_shared/efi.ts`

```ts
import { create as forgePkcs12FromAsn1 } from "npm:node-forge/lib/pkcs12.js";
// (import real ajustado na implementação — node-forge expõe `forge.pkcs12`,
// `forge.pki`, `forge.util`; o ponto fixo é extrair certChain+privateKey uma
// vez por cold start e cachear em módulo, não por request.)

interface CertPem { certChain: string; privateKey: string; }

let certCache: CertPem | null = null;

function extrairCertPem(base64P12: string, senha: string): CertPem {
  if (certCache) return certCache;
  // forge.util.decode64 -> forge.asn1.fromDer -> forge.pkcs12.pkcs12FromAsn1(asn1, senha)
  // -> percorre safeContents pra achar o certBag e o keyBag
  // -> forge.pki.certificateToPem(cert) / forge.pki.privateKeyToPem(key)
  certCache = { certChain: "...", privateKey: "..." };
  return certCache;
}

let tokenCache: { token: string; expiraEm: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiraEm > Date.now()) return tokenCache.token;
  const cert = extrairCertPem(Deno.env.get("EFI_CERT_P12_BASE64")!, "");
  const client = Deno.createHttpClient({
    certChain: cert.certChain,
    privateKey: cert.privateKey,
  });
  const basic = btoa(`${Deno.env.get("EFI_CLIENT_ID")}:${Deno.env.get("EFI_CLIENT_SECRET")}`);
  const resp = await fetch("https://pix.api.efipay.com.br/oauth/token", {
    method: "POST",
    client,
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
  const cert = extrairCertPem(Deno.env.get("EFI_CERT_P12_BASE64")!, "");
  const client = Deno.createHttpClient({ certChain: cert.certChain, privateKey: cert.privateKey });
  const resp = await fetch(`https://pix.api.efipay.com.br/v2/cob/${txid}`, {
    method: "PUT",
    client,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      calendario: { expiracao: 3600 },
      valor: { original: valor.toFixed(2) },
      chave: chavePix,
    }),
  });
  if (!resp.ok) throw new Error(`efi_cob_falhou:${resp.status}`);
  const cob = await resp.json();
  const qr = await fetch(`https://pix.api.efipay.com.br/v2/loc/${cob.loc.id}/qrcode`, {
    client,
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  return {
    locId: cob.loc.id as number,
    pixCopiaCola: qr.qrcode as string,
    qrCodeBase64: qr.imagemQrcode as string, // já vem como data:image/png;base64,...
  };
}
```

`node-forge` via `npm:node-forge` (Deno resolve pacotes npm nativamente).
`.p12` local do repo Kotlin não tem senha própria separada do certificado —
confirmar no primeiro deploy real; se houver senha, vira mais um secret
(`EFI_CERT_P12_SENHA`), ajuste de uma linha.

### 3.2 `_shared/auth.ts`

```ts
import { createClient } from "npm:@supabase/supabase-js@2";

export async function getUsuarioAutenticado(req: Request): Promise<string> {
  const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!jwt) throw new Response(JSON.stringify({ error: { code: "nao_autorizado" } }), { status: 401 });
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data, error } = await supa.auth.getUser(jwt);
  if (error || !data.user) throw new Response(JSON.stringify({ error: { code: "nao_autorizado" } }), { status: 401 });
  return data.user.id;
}
```

### 3.3 `criar-cobranca-pix/index.ts`

Entrada: `{ pagamento_id: string }`. Passos:

1. `getUsuarioAutenticado(req)` → `usuarioId`.
2. `service_role` client: busca `pagamentos` join `contratacoes` por
   `pagamento_id`. Não achou → 404 `{ code: "nao_encontrado" }`.
3. `usuarioId !== contratacao.cliente_id` → 401 `{ code: "nao_autorizado" }`
   (só o cliente paga).
4. `pagamento.status === "PAGO"` → 409 `{ code: "conflito" }`. `"PROCESSANDO"`
   → devolve os dados já gravados (`txid`/`pix_copia_cola`/`qr_code_base64`)
   sem chamar a EFI de novo — idempotência por `pagamento_id`.
5. `"PENDENTE"`: monta `txid` = `"SF" + (tipo === "ENTRADA" ? "ENT" : "FIN") +
   pagamento_id.replace(/-/g, "")` truncado em 35 chars (regex EFI:
   `[a-zA-Z0-9]{26,35}`); chama `criarCobranca(txid, pagamento.valor,
   Deno.env.get("PLATFORM_PIX_KEY"))`; `update pagamentos set txid, efi_loc_id,
   pix_copia_cola, qr_code_base64, status = 'PROCESSANDO' where id =
   pagamento_id`.
6. Responde `{ txid, pixCopiaCola, qrCodeBase64, status: "PROCESSANDO" }`.
7. Falha de rede/EFI (catch): não altera `pagamentos` (fica `PENDENTE`,
   retry seguro), responde 502 `{ code: "gateway_indisponivel" }`.

### 3.4 `efi-webhook/index.ts`

Rota pública: `efi-webhook/:token` (path param, **não** header — a EFI não
permite configurar headers customizados no webhook registrado, só a URL).
`config.toml`: `verify_jwt = false` pra essa função (é a EFI batendo, não um
usuário com JWT Supabase).

1. `token` da URL `!== Deno.env.get("EFI_WEBHOOK_TOKEN")` → 404 (não vaza que
   a rota existe).
2. Body: `{ pix: [{ txid, ... }] }` (formato EFI). Pra cada item:
   - `select * from pagamentos where txid = item.txid` — não achou: ignora
     esse item (log, segue os outros), a EFI não deve reenviar `txid`
     desconhecido, mas não é motivo pra falhar o webhook inteiro.
   - já `PAGO`: ignora (idempotente, a EFI reenvia notificações).
   - senão: `update pagamentos set status = 'PAGO', data_pagamento = now()
     where id = ...`; se `txid` começa com `SFENT`: `update contratacoes set
     entrada_paga = true, status = 'AGENDADA' where id = contratacao_id`;
     se começa com `SFFIN`: `update contratacoes set final_pago = true,
     status = 'CONCLUIDA' where id = contratacao_id`; insere `mensagens`
     `tipo='PAGAMENTO_CONFIRMADO'` (corpo fixo por tipo) e `notificacoes` pros
     dois lados (`cliente_id` e `prestador_id` da contratação).
3. Sempre responde `200` (mesmo se algum item foi ignorado) — é o contrato
   que a EFI espera pra não reenviar em loop.

## 4. Camada de app

```
shared/api/repositories/pagamentos/
  pagamentosRepository.ts
  pagamentosRepository.supabase.ts
  pagamentosRepository.supabase.test.ts

features/pagamentos/
  hooks/    usePagamentoPendente.ts  useCriarCobranca.ts  usePagamentoStatus.ts
  screens/  PagamentoScreen.tsx
  types/    pagamento.types.ts

features/contratacoes/
  hooks/    useIniciarExecucao.ts  useConcluirExecucao.ts   (novos, ao lado dos do Plano 5)

apps/mobile/app/(app)/pagamento/[contratacaoId].tsx   → PagamentoScreen
```

### 4.1 `pagamentosRepository`

```ts
interface Pagamento {
  id: string;
  contratacaoId: string;
  valor: number;
  tipo: "ENTRADA" | "FINAL";
  status: "PENDENTE" | "PROCESSANDO" | "PAGO" | "CANCELADO" | "EXPIRADO";
  txid: string | null;
  pixCopiaCola: string | null;
  qrCodeBase64: string | null;
  dataPagamento: string | null;
}

interface PagamentosRepository {
  buscarPendente(contratacaoId: string): Promise<Pagamento | null>;
  criarCobranca(pagamentoId: string): Promise<Pagamento>;
  obterPorId(pagamentoId: string): Promise<Pagamento>;
}
```

- `buscarPendente`: `.select(...).eq("contratacao_id", id).in("status", ["PENDENTE","PROCESSANDO"]).order("created_at",{ascending:false}).limit(1).maybeSingle()` — `null` se não achou (não é erro; contratação sem pagamento pendente é estado válido).
- `criarCobranca`: `supabase.functions.invoke("criar-cobranca-pix", { body: { pagamento_id: pagamentoId } })`; `error` (inclui erro HTTP não-2xx do `functions.invoke`) → `normalizarErro` mapeia pelo `error.context.status`/corpo JSON pro mesmo formato de `RepoError` das RPCs.
- `obterPorId`: select simples por `id`, usado pelo polling.
- Todos `try/catch` → `normalizarErro`, mesmo contrato dos outros repos.

### 4.2 Hooks

```ts
usePagamentoPendente(contratacaoId: string)
  // queryKey: ["pagamento","pendente",contratacaoId], enabled: !!contratacaoId

useCriarCobranca()
  // mutationFn: (pagamentoId) => repositories.pagamentos.criarCobranca(pagamentoId)
  // onSuccess: seta os dados no cache de ["pagamento", pagamento.id] (evita 1 fetch a mais)

usePagamentoStatus(pagamentoId: string | null)
  // queryKey: ["pagamento", pagamentoId], enabled: !!pagamentoId
  // refetchInterval: (query) => query.state.data?.status === "PROCESSANDO" ? 5000 : false

useIniciarExecucao(propostaId: string)
  // mutationFn: (contratacaoId) => repositories.contratacoes.iniciarExecucao(contratacaoId)
  // onSuccess: invalida ["contratacao","proposta",propostaId], ["contratacoes","minhas"]

useConcluirExecucao(propostaId: string)
  // mesmo padrão de invalidação de useIniciarExecucao
```

### 4.3 `PagamentoScreen({ contratacaoId }: { contratacaoId: string })`

- `usePagamentoPendente(contratacaoId)`: `isLoading` → `<CarregandoEstado/>`;
  sem pagamento pendente (`null`) → mensagem "Nada pendente pra pagar" +
  botão voltar (estado alcançável se o usuário navegar direto pra essa rota
  depois do pagamento já confirmado).
- Ao resolver um pagamento `PENDENTE`: dispara `useCriarCobranca().mutate(id)`
  uma vez (`useEffect` com guarda `useRef` pra não duplicar em re-render).
- `usePagamentoStatus(pagamento?.id ?? null)` (fonte de verdade pro polling,
  inicializado com o resultado do passo anterior via cache):
  - `PROCESSANDO`: `<Image source={{ uri: qrCodeBase64 }} className="w-64 h-64"/>`,
    texto do copia-e-cola em `<Text selectable>`, botão "Copiar código"
    (`expo-clipboard`, `Clipboard.setStringAsync`).
  - `PAGO`: tela de sucesso, botão "Voltar" → `router.back()` (a tela só é
    alcançável a partir da `ContratacaoScreen`, que já fez o `push`; `back()`
    evita precisar do `proposta_id` nesta rota e ainda refaz o fetch da
    `ContratacaoScreen` ao focar de novo, mostrando o status atualizado).
  - erro de rede na criação da cobrança: `erroPagamento(criarCobranca.error)` +
    botão "Tentar de novo" (repete a mutation).

### 4.4 `ContratacaoScreen` (Plano 5) — troca do placeholder

Bloco atual (`c.status === "AGUARDANDO_PAGAMENTO"` → aviso + Cancelar) vira:

- `usePagamentoPendente(c.id)` além do que já existe.
- Cliente com pagamento pendente: botão **"Pagar entrada"**/**"Pagar final"**
  (rótulo pelo `pagamento.tipo`) → `router.push(\`/pagamento/${c.id}\`)`.
  Botão Cancelar continua **só** em `AGUARDANDO_PAGAMENTO` (sem mudança do
  Plano 5 — cancelamento pós-entrada-paga não está no MVP).
- Prestador, `status === "AGENDADA"`: botão **"Iniciar serviço"** →
  `useIniciarExecucao(id).mutate(c.id)`.
- Prestador, `status === "EM_ANDAMENTO"` e sem pagamento `FINAL` pendente
  ainda: botão **"Finalizar serviço"** → `useConcluirExecucao(id).mutate(c.id)`.
- Demais combinações (ex.: prestador em `EM_ANDAMENTO` com `FINAL` já
  `PROCESSANDO`): só o selo de status, sem CTA — esperando o cliente pagar.

## 5. Fluxo de dados

Nenhuma `queryKey` nova colide com Planos 3–5. `usePagamentoStatus` é o único
hook com polling ativo do app até aqui — desliga sozinho (`refetchInterval:
false`) assim que sai de `PROCESSANDO`, então não fica rodando em telas que o
usuário já deixou (TanStack Query já pausa queries de tela desmontada por
padrão).

## 6. Erros

- `pagamentosRepository` e as duas RPCs novas seguem o mesmo `RepoError`
  (`nao_autorizado`/`nao_encontrado`/`conflito`/genérico) de sempre.
- Erro novo específico de Edge Function: `gateway_indisponivel` (falha de
  rede/HTTP com a EFI) — `erroPagamento` trata como "Não foi possível gerar o
  pagamento agora. Tente de novo.", os demais códigos reaproveitam as
  mensagens já padronizadas nos planos anteriores.
- `efi-webhook` nunca propaga erro pro chamador (é a EFI) além de ignorar
  itens não reconhecidos — evita reenvio infinito por um item ruim isolado.

## 7. Segredos (ação do usuário, fora desta sessão)

```bash
supabase secrets set \
  EFI_CLIENT_ID=... EFI_CLIENT_SECRET=... \
  EFI_CERT_P12_BASE64="$(base64 -w0 caminho/para/homologacao.p12)" \
  EFI_WEBHOOK_TOKEN=... PLATFORM_PIX_KEY=app.servicofeito@gmail.com
```

Valores: os mesmos já vazados no Kotlin antigo (`docs/arquitetura-antiga/.../EfiConfig.kt`),
decisão registrada de não rotacionar (ver `docs/superpowers/plans/2026-09-08-fundacao-checklist-operacional.md`).
`EFI_WEBHOOK_TOKEN` é novo (não existia no Kotlin) — o usuário gera um valor
aleatório qualquer no momento do registro do webhook no painel EFI.
`supabase/config.toml` ganha:

```toml
[functions.efi-webhook]
verify_jwt = false
```

(`criar-cobranca-pix` fica com o `verify_jwt = true` default — dupla trava:
a plataforma Supabase já rejeita JWT ausente/inválido antes de invocar a
função, `getUsuarioAutenticado` resolve o `usuarioId` pra autorização de
negócio em cima disso.)

## 8. Testes

pgTAP: seção 2.4. Edge Functions: **sem teste automatizado** nesta fase — um
mock da API EFI não valida a integração real (formato de payload, mTLS,
assinatura do webhook), e a sandbox de homologação só existe fora desta
sessão. Risco explícito: o primeiro teste de ponta a ponta acontece quando o
usuário rodar `supabase functions deploy` + gerar uma cobrança real de
homologação. Jest/RTL no padrão dos planos anteriores para: `pagamentosRepository`
(mock de `supabase-js`/`functions.invoke`), os 4 hooks novos, `PagamentoScreen`
(estados: sem pendente / processando com QR / pago / erro de rede),
`ContratacaoScreen` (CTAs novos gated por status+papel). Gate final: `tsc` /
`jest` / `eslint` / `expo-doctor` / `expo export`. `db:push`/`db:test`/`db:types`
e o primeiro `functions deploy` ficam pendentes pro usuário (ruling R-DB-ENV).

## 9. Interfaces que o Plano 7 consome

- `contratacoes.status === 'CONCLUIDA'` — gatilho real (via webhook) pra
  liberar a tela de avaliação (RB10).
- `pagamentosRepository`/`Pagamento` — reutilizável se o Plano 7 precisar
  mostrar histórico de pagamento junto da avaliação.
- Padrão de Edge Function (`_shared/auth.ts`, resposta `{ error: { code } }`)
  — reaproveitável se alguma função futura precisar rodar fora de RLS.
