# Design — Migração do Serviço Feito para React Native + Supabase

Data: 2026-09-08
Status: aprovado para escrita do plano de implementação
Autor: VitorHugoVH (com Claude Code)

---

## 1. Contexto e objetivo

O Serviço Feito é um marketplace de intermediação entre clientes e prestadores de
serviços (diaristas, eletricistas, pintores, pedreiros, jardineiros e afins). O
núcleo do produto é o ciclo **Demanda → Conversa privada → Proposta → Contratação →
Pagamento → Avaliação**, com conta unificada (o mesmo usuário contrata e presta).

O projeto foi iniciado em duas frentes. A frente existente é um app Android nativo
em Kotlin (Jetpack Compose + Room + acesso ao Supabase via PostgREST/Retrofit),
preservado em `docs/arquitetura-antiga/`. Esta migração substitui essa frente por
um app **React Native + Expo + TypeScript** com backend **Supabase**.

Há um plano futuro de introduzir uma API em C# (`ServicoFeitoApi`) e infraestrutura
AWS. **Esse plano não faz parte deste escopo.** O objetivo agora é lançar o MVP com
o app e suas funcionalidades operando sobre o Supabase, deixando um ponto de troca
(seam) claro para migrar a lógica de servidor para C# depois sem reescrever o app.

### Fontes canônicas

- Regras de negócio: `docs/regras-de-negocio/servico_feito_documentacao (1).md` (RB01–RB17).
- Padrões de arquitetura do front mobile: `docs/arquitetura-front-mobile/arquitetura-front-mobile.md`.
- Referência da implementação anterior: `docs/arquitetura-antiga/`.

O documento de arquitetura do front pressupõe a API C# e um cliente HTTP tipado
gerado de OpenAPI. Onde uma decisão só faz sentido com a API C#, este design a
adapta para o Supabase e registra a adaptação. Os princípios que permanecem:
separação `app/` (rotas) vs `src/features/` (lógica); screen → hook → service;
dado de servidor no TanStack Query; estado de sessão/UI no Zustand; token em
`expo-secure-store`; segredos por variável de ambiente; autorização real no
servidor, não na UI; teste unitário obrigatório de hooks e services.

---

## 2. Escopo do MVP

Entra:

- Autenticação (Supabase Auth, e-mail + senha), conta unificada, alternância de
  modo "contratar" / "prestar" no cliente.
- Perfil de usuário e perfil de prestador (bio, categorias, preço-base,
  disponibilidade, portfólio, certificados, endereços).
- Catálogo de categorias, busca e descoberta de prestadores e de demandas.
- Criação de demanda com checklist de tarefas.
- Conversa privada (tipo DEMANDA e DIRETA), chat com realtime.
- Proposta (envio, visualização, aceite, recusa, expiração).
- Contratação com ciclo de estados e marcos de pagamento 50/50.
- **Pagamento real via Pix/EFI** (entrada 50%, final 50%, taxa de plataforma 20%),
  incluindo a Edge Function de webhook.
- Avaliação cliente → prestador após conclusão.
- Notificações in-app (lista + badge). Push fica para depois.

Fica para depois: painel/admin, moderação e disputas, notificações push, avaliação
prestador → cliente, plano premium, anúncios, ranqueamento avançado de busca,
integração com a API C# e AWS, observabilidade com APM externo.

---

## 3. Decisões de arquitetura

| Decisão | Valor |
|---|---|
| Framework | React Native |
| Toolchain | Expo (managed workflow), EAS Build |
| Linguagem | TypeScript (strict) |
| Runtime Node | 20 LTS |
| Monorepo | pnpm workspaces (`apps/*`, `packages/*`); Turborepo só se necessário |
| Navegação | Expo Router (file-based) |
| Estado de dados de servidor | TanStack Query |
| Estado de cliente | Zustand |
| Acesso ao backend | `supabase-js` encapsulado atrás de repositories por domínio |
| Tipos de dados do backend | gerados por `supabase gen types typescript` em `packages/db-types` |
| Lógica crítica de servidor | Edge Functions (Deno) + funções plpgsql `SECURITY DEFINER` |
| Autorização | Postgres RLS + validação nas Edge Functions |
| Armazenamento de sessão | `expo-secure-store` (adapter do `supabase-js`) |
| Estilo/UI | React Native + NativeWind, identidade visual portada do app Kotlin |
| Componentes | Atomic Design em `src/shared/components` |
| Segredos de servidor | Supabase secrets (`supabase secrets set`) |
| Segredos públicos do app | `.env` com prefixo `EXPO_PUBLIC_` |
| Testes | Jest (`jest-expo`) + Testing Library; `deno test`; pgTAP via runner Node (`pg`) contra o projeto dev |

### Abordagem escolhida: RLS + Edge Functions nos fluxos críticos

- Repositories (implementação `supabase-js`) cuidam de leitura e CRUD simples.
- RLS no Postgres garante privacidade (RB03, RB13–RB15).
- Edge Functions são donas de dinheiro e transições de estado: `aceitar-proposta`,
  `criar-cobranca-pix`, `concluir-execucao`, `efi-webhook`.
- Cada Edge Function corresponde a um futuro endpoint da API C#; a interface do
  repository não muda quando a implementação passar de Supabase para HTTP/C#.

Alternativas descartadas: lógica crítica só em RPC plpgsql (mais difícil de portar
para C# e de testar); orquestração multi-passo no cliente (integridade fraca,
inaceitável com dinheiro).

---

## 4. Estrutura do repositório

```
mobile/
├── apps/
│   └── mobile/                         # app Expo
│       ├── app/                        # rotas Expo Router (só importam screens)
│       ├── src/
│       │   ├── features/<feat>/{screens,components,hooks,services,types}
│       │   │   # feats: usuarios, prestadores, categorias, demandas, conversas,
│       │   │   #        propostas, contratacoes, pagamentos, avaliacoes, notificacoes
│       │   └── shared/
│       │       ├── api/
│       │       │   ├── supabaseClient.ts
│       │       │   └── repositories/<dominio>/{<x>Repository.ts, <x>Repository.supabase.ts}
│       │       ├── components/{atoms,molecules,organisms}
│       │       ├── store/              # authStore, uiModeStore (Zustand)
│       │       ├── hooks/
│       │       └── theme/              # tokens portados do Compose
│       ├── app.json  eas.json  tailwind.config.js  babel.config.js
│       └── **/*.test.ts(x)
├── packages/
│   └── db-types/                       # saída de `supabase gen types typescript` (Database)
├── supabase/
│   ├── migrations/*.sql                # esquema versionado — fonte da verdade
│   ├── functions/                      # aceitar-proposta, criar-cobranca-pix,
│   │                                   # concluir-execucao, efi-webhook, _shared/
│   ├── tests/                          # pgTAP
│   └── config.toml
├── docs/                               # specs, arquitetura antiga, regras de negócio
├── .github/workflows/ci.yml
├── package.json                        # workspaces
├── pnpm-workspace.yaml
├── .env.example
└── .gitignore                          # ignora .env, *.p12, *.pem
```

Limpeza: consolidar `servico-feito/` (raiz) e `docs/arquitetura-antiga/servico-feito/`
numa única pasta em `docs/arquitetura-antiga/`, removendo `.git` aninhado, `build/`,
`.gradle/`, `.idea/`, `.kotlin/`. Remover `env/` (virtualenv Python solto) da raiz.

---

## 5. Ambientes Supabase

Dois projetos alimentados pelas mesmas migrations:

- **dev** (`servico-feito-dev`): usado no desenvolvimento; chaves limpas; alvo de
  `supabase gen types --linked` e do CI.
- **prod**: criado no lançamento; recebe as migrations aprovadas.

**Sem stack Supabase local (decisão do usuário, 2026-09-08).** Não se usa Docker
nem Postgres local. O desenvolvimento e o CI trabalham direto contra o projeto
**dev** na nuvem:

- Migrations aplicadas com `supabase db push --linked` (forward-only).
- pgTAP roda por um runner Node (`supabase/tests/run.mjs`, client `pg`) que executa
  cada `supabase/tests/*.test.sql` contra a connection string do dev; cada arquivo
  fica em `begin … select * from finish(); rollback;`, então não persiste dados.
- Lint de esquema: `supabase db advisors --linked` no lugar de `supabase db lint`.
- `supabase/config.toml` existe (para `supabase init` / `migration new` / `db push`),
  mas nada de `supabase start`.

O projeto Supabase antigo (`yaqmivazqarfkggypuow`) é descartado. Qualquer credencial
presente no código Kotlin do repositório é considerada comprometida.

### Rotação de segredos (pré-requisito, independente da migração)

O repositório Kotlin contém segredos versionados que **precisam ser rotacionados
antes de qualquer uso ou publicação**:

- `SupabaseConfig.kt` — JWT `service_role` do projeto antigo.
- `EfiConfig.kt` — `CLIENT_ID` / `CLIENT_SECRET` da EFI em homologação **e produção**,
  e `PLATFORM_PIX_KEY`.
- `app/src/main/res/raw/producao.p12` e `homologacao.p12` — certificados mTLS da EFI.

Ação: rotacionar credenciais EFI de produção no painel da EFI; gerar novos
certificados; os valores novos entram apenas como Supabase secrets, nunca no
repositório. `.gitignore` passa a bloquear `*.p12` / `*.pem` / `.env`.

---

## 6. Modelo de dados (Postgres)

Convenções: nomes `snake_case`; `id uuid default gen_random_uuid()` como PK (exceto
onde indicado); `created_at timestamptz default now()`, `updated_at timestamptz`
mantido por trigger. Valores monetários derivados são colunas
`GENERATED ALWAYS AS (...) STORED` — nunca calculados pelo cliente.

### Identidade

`auth.users` (Supabase Auth) é a identidade. A tabela `usuarios` tem
`id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`. Um trigger
`AFTER INSERT ON auth.users` cria a linha base em `usuarios`. Não existe coluna de
senha (o app Kotlin guardava senha em texto plano — eliminado).

### Enums

`status_demanda` (ABERTA, EM_NEGOCIACAO, CONTRATADA, FINALIZADA, CANCELADA);
`tipo_conversa` (DEMANDA, DIRETA);
`status_conversa` (ATIVA, ENCERRADA, BLOQUEADA);
`tipo_mensagem` (TEXTO, AUDIO, VIDEO, FOTO, LOCALIZACAO, PROPOSTA, CONTRATO_GERADO, PAGAMENTO_CONFIRMADO, SISTEMA);
`status_proposta` (ENVIADA, VISUALIZADA, ACEITA, RECUSADA, CANCELADA, EXPIRADA);
`status_contratacao` (AGUARDANDO_PAGAMENTO, AGENDADA, EM_ANDAMENTO, CONCLUIDA, CANCELADA);
`tipo_pagamento` (ENTRADA, FINAL);
`status_pagamento` (PENDENTE, PROCESSANDO, PAGO, CANCELADO, EXPIRADO);
`tipo_notificacao` (PROPOSTA, PAGAMENTO, MENSAGEM, CONTRATACAO, AVALIACAO).

### Tabelas

| Tabela | Campos-chave | Observações |
|---|---|---|
| `usuarios` | `id` (→ auth.users), nome, telefone, cidade, bairro, avatar_cor_hex, foto_perfil_url, status_conta, rating_cliente, total_contratacoes_cliente | 1:1 com auth.users |
| `perfil_prestador` | `usuario_id` PK (→ usuarios), titulo_profissional, bio, cnpj_mei, tem_mei, verificado, documento_verificado, selo_fundador, preco_base, tempo_experiencia, rating, total_avaliacoes, total_servicos, disponivel, raio_km, chave_pix | presença da linha = usuário é prestador |
| `categoria_servico` | nome, descricao, icone_key, preco_medio_hora, popular | seed via migration |
| `prestador_categoria` | prestador_id, categoria_id | N:N (RB11); PK composta |
| `enderecos_usuario` | usuario_id, identificacao, cep, estado, cidade, bairro, logradouro, numero, complemento, principal | |
| `demandas_servico` | cliente_id, categoria_id, titulo, descricao, endereco (cidade/bairro/completo), orcamento_maximo, data_desejada, urgencia, status, total_propostas | |
| `tarefas_demanda` | demanda_id, nome_tarefa, descricao, concluida | |
| `conversas` | tipo, demanda_id (nullable, RB05), cliente_id, prestador_id, status, ultima_mensagem, data_ultima_mensagem, nao_lidas_cliente, nao_lidas_prestador | |
| `participantes_conversa` | conversa_id, usuario_id, papel | fonte de verdade de quem enxerga a conversa (RB14/RB15) |
| `mensagens` | conversa_id, remetente_id, tipo, corpo, proposta_id (nullable), lida | |
| `anexos_mensagem` | mensagem_id, url, nome_arquivo, tipo_arquivo, tamanho | binário no Supabase Storage |
| `propostas` | demanda_id (nullable), prestador_id, cliente_id, conversa_id, valor, `taxa_plataforma` GEN, `valor_liquido_prestador` GEN, descricao, prazo_execucao, validade_dias, status, tarefas_ids | taxa = valor * 0.20; líquido = valor * 0.80 |
| `contratacoes` | demanda_id (nullable), proposta_id, titulo_servico, cliente_id, prestador_id, valor_total, `valor_entrada` GEN, `valor_final` GEN, `taxa_plataforma` GEN, status, entrada_paga, final_pago, avaliado, data_agendada, data_conclusao | entrada/final = total * 0.50 |
| `pagamentos` | contratacao_id, valor, tipo, status, gateway, txid, efi_loc_id, pix_copia_cola, qr_code_base64, data_pagamento | |
| `avaliacoes` | contratacao_id, avaliador_id, prestador_id, nota (1–5), comentario, pontualidade, qualidade, cordialidade | |
| `notificacoes` | usuario_id, titulo, mensagem, tipo, referencia_id, lida | |
| `portfolio_prestador` | prestador_id, url_media | |
| `disponibilidade_prestador` | usuario_id, seg..dom (bool) | |
| `licencas_certificados` | usuario_id, titulo, instituicao, data_inicio, data_fim, url_imagem, cod_credencial | |

### View pública

`perfis_publicos` — projeção de `usuarios` + `perfil_prestador` com apenas campos
não sensíveis (nome, cidade, avatar, rating, título, bio, preço-base, verificado).
É o que a descoberta consulta.

---

## 7. Row Level Security

RLS habilitada em todas as tabelas. Helper `fn_e_participante(conversa_id uuid)
returns boolean`, `stable`, `SECURITY DEFINER`, que testa se `auth.uid()` está em
`participantes_conversa`.

| Tabela | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| `usuarios` | via view `perfis_publicos` (campos públicos); linha própria completa | UPDATE só `id = auth.uid()` |
| `perfil_prestador`, `categoria_servico`, `portfolio_prestador`, `avaliacoes` | público | só o dono do recurso |
| `prestador_categoria`, `disponibilidade_prestador`, `licencas_certificados` | público | só o dono |
| `enderecos_usuario` | só `usuario_id = auth.uid()` | só o dono |
| `demandas_servico` | dono, ou (status = ABERTA e quem consulta tem `perfil_prestador`) | INSERT/UPDATE só `cliente_id = auth.uid()` |
| `tarefas_demanda` | quem pode ver a demanda | só o cliente dono da demanda |
| `conversas`, `mensagens`, `propostas`, `anexos_mensagem` | `fn_e_participante(conversa_id)` | INSERT só se participante; sem UPDATE de proposta pelo cliente além de marcar VISUALIZADA |
| `participantes_conversa` | participante da conversa | criado por Edge Function / RPC, não pelo cliente direto |
| `contratacoes`, `pagamentos` | cliente ou prestador da contratação | **nenhum INSERT/UPDATE direto do cliente** — só service_role via Edge Function |
| `notificacoes` | só `usuario_id = auth.uid()` | só UPDATE do campo `lida` na linha própria |

Testes pgTAP em `supabase/tests/` cobrindo, no mínimo: prestador B não lê conversa
de prestador A na mesma demanda; cliente não consegue inserir em `contratacoes`;
usuário sem `perfil_prestador` não lista demandas abertas de terceiros; usuário só
marca como lida a própria notificação.

---

## 8. Camada de dados do app

Fluxo obrigatório: **screen → hook (TanStack Query) → repository (interface) →
implementação Supabase → Postgres/RLS.** Screen nunca importa `supabase-js` nem o
repository diretamente.

### Repositories

Um diretório por domínio com interface e implementação separadas:

```
shared/api/repositories/
├── types.ts            # RepoError, PageParams, tipos utilitários
├── demandas/
│   ├── demandasRepository.ts            # interface DemandasRepository
│   └── demandasRepository.supabase.ts   # implementação
├── conversas/ ...  propostas/ ...  contratacoes/ ...  pagamentos/ ...
└── index.ts            # objeto { demandas, conversas, ... } com as implementações
```

- A implementação converte a linha do banco
  (`Database['public']['Tables']['<t>']['Row']`, de `packages/db-types`) para o
  tipo de domínio da feature (`features/<feat>/types/*.types.ts`). A conversão vive
  na implementação, não na screen. "DTO gerado do OpenAPI" do documento de
  arquitetura passa a ser "tipo do banco gerado pelo Supabase".
- Erros do `supabase-js` (`PostgrestError`, `FunctionsHttpError`) são normalizados
  para `RepoError { code, message, cause }` com
  `code ∈ { nao_autenticado, nao_autorizado, nao_encontrado, conflito, validacao,
  rede, desconhecido }` antes de sair do repository.
- Escritas críticas na implementação chamam
  `supabase.functions.invoke('<função>')`, não `.from().insert()`. A interface do
  repository não expõe essa diferença.

### Hooks (TanStack Query)

Um conjunto por feature (`useDemandasAbertas`, `useCriarDemanda`, ...). Cache,
loading, erro e revalidação pela biblioteca — nunca `useState`/`useEffect` para
chamada de dados. Convenção de `queryKey`: `['<dominio>', '<consulta>', <filtros>]`.
Mutations chamam `queryClient.invalidateQueries` no `onSuccess`.

### Zustand

Somente estado que não vem do servidor:

- `authStore`: `session`, `usuarioId`, `carregando`. Hidrata do secure-store no
  boot; assina `supabase.auth.onAuthStateChange`.
- `uiModeStore`: `modo: 'contratar' | 'prestar'` (RB01), persistido localmente. Não
  é role, não vai em token.

### Realtime

Hook `useMensagensRealtime(conversaId)` abre um `supabase.channel` e aplica os
eventos via `queryClient.setQueryData`. Ativo apenas nas telas de chat abertas;
`unsubscribe` no unmount.

### Geração de tipos

Script `pnpm db:types` roda
`supabase gen types typescript --project-id <dev>` e grava
`packages/db-types/index.ts` (commitado). Regenerado a cada migration.

---

## 9. Autenticação e navegação

### Cliente Supabase

`shared/api/supabaseClient.ts` cria o client com
`auth: { storage: SecureStoreAdapter, persistSession: true, autoRefreshToken: true,
detectSessionInUrl: false }`. `SecureStoreAdapter` encapsula `expo-secure-store`
(`getItem`/`setItem`/`removeItem`), com fatiamento da sessão em blocos por causa do
limite de ~2 KB por entrada. `EXPO_PUBLIC_SUPABASE_URL` e
`EXPO_PUBLIC_SUPABASE_ANON_KEY` vêm do `.env`; a `anon key` é pública por design e a
segurança está na RLS.

### Fluxos

`signUp` (e-mail + senha) → trigger cria `usuarios` → tela "completar perfil"
(nome, telefone, cidade). `signInWithPassword`. `resetPasswordForEmail` com deep
link `servicofeito://auth/redefinir`. `signOut` limpa secure-store e o cache do
TanStack Query. Arquitetura preparada para adicionar OTP/social depois sem
refatorar (o gate de sessão não muda).

### Rotas (Expo Router)

```
app/
├── _layout.tsx                 # carrega sessão; QueryClientProvider; tema
├── (auth)/
│   ├── _layout.tsx             # com sessão → Redirect /(app)
│   ├── login.tsx  registrar.tsx  redefinir-senha.tsx
├── (app)/
│   ├── _layout.tsx             # sem sessão → Redirect /(auth)/login
│   ├── completar-perfil.tsx    # usuarios.nome nulo força esta tela
│   ├── (tabs)/
│   │   ├── _layout.tsx         # conjunto de tabs conforme uiModeStore.modo
│   │   ├── index.tsx           # Início (Home Cliente ou Prestador)
│   │   ├── buscar.tsx / vagas.tsx
│   │   ├── conversas/index.tsx  conversas/[id].tsx
│   │   ├── trabalhos/index.tsx  # modo prestar
│   │   └── perfil.tsx
│   ├── demandas/criar.tsx  demandas/[id].tsx
│   ├── prestadores/[id].tsx
│   ├── contratacoes/[id].tsx
│   ├── pagamento/[contratacaoId].tsx
│   └── prestador/{cadastro,editar-perfil,portfolio,disponibilidade,certificados,financeiro}.tsx
```

- Alternância "contratar"/"prestar" muda `uiModeStore.modo`; `(tabs)/_layout.tsx`
  remonta o conjunto de tabs. Não há tela de "escolher papel" (RB01).
- Modo "prestar" sem `perfil_prestador` leva à tela de cadastro de prestador
  (convida, não bloqueia).
- Controle de rota é proteção de UX; autorização real é RLS + Edge Functions.
- `app.json` declara o scheme `servicofeito` (reset de senha; base para push
  depois).

---

## 10. Pagamento Pix/EFI e transições de estado

Quatro Edge Functions (Deno), todas rodando com `service_role` (ignoram RLS) e
todas validando o JWT do chamador com `supabase.auth.getUser(jwt)` antes de agir.

### `aceitar-proposta`

Entrada: `proposta_id`. O chamador precisa ser o `cliente_id` da proposta. Chama a
função plpgsql `fn_aceitar_proposta` (`SECURITY DEFINER`), que numa transação:

1. move a proposta de `ENVIADA|VISUALIZADA` para `ACEITA` e as irmãs da mesma
   demanda para `RECUSADA`;
2. cria `contratacoes` com status `AGUARDANDO_PAGAMENTO` (valores 50/50 e taxa 20%
   por colunas geradas);
3. cria `pagamentos` do tipo `ENTRADA` com status `PENDENTE`;
4. move a demanda para `CONTRATADA`;
5. insere `mensagens` do tipo `CONTRATO_GERADO` e `notificacoes` para o prestador.

Idempotente por `proposta_id`: se já `ACEITA`, retorna a contratação existente.

### `criar-cobranca-pix`

Entrada: `pagamento_id`. O chamador precisa ser o cliente da contratação e o
pagamento precisa estar `PENDENTE`. Passos: OAuth EFI (`client_credentials`) →
`POST v2/cob` com o nosso `txid` → `GET v2/loc/{id}/qrcode`. Grava
`pagamentos.txid`, `efi_loc_id`, `pix_copia_cola`, `qr_code_base64` e move o status
para `PROCESSANDO`. Retorna QR + copia-e-cola para o app. **O app nunca fala com a
EFI.** Se o pagamento já estiver `PROCESSANDO`, reaproveita o `txid` e devolve os
dados existentes.

Convenção de `txid`: `SF` + tipo (`ENT` ou `FIN`) + `pagamento_id` sem hífens,
truncado para o intervalo de 26–35 caracteres `[a-zA-Z0-9]` exigido pela EFI. O
prefixo permite ao webhook distinguir entrada de final.

Certificado EFI (`.p12`): convertido para base64 e guardado no secret
`EFI_CERT_P12_BASE64`; o Deno monta o mTLS via
`Deno.createHttpClient({ certChain, privateKey })`, extraindo o par do p12 no cold
start. **Risco em aberto:** se o runtime de Edge Functions não suportar mTLS de
forma confiável, o serviço de cobrança vai para um container dedicado
(Supabase agora, AWS depois). Resolver com um spike na fase de implementação, antes
de construir o restante do fluxo de pagamento.

### `concluir-execucao`

Entrada: `contratacao_id`. Chamador precisa ser o prestador e a contratação precisa
estar `EM_ANDAMENTO`. Marca `data_conclusao` e cria `pagamentos` do tipo `FINAL`
com status `PENDENTE`; a contratação permanece `EM_ANDAMENTO` até o `efi-webhook`
confirmar o pagamento final e movê-la para `CONCLUIDA`. O app então chama
`criar-cobranca-pix` para esse pagamento. Idempotente por `contratacao_id`: se já
existe pagamento `FINAL`, retorna o existente.

### `efi-webhook`

Endpoint público. **Valida o mTLS/assinatura da EFI** (a versão Kotlin não
validava — corrigir) usando `EFI_WEBHOOK_TOKEN`. Para cada objeto em `pix[]`,
localiza o `pagamentos` pelo `txid`, move para `PAGO` e grava `data_pagamento`.
Prefixo `ENT`: `contratacoes.entrada_paga = true`, status → `AGENDADA`. Prefixo
`FIN`: `final_pago = true`, status → `CONCLUIDA`. Insere `notificacoes` e
`mensagens` do tipo `PAGAMENTO_CONFIRMADO` para os dois lados. Idempotente: se o
pagamento já está `PAGO`, responde `200` e ignora (a EFI reenvia).

### Tela de pagamento no app

Invoca `criar-cobranca-pix`, exibe QR + copia-e-cola e faz polling com
`usePagamentoStatus(pagamentoId)` (TanStack Query, `refetchInterval` de 5 s
enquanto `PROCESSANDO`) lendo a tabela `pagamentos` (a RLS permite ao dono ler).
Realtime nessa tela pode substituir o polling depois.

### Segredos de servidor (`supabase secrets set`)

`EFI_CLIENT_ID`, `EFI_CLIENT_SECRET`, `EFI_CERT_P12_BASE64`, `EFI_WEBHOOK_TOKEN`,
`PLATFORM_PIX_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Todos os valores hoje presentes no
repositório Kotlin devem ser rotacionados antes de qualquer uso (ver seção 5).

---

## 11. Erros e observabilidade

- Repository: erros do `supabase-js` normalizados para `RepoError` antes de
  propagar.
- Hooks: erro propaga pelo TanStack Query (`isError`, `error`); sem try/catch em
  screen.
- UI: componentes `<CarregandoEstado>`, `<ErroEstado onRetry>`, `<VazioEstado>` em
  `shared/components/molecules`. Toast global para erro de mutation via
  `QueryCache.onError`.
- Sessão: `onAuthStateChange` com `SIGNED_OUT` limpa stores e redireciona para
  login.
- Edge Functions: resposta JSON `{ erro: { code, message } }` com o status HTTP
  correspondente (400/401/403/404/409/500); log estruturado; nunca expõem stack ou
  segredo.
- Idempotência: `aceitar-proposta` por `proposta_id`; `efi-webhook` pelo estado do
  pagamento; `criar-cobranca-pix` pelo `txid`.
- Offline: `retry: 2` no TanStack Query + `@react-native-community/netinfo` +
  banner "sem conexão".
- Observabilidade do MVP: Logs Explorer do Supabase para Edge Functions e Postgres.
  Sentry (plugin Expo) apenas para crash/erro não tratado, atrás de
  `EXPO_PUBLIC_SENTRY_DSN`; cortável se atrasar o MVP. As tabelas `pagamentos` e
  `notificacoes` servem de trilha de auditoria de dinheiro.

---

## 12. Testes

| Alvo | Ferramenta | Cobertura mínima |
|---|---|---|
| repositories (`*.supabase.ts`) | Jest + mock do `supabase-js` | mapeamento linha → domínio, normalização de erro, query correta |
| hooks (`useXxx`) | Jest + Testing Library + `QueryClientProvider` de teste | `queryKey`, invalidação, estados de loading/erro |
| stores (`authStore`, `uiModeStore`) | Jest | hidratação, transições |
| Edge Functions | `deno test` | fluxo `aceitar-proposta`, parsing do webhook, convenção de `txid`, idempotência |
| RLS | pgTAP via runner Node (`pg`) contra o dev | isolamento por participante; bloqueio de INSERT em `contratacoes`; escopo de notificações |
| screens | Jest | somente quando a tela tem lógica condicional própria |

Regra: hook, service/repository ou Edge Function novo ou alterado sem teste
correspondente não é considerado pronto.

CI (GitHub Actions): `pnpm test`, runner pgTAP Node contra o dev + `supabase db diff
--linked` vazio + `supabase db advisors --linked`, `deno test`, `tsc --noEmit`, lint.

---

## 13. Portabilidade do visual

Tokens de tema portados de `docs/arquitetura-antiga/.../ui/theme/Color.kt` para
`apps/mobile/src/shared/theme` e mapeados no `tailwind.config.js` (NativeWind):

- primária `#4DAF50`, secundária `#70D173`, tint `#CBE8CC`, verde escuro `#2E7D32`
  (usado no modo prestador);
- textos `#333333` / `#6B6B6B` / `#9E9E9E`; favorito `#E02957`;
- fundo `#FAFAFA`, superfície `#FFFFFF`, variante `#F1F8F1`, contorno `#E0E0E0`;
- status: amarelo `#FFA000`, azul `#1976D2`, verde `#388E3C`, vermelho `#D32F2F`.

O layout das telas do app Kotlin (Home, Busca/Categorias, Detalhe do prestador,
Criar demanda, Chat, Detalhe da contratação, Perfil unificado, telas de prestador)
serve de referência de composição para as screens equivalentes.

---

## 14. Riscos e pontos em aberto

- **mTLS da EFI em Edge Function** — resolver com spike antes de construir o fluxo
  de pagamento (seção 10). Fallback: container dedicado.
- **Rotação de segredos** — pré-requisito bloqueante para publicar (seção 5).
- **Limite de tamanho da sessão no `expo-secure-store`** — precisa do adapter com
  fatiamento; validar no início da implementação.
- **Regras de negócio ainda indefinidas no documento canônico** (política de
  cancelamento e reembolso; momento exato da cobrança da taxa de 20%; verificação
  documental de prestador sem CNPJ; disputas). O MVP implementa o caminho feliz e
  deixa `CANCELADA` como transição manual simples; as demais entram depois.
- **`concluir-execucao` e o gatilho de `EM_ANDAMENTO`** — definir na implementação
  se a passagem de `AGENDADA` para `EM_ANDAMENTO` é automática por data ou manual
  pelo prestador (provável: manual).
