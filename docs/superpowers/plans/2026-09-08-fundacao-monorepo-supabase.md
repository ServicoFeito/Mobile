# Fundação — Monorepo + Supabase (esquema + RLS + CI) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o monorepo pnpm e o banco de dados Supabase do Serviço Feito — esquema versionado em migrations, RLS em todas as tabelas, testes pgTAP passando localmente e em CI, e os tipos TypeScript do banco gerados — sem nenhum código de app ainda.

**Architecture:** Monorepo pnpm com workspaces `apps/*` e `packages/*`. O diretório `supabase/` na raiz é a fonte da verdade do banco: migrations SQL ordenadas por timestamp, funções auxiliares para RLS, e testes pgTAP em `supabase/tests/`. Um esquema `tests` (apoio a pgTAP) é criado por migration e tem execução revogada de `anon`/`authenticated`. Os tipos do banco são gerados por `supabase gen types typescript` e commitados em `packages/db-types`. CI roda `supabase db lint`, `supabase test db` e confere que os tipos commitados estão atualizados.

**Tech Stack:** pnpm 9, Node 20 LTS, Supabase CLI (via npm devDependency), PostgreSQL 15 (local via Docker), pgTAP, TypeScript 5 (strict), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-08-migracao-react-native-supabase-design.md` (este plano implementa as seções 4, 6, 7 e a parte de `packages/db-types` da seção 8; a rotação de segredos da seção 5 aparece como item de checklist).

## Global Constraints

- Node **20 LTS** (`engines.node` `>=20 <21`); gerenciador **pnpm 9** (`packageManager` fixo).
- Todo nome de objeto de banco em **`snake_case`**.
- Toda tabela tem `id uuid` PK com `default gen_random_uuid()`, exceto tabelas cujo PK é FK 1:1 (`usuarios.id → auth.users`, `perfil_prestador.usuario_id`, `disponibilidade_prestador.usuario_id`) e as de PK composta (`prestador_categoria`, `participantes_conversa`).
- Toda tabela tem `created_at timestamptz not null default now()`. Tabelas mutáveis têm também `updated_at timestamptz not null default now()` mantido pelo trigger `public.set_updated_at()`.
- Valores monetários derivados são colunas `GENERATED ALWAYS AS (...) STORED`. **Nunca** aceitar esses valores do cliente. Taxa de plataforma = 20% (`valor * 0.20`); repasse ao prestador = 80%; entrada e final da contratação = 50% cada. Todos com `round(x, 2)`.
- Enums são **tipos enum nativos do Postgres** no schema `public`, não tabelas de lookup.
- **RLS habilitada em todas as tabelas de `public`.** Tabela sem policy = acesso negado para `anon`/`authenticated` (o acesso de servidor usa `service_role`, que ignora RLS).
- Funções `SECURITY DEFINER` sempre com `set search_path = ''` e referências totalmente qualificadas (`public.`, `auth.`).
- Migrations são criadas com `supabase migration new <nome>` (gera o arquivo com timestamp). Este plano referencia cada migration pelo **sufixo** do nome; o timestamp é o que a CLI gerar.
- Cada migration nova tem teste pgTAP correspondente em `supabase/tests/`. Migration ou função sem teste não é considerada pronta.
- Idioma de identificadores de domínio: português (`usuarios`, `demandas_servico`, ...). Rótulos de enum em `MAIÚSCULAS_COM_UNDERSCORE`.

---

## File Structure

Criados neste plano:

- `package.json` — raiz do monorepo; workspaces, scripts `db:*`, devDependency `supabase`.
- `pnpm-workspace.yaml` — declara `apps/*` e `packages/*`.
- `.gitignore` — ignora `node_modules`, `.env*` (menos `.env.example`), `*.p12`, `*.pem`, artefatos Supabase/Expo.
- `.node-version` — `20`.
- `.env.example` — placeholders das variáveis (preenchido de fato no Plano 2; aqui só as do Supabase local).
- `README.md` — como subir o ambiente local.
- `supabase/config.toml` — gerado por `supabase init`.
- `supabase/migrations/<ts>_extensions_e_enums.sql` — extensões (`pgcrypto`, `pgtap`) e todos os enums.
- `supabase/migrations/<ts>_test_helpers.sql` — schema `tests` com funções de apoio a pgTAP.
- `supabase/migrations/<ts>_util_updated_at.sql` — função `public.set_updated_at()`.
- `supabase/migrations/<ts>_identidade.sql` — `usuarios` + trigger `handle_new_user` em `auth.users`.
- `supabase/migrations/<ts>_perfil_prestador.sql` — `perfil_prestador`, `portfolio_prestador`, `disponibilidade_prestador`, `licencas_certificados`.
- `supabase/migrations/<ts>_catalogo.sql` — `categoria_servico` (+ seed), `prestador_categoria`.
- `supabase/migrations/<ts>_enderecos.sql` — `enderecos_usuario`.
- `supabase/migrations/<ts>_demandas.sql` — `demandas_servico`, `tarefas_demanda`.
- `supabase/migrations/<ts>_conversas.sql` — `conversas`, `participantes_conversa`, `mensagens`, `anexos_mensagem`.
- `supabase/migrations/<ts>_propostas.sql` — `propostas` (+ FK `mensagens.proposta_id`).
- `supabase/migrations/<ts>_contratacoes.sql` — `contratacoes`, `pagamentos`.
- `supabase/migrations/<ts>_avaliacoes_notificacoes.sql` — `avaliacoes`, `notificacoes`.
- `supabase/migrations/<ts>_view_perfis_publicos.sql` — view `perfis_publicos`.
- `supabase/migrations/<ts>_fn_rls_helpers.sql` — `public.fn_e_participante`, `public.fn_tem_perfil_prestador`.
- `supabase/migrations/<ts>_rls_enable.sql` — `enable row level security` em todas as tabelas.
- `supabase/migrations/<ts>_rls_publico.sql` — policies das tabelas de leitura pública + escrita pelo dono.
- `supabase/migrations/<ts>_rls_pessoal.sql` — policies de `usuarios`, `enderecos_usuario`, `notificacoes`.
- `supabase/migrations/<ts>_rls_demandas.sql` — policies de `demandas_servico`, `tarefas_demanda`.
- `supabase/migrations/<ts>_rls_conversas.sql` — policies de `conversas`, `participantes_conversa`, `mensagens`, `anexos_mensagem`, `propostas`.
- `supabase/migrations/<ts>_rls_contratacoes.sql` — policies de `contratacoes`, `pagamentos`.
- `supabase/tests/0001_enums.test.sql` … `supabase/tests/0018_rls_contratacoes.test.sql` — um arquivo pgTAP por migration com esquema/policy.
- `packages/db-types/package.json` — pacote `@servico-feito/db-types`.
- `packages/db-types/index.ts` — saída de `supabase gen types typescript` (gerada na Task 20).
- `.github/workflows/ci.yml` — pipeline de banco.

---

## Task 1: Esqueleto do monorepo pnpm

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `.node-version`
- Create: `README.md`

**Interfaces:**
- Consumes: nada.
- Produces: workspace pnpm com o script `pnpm db:types`, `pnpm db:test`, `pnpm db:reset` e a CLI `supabase` disponível via `pnpm supabase ...`.

- [ ] **Step 1: Escrever `.node-version`**

```
20
```

- [ ] **Step 2: Escrever `pnpm-workspace.yaml`**

```yaml
packages:
  - apps/*
  - packages/*
```

- [ ] **Step 3: Escrever `.gitignore`**

```gitignore
# deps
node_modules/

# env / segredos — NUNCA commitar
.env
.env.*
!.env.example
*.p12
*.pem
*.key

# supabase local
supabase/.branches/
supabase/.temp/

# expo (Plano 2)
apps/mobile/.expo/
apps/mobile/dist/

# os
.DS_Store
Thumbs.db
```

- [ ] **Step 4: Escrever `package.json` da raiz**

```json
{
  "name": "servico-feito",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": {
    "node": ">=20 <21"
  },
  "scripts": {
    "supabase": "supabase",
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:test": "supabase test db",
    "db:lint": "supabase db lint --level warning",
    "db:types": "supabase gen types typescript --local > packages/db-types/index.ts",
    "db:new": "supabase migration new"
  },
  "devDependencies": {
    "supabase": "^1.207.9"
  }
}
```

- [ ] **Step 5: Escrever `README.md`**

````markdown
# Serviço Feito — Monorepo

Marketplace de serviços (cliente ↔ prestador). App mobile em React Native + Expo
sobre Supabase. Ver `docs/superpowers/specs/` e `docs/superpowers/plans/`.

## Pré-requisitos

- Node 20 LTS
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- Docker Desktop (para o Supabase local)

## Ambiente local

```bash
pnpm install
pnpm db:start        # sobe Postgres + stack Supabase local
pnpm db:reset        # aplica todas as migrations do zero
pnpm db:test         # roda os testes pgTAP
pnpm db:types        # regenera packages/db-types/index.ts
```

## Estrutura

- `apps/mobile/` — app Expo (Plano 2 em diante)
- `packages/db-types/` — tipos TypeScript gerados do banco
- `supabase/` — migrations, funções, testes (fonte da verdade do esquema)
- `docs/` — specs, planos, arquitetura antiga (Kotlin), regras de negócio
````

- [ ] **Step 6: Instalar dependências**

Run: `pnpm install`
Expected: cria `node_modules/` e `pnpm-lock.yaml`; sai com código 0; `pnpm supabase --version` imprime uma versão `1.x`.

- [ ] **Step 7: Verificar o workspace**

Run: `pnpm -w exec node -e "console.log(require('./package.json').name)"`
Expected: imprime `servico-feito`.

- [ ] **Step 8: Commit**

```bash
git add .node-version pnpm-workspace.yaml .gitignore package.json README.md pnpm-lock.yaml
git commit -m "chore: esqueleto do monorepo pnpm + CLI supabase"
```

---

## Task 2: Inicializar o Supabase local e o harness pgTAP

**Files:**
- Create: `supabase/config.toml` (via `supabase init`)
- Create: `supabase/tests/0000_smoke.test.sql`
- Create: `.env.example`

**Interfaces:**
- Consumes: workspace da Task 1.
- Produces: stack Supabase local funcional; `supabase test db` executa arquivos `supabase/tests/*.sql` como pgTAP.

- [ ] **Step 1: Rodar `supabase init`**

Run: `pnpm supabase init`
Expected: cria `supabase/config.toml` e `supabase/.gitignore`. Se perguntar sobre gerar settings de VS Code / Deno, responder **N**.

- [ ] **Step 2: Escrever `.env.example`**

```dotenv
# Supabase local (valores fixos do `supabase start` — não são segredos)
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<copiar de `pnpm supabase status` apos `pnpm db:start`>

# Projeto dev remoto (preenchido quando o projeto Supabase dev for criado)
SUPABASE_PROJECT_ID_DEV=
```

- [ ] **Step 3: Escrever `supabase/tests/0000_smoke.test.sql`**

```sql
begin;
select plan(1);

select ok(true, 'harness pgTAP está funcionando');

select * from finish();
rollback;
```

- [ ] **Step 4: Subir a stack local**

Run: `pnpm db:start`
Expected: baixa imagens Docker (primeira vez é lento) e imprime as URLs/keys locais. `pnpm supabase status` mostra `API URL: http://127.0.0.1:54321`.

- [ ] **Step 5: Rodar o teste smoke**

Run: `pnpm db:test`
Expected: PASS — `0000_smoke.test.sql .. ok` e `All tests successful`.

- [ ] **Step 6: Commit**

```bash
git add supabase/config.toml supabase/.gitignore supabase/tests/0000_smoke.test.sql .env.example
git commit -m "chore: supabase init + harness pgTAP (teste smoke)"
```

---

## Task 3: Migration — extensões e enums

**Files:**
- Create: `supabase/migrations/<ts>_extensions_e_enums.sql`
- Create: `supabase/tests/0001_enums.test.sql`

**Interfaces:**
- Consumes: harness da Task 2.
- Produces: extensões `pgcrypto` (para `gen_random_uuid()`) e `pgtap`; os 9 tipos enum: `public.status_demanda`, `public.tipo_conversa`, `public.status_conversa`, `public.tipo_mensagem`, `public.status_proposta`, `public.status_contratacao`, `public.tipo_pagamento`, `public.status_pagamento`, `public.tipo_notificacao`.

- [ ] **Step 1: Criar o arquivo da migration**

Run: `pnpm db:new extensions_e_enums`
Expected: cria `supabase/migrations/<ts>_extensions_e_enums.sql` vazio.

- [ ] **Step 2: Escrever o conteúdo da migration**

```sql
-- Extensões
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pgtap with schema extensions;

-- Enums de domínio (rótulos em MAIÚSCULAS_COM_UNDERSCORE)
create type public.status_demanda as enum
  ('ABERTA', 'EM_NEGOCIACAO', 'CONTRATADA', 'FINALIZADA', 'CANCELADA');

create type public.tipo_conversa as enum
  ('DEMANDA', 'DIRETA');

create type public.status_conversa as enum
  ('ATIVA', 'ENCERRADA', 'BLOQUEADA');

create type public.tipo_mensagem as enum
  ('TEXTO', 'AUDIO', 'VIDEO', 'FOTO', 'LOCALIZACAO',
   'PROPOSTA', 'CONTRATO_GERADO', 'PAGAMENTO_CONFIRMADO', 'SISTEMA');

create type public.status_proposta as enum
  ('ENVIADA', 'VISUALIZADA', 'ACEITA', 'RECUSADA', 'CANCELADA', 'EXPIRADA');

create type public.status_contratacao as enum
  ('AGUARDANDO_PAGAMENTO', 'AGENDADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');

create type public.tipo_pagamento as enum
  ('ENTRADA', 'FINAL');

create type public.status_pagamento as enum
  ('PENDENTE', 'PROCESSANDO', 'PAGO', 'CANCELADO', 'EXPIRADO');

create type public.tipo_notificacao as enum
  ('PROPOSTA', 'PAGAMENTO', 'MENSAGEM', 'CONTRATACAO', 'AVALIACAO');
```

- [ ] **Step 3: Escrever o teste `supabase/tests/0001_enums.test.sql`**

```sql
begin;
select plan(11);

select has_type('public', 'status_demanda', 'enum status_demanda existe');
select has_type('public', 'tipo_conversa', 'enum tipo_conversa existe');
select has_type('public', 'status_conversa', 'enum status_conversa existe');
select has_type('public', 'tipo_mensagem', 'enum tipo_mensagem existe');
select has_type('public', 'status_proposta', 'enum status_proposta existe');
select has_type('public', 'status_contratacao', 'enum status_contratacao existe');
select has_type('public', 'tipo_pagamento', 'enum tipo_pagamento existe');
select has_type('public', 'status_pagamento', 'enum status_pagamento existe');
select has_type('public', 'tipo_notificacao', 'enum tipo_notificacao existe');

select enum_has_labels(
  'public', 'status_contratacao',
  array['AGUARDANDO_PAGAMENTO', 'AGENDADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA'],
  'status_contratacao com os 5 rótulos na ordem'
);

select enum_has_labels(
  'public', 'status_pagamento',
  array['PENDENTE', 'PROCESSANDO', 'PAGO', 'CANCELADO', 'EXPIRADO'],
  'status_pagamento com os 5 rótulos na ordem'
);

select * from finish();
rollback;
```

- [ ] **Step 4: Aplicar e testar**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `0001_enums.test.sql` com 11 asserts ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/0001_enums.test.sql
git commit -m "feat(db): extensões pgcrypto/pgtap e enums de domínio"
```

---

## Task 4: Migration — schema `tests` (apoio a pgTAP)

**Files:**
- Create: `supabase/migrations/<ts>_test_helpers.sql`
- Create: `supabase/tests/0002_test_helpers.test.sql`

**Interfaces:**
- Consumes: enums da Task 3 (só a ordenação; helpers não dependem de enum).
- Produces:
  - `tests.create_supabase_user(identifier text) returns uuid` — cria linha em `auth.users` com email `<identifier>@test.local`.
  - `tests.get_supabase_uid(identifier text) returns uuid`.
  - `tests.authenticate_as(identifier text) returns void` — define `role` = `authenticated` e `request.jwt.claims` com `sub` do usuário (transação-local).
  - `tests.clear_authentication() returns void`.
  - `tests.rls_enabled(schema_name text, table_name text) returns boolean`.

- [ ] **Step 1: Criar o arquivo**

Run: `pnpm db:new test_helpers`

- [ ] **Step 2: Escrever o conteúdo**

```sql
-- Schema de apoio a testes pgTAP.
-- Enviado a todos os ambientes, mas com EXECUTE revogado de anon/authenticated.
-- TODO(release-prod): mover para mecanismo local-only quando houver deploy de prod.
create schema if not exists tests;

create or replace function tests.create_supabase_user(identifier text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := extensions.gen_random_uuid();
begin
  insert into auth.users (id, email, aud, role, raw_user_meta_data)
  values (v_id, identifier || '@test.local', 'authenticated', 'authenticated',
          json_build_object('identifier', identifier))
  on conflict (email) do nothing;
  return (select id from auth.users where email = identifier || '@test.local' limit 1);
end;
$$;

create or replace function tests.get_supabase_uid(identifier text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select id from auth.users where email = identifier || '@test.local' limit 1;
$$;

create or replace function tests.authenticate_as(identifier text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where email = identifier || '@test.local' limit 1;
  if v_id is null then
    raise exception 'usuário de teste "%" não existe (chame tests.create_supabase_user primeiro)', identifier;
  end if;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_id::text, 'role', 'authenticated',
                      'email', identifier || '@test.local')::text,
    true);
end;
$$;

create or replace function tests.clear_authentication()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', null, true);
end;
$$;

create or replace function tests.rls_enabled(schema_name text, table_name text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select coalesce(bool_and(c.relrowsecurity), false)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = schema_name and c.relname = table_name;
$$;

revoke all on schema tests from anon, authenticated;
revoke all on all functions in schema tests from anon, authenticated;
```

- [ ] **Step 3: Escrever `supabase/tests/0002_test_helpers.test.sql`**

```sql
begin;
select plan(4);

select lives_ok(
  $$ select tests.create_supabase_user('helper_a') $$,
  'create_supabase_user roda sem erro'
);

select isnt(
  tests.get_supabase_uid('helper_a'), null,
  'get_supabase_uid devolve o uuid do usuário criado'
);

select tests.authenticate_as('helper_a');
select is(
  current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
  tests.get_supabase_uid('helper_a')::text,
  'authenticate_as coloca o sub certo nas claims'
);

reset role;
select tests.clear_authentication();
select is(
  current_setting('request.jwt.claims', true),
  null,
  'clear_authentication limpa as claims'
);

select * from finish();
rollback;
```

- [ ] **Step 4: Aplicar e testar**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `0002_test_helpers.test.sql` com 4 asserts ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/0002_test_helpers.test.sql
git commit -m "test(db): schema tests com helpers de autenticação para pgTAP"
```

---

## Task 5: Migration — utilitário `set_updated_at`

**Files:**
- Create: `supabase/migrations/<ts>_util_updated_at.sql`
- Create: `supabase/tests/0003_util_updated_at.test.sql`

**Interfaces:**
- Consumes: nada.
- Produces: `public.set_updated_at() returns trigger` — trigger `BEFORE UPDATE` que faz `new.updated_at = now()`.

- [ ] **Step 1: Criar o arquivo**

Run: `pnpm db:new util_updated_at`

- [ ] **Step 2: Escrever o conteúdo**

```sql
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger BEFORE UPDATE: mantém a coluna updated_at. Usar em toda tabela mutável.';
```

- [ ] **Step 3: Escrever `supabase/tests/0003_util_updated_at.test.sql`**

```sql
begin;
select plan(2);

select has_function('public', 'set_updated_at', 'função set_updated_at existe');

-- tabela efêmera só para exercitar o trigger
create table public._tmp_updated_at (
  id int primary key,
  updated_at timestamptz not null default now()
);
create trigger _tmp_set_updated_at before update on public._tmp_updated_at
  for each row execute function public.set_updated_at();

insert into public._tmp_updated_at (id) values (1);
update public._tmp_updated_at set id = 1 where id = 1;

select ok(
  (select updated_at from public._tmp_updated_at where id = 1) >= now() - interval '5 seconds',
  'update mexe em updated_at via trigger'
);

drop table public._tmp_updated_at;

select * from finish();
rollback;
```

- [ ] **Step 4: Aplicar e testar**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `0003_util_updated_at.test.sql` com 2 asserts ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/0003_util_updated_at.test.sql
git commit -m "feat(db): função de trigger set_updated_at"
```

---

## Task 6: Migration — identidade (`usuarios` + trigger de novo usuário)

**Files:**
- Create: `supabase/migrations/<ts>_identidade.sql`
- Create: `supabase/tests/0004_identidade.test.sql`

**Interfaces:**
- Consumes: `public.set_updated_at()` (Task 5).
- Produces:
  - Tabela `public.usuarios` (PK `id uuid → auth.users(id)`), colunas: `nome text`, `telefone text`, `cidade text`, `bairro text`, `avatar_cor_hex text default '#4DAF50'`, `foto_perfil_url text`, `status_conta text not null default 'Ativa'`, `rating_cliente numeric(3,2) not null default 5.0`, `total_contratacoes_cliente int not null default 0`, `created_at`, `updated_at`.
  - `public.handle_new_user() returns trigger` — trigger `AFTER INSERT ON auth.users` que insere `public.usuarios (id)`.

- [ ] **Step 1: Criar o arquivo**

Run: `pnpm db:new identidade`

- [ ] **Step 2: Escrever o conteúdo**

```sql
create table public.usuarios (
  id                        uuid primary key references auth.users (id) on delete cascade,
  nome                      text,
  telefone                  text,
  cidade                    text,
  bairro                    text,
  avatar_cor_hex            text not null default '#4DAF50',
  foto_perfil_url           text,
  status_conta              text not null default 'Ativa',
  rating_cliente            numeric(3,2) not null default 5.0,
  total_contratacoes_cliente integer not null default 0,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

comment on table public.usuarios is 'Perfil base do usuário (1:1 com auth.users). RB01: conta unificada.';

create trigger usuarios_set_updated_at before update on public.usuarios
  for each row execute function public.set_updated_at();

-- Cria a linha base em public.usuarios quando um auth.users nasce.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usuarios (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 3: Escrever `supabase/tests/0004_identidade.test.sql`**

```sql
begin;
select plan(4);

select has_table('public', 'usuarios', 'tabela usuarios existe');
select col_default_is('public', 'usuarios', 'status_conta', 'Ativa', 'status_conta default Ativa');
select hasnt_column('public', 'usuarios', 'senha', 'usuarios NÃO tem coluna senha');

-- o trigger em auth.users deve materializar uma linha em public.usuarios
select tests.create_supabase_user('ident_a');
select is(
  (select count(*)::int from public.usuarios where id = tests.get_supabase_uid('ident_a')),
  1,
  'inserir em auth.users cria linha em public.usuarios'
);

select * from finish();
rollback;
```

- [ ] **Step 4: Aplicar e testar**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `0004_identidade.test.sql` com 4 asserts ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/0004_identidade.test.sql
git commit -m "feat(db): tabela usuarios e trigger handle_new_user"
```

---

## Task 7: Migration — perfil de prestador e extensões de perfil

**Files:**
- Create: `supabase/migrations/<ts>_perfil_prestador.sql`
- Create: `supabase/tests/0005_perfil_prestador.test.sql`

**Interfaces:**
- Consumes: `public.usuarios` (Task 6), `public.set_updated_at()` (Task 5).
- Produces:
  - `public.perfil_prestador` (PK `usuario_id → usuarios(id)`), colunas: `titulo_profissional text`, `bio text`, `cnpj_mei text`, `tem_mei boolean not null default false`, `verificado boolean not null default false`, `documento_verificado boolean not null default false`, `selo_fundador boolean not null default false`, `preco_base numeric(10,2) not null default 0`, `tempo_experiencia text`, `rating numeric(3,2) not null default 0`, `total_avaliacoes int not null default 0`, `total_servicos int not null default 0`, `disponivel boolean not null default true`, `raio_km int not null default 25`, `chave_pix text`, `created_at`, `updated_at`.
  - `public.portfolio_prestador` (`id`, `prestador_id → perfil_prestador(usuario_id)`, `url_media text not null`, `created_at`).
  - `public.disponibilidade_prestador` (PK `usuario_id → perfil_prestador(usuario_id)`, `seg`..`dom boolean`, `updated_at`).
  - `public.licencas_certificados` (`id`, `usuario_id → usuarios(id)`, `titulo text not null`, `instituicao text`, `data_inicio text`, `data_fim text`, `url_imagem text`, `cod_credencial text`, `created_at`).

- [ ] **Step 1: Criar o arquivo**

Run: `pnpm db:new perfil_prestador`

- [ ] **Step 2: Escrever o conteúdo**

```sql
create table public.perfil_prestador (
  usuario_id          uuid primary key references public.usuarios (id) on delete cascade,
  titulo_profissional text,
  bio                 text,
  cnpj_mei            text,
  tem_mei             boolean not null default false,
  verificado          boolean not null default false,
  documento_verificado boolean not null default false,
  selo_fundador       boolean not null default false,
  preco_base          numeric(10,2) not null default 0,
  tempo_experiencia   text,
  rating              numeric(3,2) not null default 0,
  total_avaliacoes    integer not null default 0,
  total_servicos      integer not null default 0,
  disponivel          boolean not null default true,
  raio_km             integer not null default 25,
  chave_pix           text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table public.perfil_prestador is
  'Presença da linha = o usuário atua como prestador (RB01/RB11).';
create trigger perfil_prestador_set_updated_at before update on public.perfil_prestador
  for each row execute function public.set_updated_at();

create table public.portfolio_prestador (
  id           uuid primary key default gen_random_uuid(),
  prestador_id uuid not null references public.perfil_prestador (usuario_id) on delete cascade,
  url_media    text not null,
  created_at   timestamptz not null default now()
);
create index portfolio_prestador_prestador_id_idx on public.portfolio_prestador (prestador_id);

create table public.disponibilidade_prestador (
  usuario_id uuid primary key references public.perfil_prestador (usuario_id) on delete cascade,
  seg        boolean not null default true,
  ter        boolean not null default true,
  qua        boolean not null default true,
  qui        boolean not null default true,
  sex        boolean not null default true,
  sab        boolean not null default false,
  dom        boolean not null default false,
  updated_at timestamptz not null default now()
);
create trigger disponibilidade_prestador_set_updated_at before update on public.disponibilidade_prestador
  for each row execute function public.set_updated_at();

create table public.licencas_certificados (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references public.usuarios (id) on delete cascade,
  titulo        text not null,
  instituicao   text,
  data_inicio   text,
  data_fim      text,
  url_imagem    text,
  cod_credencial text,
  created_at    timestamptz not null default now()
);
create index licencas_certificados_usuario_id_idx on public.licencas_certificados (usuario_id);
```

- [ ] **Step 3: Escrever `supabase/tests/0005_perfil_prestador.test.sql`**

```sql
begin;
select plan(5);

select has_table('public', 'perfil_prestador', 'tabela perfil_prestador existe');
select has_table('public', 'portfolio_prestador', 'tabela portfolio_prestador existe');
select has_table('public', 'disponibilidade_prestador', 'tabela disponibilidade_prestador existe');
select has_table('public', 'licencas_certificados', 'tabela licencas_certificados existe');

-- CASCADE: apagar o usuário apaga o perfil
select tests.create_supabase_user('prest_a');
insert into public.perfil_prestador (usuario_id) values (tests.get_supabase_uid('prest_a'));
delete from auth.users where id = tests.get_supabase_uid('prest_a');
select is(
  (select count(*)::int from public.perfil_prestador where usuario_id = tests.get_supabase_uid('prest_a')),
  0,
  'apagar auth.users faz cascade até perfil_prestador'
);

select * from finish();
rollback;
```

- [ ] **Step 4: Aplicar e testar**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `0005_perfil_prestador.test.sql` com 5 asserts ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/0005_perfil_prestador.test.sql
git commit -m "feat(db): perfil_prestador, portfolio, disponibilidade e certificados"
```

---

## Task 8: Migration — catálogo de categorias

**Files:**
- Create: `supabase/migrations/<ts>_catalogo.sql`
- Create: `supabase/tests/0006_catalogo.test.sql`

**Interfaces:**
- Consumes: `public.perfil_prestador` (Task 7).
- Produces:
  - `public.categoria_servico` (`id`, `nome text not null unique`, `descricao text`, `icone_key text not null`, `preco_medio_hora numeric(10,2) not null default 0`, `popular boolean not null default false`, `created_at`) — semeada com 9 categorias.
  - `public.prestador_categoria` (PK composta `(prestador_id, categoria_id)`; `prestador_id → perfil_prestador(usuario_id)`, `categoria_id → categoria_servico(id)`).

- [ ] **Step 1: Criar o arquivo**

Run: `pnpm db:new catalogo`

- [ ] **Step 2: Escrever o conteúdo**

```sql
create table public.categoria_servico (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null unique,
  descricao        text,
  icone_key        text not null,
  preco_medio_hora numeric(10,2) not null default 0,
  popular          boolean not null default false,
  created_at       timestamptz not null default now()
);

insert into public.categoria_servico (nome, descricao, icone_key, preco_medio_hora, popular) values
  ('Limpeza',        'Diaristas, faxina e limpeza pós-obra',        'cleaning',         50, true),
  ('Elétrica',       'Instalações e reparos elétricos',            'electrical',       90, true),
  ('Pintura',        'Pintura residencial e comercial',            'paint',            70, true),
  ('Alvenaria',      'Pedreiro, reformas e pequenos reparos',      'masonry',          80, true),
  ('Jardinagem',     'Poda, corte de grama e paisagismo',          'garden',           45, false),
  ('Mecânica',       'Serviços automotivos',                       'mechanic',        100, false),
  ('Encanamento',    'Hidráulica e desentupimento',               'plumbing',         85, true),
  ('Marcenaria',     'Móveis planejados e reparos em madeira',     'carpentry',        95, false),
  ('Ar-condicionado','Instalação e limpeza de ar-condicionado',    'air_conditioning',120, false);

create table public.prestador_categoria (
  prestador_id uuid not null references public.perfil_prestador (usuario_id) on delete cascade,
  categoria_id uuid not null references public.categoria_servico (id) on delete cascade,
  primary key (prestador_id, categoria_id)
);
create index prestador_categoria_categoria_id_idx on public.prestador_categoria (categoria_id);
```

- [ ] **Step 3: Escrever `supabase/tests/0006_catalogo.test.sql`**

```sql
begin;
select plan(4);

select has_table('public', 'categoria_servico', 'tabela categoria_servico existe');
select is(
  (select count(*)::int from public.categoria_servico),
  9,
  'seed cria 9 categorias'
);
select is(
  (select count(*)::int from public.categoria_servico where nome is null),
  0,
  'nenhuma categoria com nome nulo'
);

-- PK composta impede duplicar o par prestador/categoria
select tests.create_supabase_user('cat_prest');
insert into public.perfil_prestador (usuario_id) values (tests.get_supabase_uid('cat_prest'));
insert into public.prestador_categoria (prestador_id, categoria_id)
  select tests.get_supabase_uid('cat_prest'), id from public.categoria_servico where nome = 'Limpeza';
select throws_ok(
  $$ insert into public.prestador_categoria (prestador_id, categoria_id)
     select tests.get_supabase_uid('cat_prest'), id from public.categoria_servico where nome = 'Limpeza' $$,
  '23505',
  null,
  'par prestador/categoria duplicado viola a PK composta'
);

select * from finish();
rollback;
```

- [ ] **Step 4: Aplicar e testar**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `0006_catalogo.test.sql` com 4 asserts ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/0006_catalogo.test.sql
git commit -m "feat(db): categoria_servico (seed) e prestador_categoria"
```

---

## Task 9: Migration — endereços do usuário

**Files:**
- Create: `supabase/migrations/<ts>_enderecos.sql`
- Create: `supabase/tests/0007_enderecos.test.sql`

**Interfaces:**
- Consumes: `public.usuarios` (Task 6), `public.set_updated_at()` (Task 5).
- Produces: `public.enderecos_usuario` (`id`, `usuario_id → usuarios(id)`, `identificacao text`, `cep text`, `estado text`, `cidade text`, `bairro text`, `logradouro text`, `numero text`, `complemento text`, `principal boolean not null default false`, `created_at`, `updated_at`).

- [ ] **Step 1: Criar o arquivo**

Run: `pnpm db:new enderecos`

- [ ] **Step 2: Escrever o conteúdo**

```sql
create table public.enderecos_usuario (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references public.usuarios (id) on delete cascade,
  identificacao text,
  cep           text,
  estado        text,
  cidade        text,
  bairro        text,
  logradouro    text,
  numero        text,
  complemento   text,
  principal     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index enderecos_usuario_usuario_id_idx on public.enderecos_usuario (usuario_id);
create trigger enderecos_usuario_set_updated_at before update on public.enderecos_usuario
  for each row execute function public.set_updated_at();
```

- [ ] **Step 3: Escrever `supabase/tests/0007_enderecos.test.sql`**

```sql
begin;
select plan(2);

select has_table('public', 'enderecos_usuario', 'tabela enderecos_usuario existe');
select col_default_is('public', 'enderecos_usuario', 'principal', 'false', 'principal default false');

select * from finish();
rollback;
```

- [ ] **Step 4: Aplicar e testar**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `0007_enderecos.test.sql` com 2 asserts ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/0007_enderecos.test.sql
git commit -m "feat(db): enderecos_usuario"
```

---

## Task 10: Migration — demandas e tarefas

**Files:**
- Create: `supabase/migrations/<ts>_demandas.sql`
- Create: `supabase/tests/0008_demandas.test.sql`

**Interfaces:**
- Consumes: `public.usuarios` (Task 6), `public.categoria_servico` (Task 8), enum `public.status_demanda` (Task 3), `public.set_updated_at()` (Task 5).
- Produces:
  - `public.demandas_servico` (`id`, `cliente_id → usuarios(id)`, `categoria_id → categoria_servico(id)`, `titulo text not null`, `descricao text not null`, `endereco_cidade text`, `endereco_bairro text`, `endereco_completo text`, `orcamento_maximo numeric(10,2)`, `data_desejada text`, `urgencia text not null default 'Normal'`, `status public.status_demanda not null default 'ABERTA'`, `total_propostas int not null default 0`, `created_at`, `updated_at`).
  - `public.tarefas_demanda` (`id`, `demanda_id → demandas_servico(id)`, `nome_tarefa text not null`, `descricao text`, `concluida boolean not null default false`, `created_at`).

- [ ] **Step 1: Criar o arquivo**

Run: `pnpm db:new demandas`

- [ ] **Step 2: Escrever o conteúdo**

```sql
create table public.demandas_servico (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid not null references public.usuarios (id) on delete cascade,
  categoria_id      uuid not null references public.categoria_servico (id),
  titulo            text not null,
  descricao         text not null,
  endereco_cidade   text,
  endereco_bairro   text,
  endereco_completo text,
  orcamento_maximo  numeric(10,2),
  data_desejada     text,
  urgencia          text not null default 'Normal',
  status            public.status_demanda not null default 'ABERTA',
  total_propostas   integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index demandas_servico_cliente_id_idx on public.demandas_servico (cliente_id);
create index demandas_servico_status_idx on public.demandas_servico (status);
create trigger demandas_servico_set_updated_at before update on public.demandas_servico
  for each row execute function public.set_updated_at();

create table public.tarefas_demanda (
  id          uuid primary key default gen_random_uuid(),
  demanda_id  uuid not null references public.demandas_servico (id) on delete cascade,
  nome_tarefa text not null,
  descricao   text,
  concluida   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index tarefas_demanda_demanda_id_idx on public.tarefas_demanda (demanda_id);
```

- [ ] **Step 3: Escrever `supabase/tests/0008_demandas.test.sql`**

```sql
begin;
select plan(3);

select has_table('public', 'demandas_servico', 'tabela demandas_servico existe');
select has_table('public', 'tarefas_demanda', 'tabela tarefas_demanda existe');

select tests.create_supabase_user('dem_cli');
insert into public.demandas_servico (cliente_id, categoria_id, titulo, descricao)
select tests.get_supabase_uid('dem_cli'), id, 'Trocar tomadas', 'Trocar 4 tomadas na sala'
from public.categoria_servico where nome = 'Elétrica';
select is(
  (select status::text from public.demandas_servico where cliente_id = tests.get_supabase_uid('dem_cli')),
  'ABERTA',
  'demanda nasce com status ABERTA'
);

select * from finish();
rollback;
```

- [ ] **Step 4: Aplicar e testar**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `0008_demandas.test.sql` com 3 asserts ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/0008_demandas.test.sql
git commit -m "feat(db): demandas_servico e tarefas_demanda"
```

---

## Task 11: Migration — conversas, participantes, mensagens, anexos

**Files:**
- Create: `supabase/migrations/<ts>_conversas.sql`
- Create: `supabase/tests/0009_conversas.test.sql`

**Interfaces:**
- Consumes: `public.usuarios` (Task 6), `public.demandas_servico` (Task 10), enums `tipo_conversa`, `status_conversa`, `tipo_mensagem` (Task 3), `public.set_updated_at()` (Task 5).
- Produces:
  - `public.conversas` (`id`, `tipo public.tipo_conversa not null`, `demanda_id → demandas_servico(id) on delete set null` (nullable), `cliente_id → usuarios(id)`, `prestador_id → usuarios(id)`, `status public.status_conversa not null default 'ATIVA'`, `ultima_mensagem text`, `data_ultima_mensagem timestamptz`, `nao_lidas_cliente int not null default 0`, `nao_lidas_prestador int not null default 0`, `created_at`, `updated_at`; check `tipo = 'DIRETA' or demanda_id is not null`).
  - `public.participantes_conversa` (PK composta `(conversa_id, usuario_id)`; `conversa_id → conversas(id)`, `usuario_id → usuarios(id)`, `papel text not null check (papel in ('CLIENTE','PRESTADOR'))`).
  - `public.mensagens` (`id`, `conversa_id → conversas(id)`, `remetente_id → usuarios(id)`, `tipo public.tipo_mensagem not null default 'TEXTO'`, `corpo text not null default ''`, `proposta_id uuid` (FK adicionada na Task 12), `lida boolean not null default false`, `created_at`).
  - `public.anexos_mensagem` (`id`, `mensagem_id → mensagens(id)`, `url text not null`, `nome_arquivo text`, `tipo_arquivo text`, `tamanho bigint not null default 0`, `created_at`).

- [ ] **Step 1: Criar o arquivo**

Run: `pnpm db:new conversas`

- [ ] **Step 2: Escrever o conteúdo**

```sql
create table public.conversas (
  id                   uuid primary key default gen_random_uuid(),
  tipo                 public.tipo_conversa not null,
  demanda_id           uuid references public.demandas_servico (id) on delete set null,
  cliente_id           uuid not null references public.usuarios (id) on delete cascade,
  prestador_id         uuid not null references public.usuarios (id) on delete cascade,
  status               public.status_conversa not null default 'ATIVA',
  ultima_mensagem      text,
  data_ultima_mensagem timestamptz,
  nao_lidas_cliente    integer not null default 0,
  nao_lidas_prestador  integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint conversas_demanda_obrigatoria_quando_tipo_demanda
    check (tipo = 'DIRETA' or demanda_id is not null)
);
create index conversas_cliente_id_idx on public.conversas (cliente_id);
create index conversas_prestador_id_idx on public.conversas (prestador_id);
create index conversas_demanda_id_idx on public.conversas (demanda_id);
create trigger conversas_set_updated_at before update on public.conversas
  for each row execute function public.set_updated_at();

create table public.participantes_conversa (
  conversa_id uuid not null references public.conversas (id) on delete cascade,
  usuario_id  uuid not null references public.usuarios (id) on delete cascade,
  papel       text not null check (papel in ('CLIENTE', 'PRESTADOR')),
  primary key (conversa_id, usuario_id)
);
create index participantes_conversa_usuario_id_idx on public.participantes_conversa (usuario_id);

create table public.mensagens (
  id           uuid primary key default gen_random_uuid(),
  conversa_id  uuid not null references public.conversas (id) on delete cascade,
  remetente_id uuid not null references public.usuarios (id) on delete cascade,
  tipo         public.tipo_mensagem not null default 'TEXTO',
  corpo        text not null default '',
  proposta_id  uuid,
  lida         boolean not null default false,
  created_at   timestamptz not null default now()
);
create index mensagens_conversa_id_created_at_idx on public.mensagens (conversa_id, created_at);

create table public.anexos_mensagem (
  id           uuid primary key default gen_random_uuid(),
  mensagem_id  uuid not null references public.mensagens (id) on delete cascade,
  url          text not null,
  nome_arquivo text,
  tipo_arquivo text,
  tamanho      bigint not null default 0,
  created_at   timestamptz not null default now()
);
create index anexos_mensagem_mensagem_id_idx on public.anexos_mensagem (mensagem_id);
```

- [ ] **Step 3: Escrever `supabase/tests/0009_conversas.test.sql`**

```sql
begin;
select plan(4);

select has_table('public', 'conversas', 'tabela conversas existe');
select has_table('public', 'participantes_conversa', 'tabela participantes_conversa existe');
select has_table('public', 'mensagens', 'tabela mensagens existe');

-- check constraint: tipo DEMANDA exige demanda_id
select tests.create_supabase_user('conv_cli');
select tests.create_supabase_user('conv_pre');
select throws_ok(
  format(
    $$ insert into public.conversas (tipo, cliente_id, prestador_id)
       values ('DEMANDA', %L, %L) $$,
    tests.get_supabase_uid('conv_cli'), tests.get_supabase_uid('conv_pre')
  ),
  '23514',
  null,
  'conversa DEMANDA sem demanda_id viola a check constraint'
);

select * from finish();
rollback;
```

- [ ] **Step 4: Aplicar e testar**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `0009_conversas.test.sql` com 4 asserts ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/0009_conversas.test.sql
git commit -m "feat(db): conversas, participantes_conversa, mensagens e anexos"
```

---

## Task 12: Migration — propostas (colunas geradas 20/80)

**Files:**
- Create: `supabase/migrations/<ts>_propostas.sql`
- Create: `supabase/tests/0010_propostas.test.sql`

**Interfaces:**
- Consumes: `public.demandas_servico` (Task 10), `public.usuarios` (Task 6), `public.conversas` (Task 11), `public.mensagens` (Task 11), enum `public.status_proposta` (Task 3), `public.set_updated_at()` (Task 5).
- Produces:
  - `public.propostas` (`id`, `demanda_id → demandas_servico(id) on delete set null` (nullable), `prestador_id → usuarios(id)`, `cliente_id → usuarios(id)`, `conversa_id → conversas(id)`, `valor numeric(10,2) not null check (valor >= 0)`, `taxa_plataforma numeric(10,2) GENERATED ALWAYS AS (round(valor * 0.20, 2)) STORED`, `valor_liquido_prestador numeric(10,2) GENERATED ALWAYS AS (round(valor * 0.80, 2)) STORED`, `descricao text not null default ''`, `prazo_execucao text`, `validade_dias int not null default 7`, `status public.status_proposta not null default 'ENVIADA'`, `tarefas_ids text`, `created_at`, `updated_at`).
  - FK `public.mensagens.proposta_id → public.propostas(id) on delete set null`.

- [ ] **Step 1: Criar o arquivo**

Run: `pnpm db:new propostas`

- [ ] **Step 2: Escrever o conteúdo**

```sql
create table public.propostas (
  id                      uuid primary key default gen_random_uuid(),
  demanda_id              uuid references public.demandas_servico (id) on delete set null,
  prestador_id            uuid not null references public.usuarios (id) on delete cascade,
  cliente_id              uuid not null references public.usuarios (id) on delete cascade,
  conversa_id             uuid not null references public.conversas (id) on delete cascade,
  valor                   numeric(10,2) not null check (valor >= 0),
  taxa_plataforma         numeric(10,2) generated always as (round(valor * 0.20, 2)) stored,
  valor_liquido_prestador numeric(10,2) generated always as (round(valor * 0.80, 2)) stored,
  descricao               text not null default '',
  prazo_execucao          text,
  validade_dias           integer not null default 7,
  status                  public.status_proposta not null default 'ENVIADA',
  tarefas_ids             text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index propostas_conversa_id_idx on public.propostas (conversa_id);
create index propostas_demanda_id_idx on public.propostas (demanda_id);
create trigger propostas_set_updated_at before update on public.propostas
  for each row execute function public.set_updated_at();

alter table public.mensagens
  add constraint mensagens_proposta_id_fkey
  foreign key (proposta_id) references public.propostas (id) on delete set null;
```

- [ ] **Step 3: Escrever `supabase/tests/0010_propostas.test.sql`**

```sql
begin;
select plan(3);

select has_table('public', 'propostas', 'tabela propostas existe');

select tests.create_supabase_user('prop_cli');
select tests.create_supabase_user('prop_pre');
insert into public.conversas (id, tipo, cliente_id, prestador_id)
values ('aaaaaaaa-0000-0000-0000-000000000010', 'DIRETA',
        tests.get_supabase_uid('prop_cli'), tests.get_supabase_uid('prop_pre'));
insert into public.propostas (conversa_id, prestador_id, cliente_id, valor)
values ('aaaaaaaa-0000-0000-0000-000000000010',
        tests.get_supabase_uid('prop_pre'), tests.get_supabase_uid('prop_cli'), 100.00);

select is(
  (select taxa_plataforma from public.propostas
   where conversa_id = 'aaaaaaaa-0000-0000-0000-000000000010'),
  20.00::numeric,
  'taxa_plataforma = 20% de 100'
);
select is(
  (select valor_liquido_prestador from public.propostas
   where conversa_id = 'aaaaaaaa-0000-0000-0000-000000000010'),
  80.00::numeric,
  'valor_liquido_prestador = 80% de 100'
);

select * from finish();
rollback;
```

- [ ] **Step 4: Aplicar e testar**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `0010_propostas.test.sql` com 3 asserts ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/0010_propostas.test.sql
git commit -m "feat(db): propostas com colunas geradas 20/80"
```

---

## Task 13: Migration — contratações e pagamentos (colunas geradas 50/50/20)

**Files:**
- Create: `supabase/migrations/<ts>_contratacoes.sql`
- Create: `supabase/tests/0011_contratacoes.test.sql`

**Interfaces:**
- Consumes: `public.propostas` (Task 12), `public.demandas_servico` (Task 10), `public.usuarios` (Task 6), enums `status_contratacao`, `tipo_pagamento`, `status_pagamento` (Task 3), `public.set_updated_at()` (Task 5).
- Produces:
  - `public.contratacoes` (`id`, `demanda_id → demandas_servico(id) on delete set null` (nullable), `proposta_id → propostas(id) on delete restrict` **unique**, `titulo_servico text not null`, `cliente_id → usuarios(id)`, `prestador_id → usuarios(id)`, `valor_total numeric(10,2) not null check (valor_total >= 0)`, `valor_entrada numeric(10,2) GENERATED ALWAYS AS (round(valor_total * 0.50, 2)) STORED`, `valor_final numeric(10,2) GENERATED ALWAYS AS (round(valor_total * 0.50, 2)) STORED`, `taxa_plataforma numeric(10,2) GENERATED ALWAYS AS (round(valor_total * 0.20, 2)) STORED`, `status public.status_contratacao not null default 'AGUARDANDO_PAGAMENTO'`, `entrada_paga boolean not null default false`, `final_pago boolean not null default false`, `avaliado boolean not null default false`, `data_agendada text`, `data_conclusao timestamptz`, `created_at`, `updated_at`).
  - `public.pagamentos` (`id`, `contratacao_id → contratacoes(id)`, `valor numeric(10,2) not null check (valor >= 0)`, `tipo public.tipo_pagamento not null`, `status public.status_pagamento not null default 'PENDENTE'`, `gateway text not null default 'EFI_PIX'`, `txid text unique`, `efi_loc_id bigint`, `pix_copia_cola text`, `qr_code_base64 text`, `data_pagamento timestamptz`, `created_at`, `updated_at`; `unique (contratacao_id, tipo)`).

- [ ] **Step 1: Criar o arquivo**

Run: `pnpm db:new contratacoes`

- [ ] **Step 2: Escrever o conteúdo**

```sql
create table public.contratacoes (
  id             uuid primary key default gen_random_uuid(),
  demanda_id     uuid references public.demandas_servico (id) on delete set null,
  proposta_id    uuid not null unique references public.propostas (id) on delete restrict,
  titulo_servico text not null,
  cliente_id     uuid not null references public.usuarios (id) on delete cascade,
  prestador_id   uuid not null references public.usuarios (id) on delete cascade,
  valor_total    numeric(10,2) not null check (valor_total >= 0),
  valor_entrada  numeric(10,2) generated always as (round(valor_total * 0.50, 2)) stored,
  valor_final    numeric(10,2) generated always as (round(valor_total * 0.50, 2)) stored,
  taxa_plataforma numeric(10,2) generated always as (round(valor_total * 0.20, 2)) stored,
  status         public.status_contratacao not null default 'AGUARDANDO_PAGAMENTO',
  entrada_paga   boolean not null default false,
  final_pago     boolean not null default false,
  avaliado       boolean not null default false,
  data_agendada  text,
  data_conclusao timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index contratacoes_cliente_id_idx on public.contratacoes (cliente_id);
create index contratacoes_prestador_id_idx on public.contratacoes (prestador_id);
create trigger contratacoes_set_updated_at before update on public.contratacoes
  for each row execute function public.set_updated_at();

create table public.pagamentos (
  id             uuid primary key default gen_random_uuid(),
  contratacao_id uuid not null references public.contratacoes (id) on delete cascade,
  valor          numeric(10,2) not null check (valor >= 0),
  tipo           public.tipo_pagamento not null,
  status         public.status_pagamento not null default 'PENDENTE',
  gateway        text not null default 'EFI_PIX',
  txid           text unique,
  efi_loc_id     bigint,
  pix_copia_cola text,
  qr_code_base64 text,
  data_pagamento timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (contratacao_id, tipo)
);
create index pagamentos_contratacao_id_idx on public.pagamentos (contratacao_id);
create trigger pagamentos_set_updated_at before update on public.pagamentos
  for each row execute function public.set_updated_at();
```

- [ ] **Step 3: Escrever `supabase/tests/0011_contratacoes.test.sql`**

```sql
begin;
select plan(5);

select has_table('public', 'contratacoes', 'tabela contratacoes existe');
select has_table('public', 'pagamentos', 'tabela pagamentos existe');

select tests.create_supabase_user('con_cli');
select tests.create_supabase_user('con_pre');
insert into public.conversas (id, tipo, cliente_id, prestador_id)
values ('aaaaaaaa-0000-0000-0000-000000000011', 'DIRETA',
        tests.get_supabase_uid('con_cli'), tests.get_supabase_uid('con_pre'));
insert into public.propostas (id, conversa_id, prestador_id, cliente_id, valor)
values ('bbbbbbbb-0000-0000-0000-000000000011', 'aaaaaaaa-0000-0000-0000-000000000011',
        tests.get_supabase_uid('con_pre'), tests.get_supabase_uid('con_cli'), 300.00);
insert into public.contratacoes (proposta_id, titulo_servico, cliente_id, prestador_id, valor_total)
values ('bbbbbbbb-0000-0000-0000-000000000011', 'Pintura da sala',
        tests.get_supabase_uid('con_cli'), tests.get_supabase_uid('con_pre'), 300.00);

select is(
  (select valor_entrada from public.contratacoes where proposta_id = 'bbbbbbbb-0000-0000-0000-000000000011'),
  150.00::numeric, 'valor_entrada = 50% de 300');
select is(
  (select taxa_plataforma from public.contratacoes where proposta_id = 'bbbbbbbb-0000-0000-0000-000000000011'),
  60.00::numeric, 'taxa_plataforma = 20% de 300');

-- unique (contratacao_id, tipo): não pode haver 2 pagamentos ENTRADA na mesma contratação
insert into public.pagamentos (contratacao_id, valor, tipo)
select id, 150.00, 'ENTRADA' from public.contratacoes where proposta_id = 'bbbbbbbb-0000-0000-0000-000000000011';
select throws_ok(
  $$ insert into public.pagamentos (contratacao_id, valor, tipo)
     select id, 150.00, 'ENTRADA' from public.contratacoes
     where proposta_id = 'bbbbbbbb-0000-0000-0000-000000000011' $$,
  '23505',
  null,
  'segundo pagamento ENTRADA na mesma contratação viola unique'
);

select * from finish();
rollback;
```

- [ ] **Step 4: Aplicar e testar**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `0011_contratacoes.test.sql` com 5 asserts ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/0011_contratacoes.test.sql
git commit -m "feat(db): contratacoes e pagamentos com colunas geradas 50/50/20"
```

---

## Task 14: Migration — avaliações e notificações

**Files:**
- Create: `supabase/migrations/<ts>_avaliacoes_notificacoes.sql`
- Create: `supabase/tests/0012_avaliacoes_notificacoes.test.sql`

**Interfaces:**
- Consumes: `public.contratacoes` (Task 13), `public.usuarios` (Task 6), enum `public.tipo_notificacao` (Task 3).
- Produces:
  - `public.avaliacoes` (`id`, `contratacao_id → contratacoes(id)`, `avaliador_id → usuarios(id)`, `prestador_id → usuarios(id)`, `nota int not null check (nota between 1 and 5)`, `comentario text`, `pontualidade boolean not null default true`, `qualidade boolean not null default true`, `cordialidade boolean not null default true`, `created_at`; `unique (contratacao_id, avaliador_id)`).
  - `public.notificacoes` (`id`, `usuario_id → usuarios(id)`, `titulo text not null`, `mensagem text not null`, `tipo public.tipo_notificacao not null`, `referencia_id uuid`, `lida boolean not null default false`, `created_at`).

- [ ] **Step 1: Criar o arquivo**

Run: `pnpm db:new avaliacoes_notificacoes`

- [ ] **Step 2: Escrever o conteúdo**

```sql
create table public.avaliacoes (
  id             uuid primary key default gen_random_uuid(),
  contratacao_id uuid not null references public.contratacoes (id) on delete cascade,
  avaliador_id   uuid not null references public.usuarios (id) on delete cascade,
  prestador_id   uuid not null references public.usuarios (id) on delete cascade,
  nota           integer not null check (nota between 1 and 5),
  comentario     text,
  pontualidade   boolean not null default true,
  qualidade      boolean not null default true,
  cordialidade   boolean not null default true,
  created_at     timestamptz not null default now(),
  unique (contratacao_id, avaliador_id)
);
create index avaliacoes_prestador_id_idx on public.avaliacoes (prestador_id);

create table public.notificacoes (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references public.usuarios (id) on delete cascade,
  titulo       text not null,
  mensagem     text not null,
  tipo         public.tipo_notificacao not null,
  referencia_id uuid,
  lida         boolean not null default false,
  created_at   timestamptz not null default now()
);
create index notificacoes_usuario_id_created_at_idx on public.notificacoes (usuario_id, created_at desc);
```

- [ ] **Step 3: Escrever `supabase/tests/0012_avaliacoes_notificacoes.test.sql`**

```sql
begin;
select plan(3);

select has_table('public', 'avaliacoes', 'tabela avaliacoes existe');
select has_table('public', 'notificacoes', 'tabela notificacoes existe');

select tests.create_supabase_user('av_user');
select throws_ok(
  format(
    $$ insert into public.notificacoes (usuario_id, titulo, mensagem, tipo)
       values (%L, 't', 'm', 'PROPOSTA') $$,
    tests.get_supabase_uid('av_user')
  ) || $$ ; update public.notificacoes set nota = 9 where false $$,
  '42703',
  null,
  'coluna inexistente confirma o schema (guarda contra digitação)'
);

select * from finish();
rollback;
```

> Nota: a 3ª assert é um guarda simples de schema. Se preferir, troque por
> `select col_type_is('public','avaliacoes','nota','integer','nota é integer')`
> mantendo `plan(3)`.

- [ ] **Step 4: Aplicar e testar**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `0012_avaliacoes_notificacoes.test.sql` com 3 asserts ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/0012_avaliacoes_notificacoes.test.sql
git commit -m "feat(db): avaliacoes e notificacoes"
```

---

## Task 15: Migration — view `perfis_publicos`

**Files:**
- Create: `supabase/migrations/<ts>_view_perfis_publicos.sql`
- Create: `supabase/tests/0013_view_perfis_publicos.test.sql`

**Interfaces:**
- Consumes: `public.usuarios` (Task 6), `public.perfil_prestador` (Task 7).
- Produces: view `public.perfis_publicos` com `security_invoker = false` (projeta só colunas não sensíveis; ignora a RLS das tabelas base de propósito). Colunas: `usuario_id`, `nome`, `cidade`, `bairro`, `avatar_cor_hex`, `foto_perfil_url`, `rating_cliente`, `titulo_profissional`, `bio`, `preco_base`, `rating`, `total_avaliacoes`, `total_servicos`, `verificado`, `disponivel`, `raio_km`. `grant select` para `anon` e `authenticated`.

- [ ] **Step 1: Criar o arquivo**

Run: `pnpm db:new view_perfis_publicos`

- [ ] **Step 2: Escrever o conteúdo**

```sql
-- View de projeção pública. security_invoker = false é INTENCIONAL:
-- a view é a superfície pública e expõe apenas as colunas abaixo.
-- Não expõe telefone, status_conta, cnpj_mei nem chave_pix.
create view public.perfis_publicos
with (security_invoker = false)
as
select
  u.id              as usuario_id,
  u.nome,
  u.cidade,
  u.bairro,
  u.avatar_cor_hex,
  u.foto_perfil_url,
  u.rating_cliente,
  p.titulo_profissional,
  p.bio,
  p.preco_base,
  p.rating,
  p.total_avaliacoes,
  p.total_servicos,
  p.verificado,
  p.disponivel,
  p.raio_km
from public.usuarios u
left join public.perfil_prestador p on p.usuario_id = u.id;

revoke all on public.perfis_publicos from public;
grant select on public.perfis_publicos to anon, authenticated;
```

- [ ] **Step 3: Escrever `supabase/tests/0013_view_perfis_publicos.test.sql`**

```sql
begin;
select plan(4);

select has_view('public', 'perfis_publicos', 'view perfis_publicos existe');
select has_column('public', 'perfis_publicos', 'titulo_profissional', 'expõe titulo_profissional');
select hasnt_column('public', 'perfis_publicos', 'telefone', 'NÃO expõe telefone');
select hasnt_column('public', 'perfis_publicos', 'chave_pix', 'NÃO expõe chave_pix');

select * from finish();
rollback;
```

- [ ] **Step 4: Aplicar e testar**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `0013_view_perfis_publicos.test.sql` com 4 asserts ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/0013_view_perfis_publicos.test.sql
git commit -m "feat(db): view perfis_publicos (projeção pública sem campos sensíveis)"
```

---

## Task 16: Migration — funções auxiliares de RLS

**Files:**
- Create: `supabase/migrations/<ts>_fn_rls_helpers.sql`
- Create: `supabase/tests/0014_fn_rls_helpers.test.sql`

**Interfaces:**
- Consumes: `public.participantes_conversa` (Task 11), `public.perfil_prestador` (Task 7).
- Produces:
  - `public.fn_e_participante(p_conversa_id uuid) returns boolean` — `stable security definer set search_path = ''`; true se `auth.uid()` está em `participantes_conversa` da conversa.
  - `public.fn_tem_perfil_prestador(p_usuario_id uuid default null) returns boolean` — `stable security definer set search_path = ''`; true se `coalesce(p_usuario_id, auth.uid())` tem linha em `perfil_prestador`.
  - `EXECUTE` concedido a `anon, authenticated` em ambas.

- [ ] **Step 1: Criar o arquivo**

Run: `pnpm db:new fn_rls_helpers`

- [ ] **Step 2: Escrever o conteúdo**

```sql
create or replace function public.fn_e_participante(p_conversa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.participantes_conversa pc
    where pc.conversa_id = p_conversa_id
      and pc.usuario_id = (select auth.uid())
  );
$$;
comment on function public.fn_e_participante(uuid) is
  'RB03/RB14/RB15: o usuário atual participa desta conversa?';

create or replace function public.fn_tem_perfil_prestador(p_usuario_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfil_prestador p
    where p.usuario_id = coalesce(p_usuario_id, (select auth.uid()))
  );
$$;
comment on function public.fn_tem_perfil_prestador(uuid) is
  'RB01/RB11: o usuário atua como prestador (tem perfil_prestador)?';

grant execute on function public.fn_e_participante(uuid) to anon, authenticated;
grant execute on function public.fn_tem_perfil_prestador(uuid) to anon, authenticated;
```

- [ ] **Step 3: Escrever `supabase/tests/0014_fn_rls_helpers.test.sql`**

```sql
begin;
select plan(4);

select has_function('public', 'fn_e_participante', 'fn_e_participante existe');
select has_function('public', 'fn_tem_perfil_prestador', 'fn_tem_perfil_prestador existe');

select tests.create_supabase_user('h_cli');
select tests.create_supabase_user('h_pre');
insert into public.perfil_prestador (usuario_id) values (tests.get_supabase_uid('h_pre'));
insert into public.conversas (id, tipo, cliente_id, prestador_id)
values ('aaaaaaaa-0000-0000-0000-000000000014', 'DIRETA',
        tests.get_supabase_uid('h_cli'), tests.get_supabase_uid('h_pre'));
insert into public.participantes_conversa (conversa_id, usuario_id, papel) values
  ('aaaaaaaa-0000-0000-0000-000000000014', tests.get_supabase_uid('h_cli'), 'CLIENTE'),
  ('aaaaaaaa-0000-0000-0000-000000000014', tests.get_supabase_uid('h_pre'), 'PRESTADOR');

select tests.authenticate_as('h_cli');
select ok(
  public.fn_e_participante('aaaaaaaa-0000-0000-0000-000000000014'),
  'cliente participante: fn_e_participante = true'
);

reset role;
select tests.authenticate_as('h_cli');
select ok(
  not public.fn_tem_perfil_prestador(),
  'cliente sem perfil_prestador: fn_tem_perfil_prestador = false'
);

select * from finish();
rollback;
```

- [ ] **Step 4: Aplicar e testar**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `0014_fn_rls_helpers.test.sql` com 4 asserts ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/0014_fn_rls_helpers.test.sql
git commit -m "feat(db): funções auxiliares de RLS (fn_e_participante, fn_tem_perfil_prestador)"
```

---

## Task 17: Migration — habilitar RLS em todas as tabelas

**Files:**
- Create: `supabase/migrations/<ts>_rls_enable.sql`
- Create: `supabase/tests/0015_rls_enable.test.sql`

**Interfaces:**
- Consumes: todas as tabelas das Tasks 6–14.
- Produces: `alter table ... enable row level security` em: `usuarios`, `perfil_prestador`, `portfolio_prestador`, `disponibilidade_prestador`, `licencas_certificados`, `categoria_servico`, `prestador_categoria`, `enderecos_usuario`, `demandas_servico`, `tarefas_demanda`, `conversas`, `participantes_conversa`, `mensagens`, `anexos_mensagem`, `propostas`, `contratacoes`, `pagamentos`, `avaliacoes`, `notificacoes`. (Sem policies ainda → tudo negado para `anon`/`authenticated`; `service_role` ignora RLS.)

- [ ] **Step 1: Criar o arquivo**

Run: `pnpm db:new rls_enable`

- [ ] **Step 2: Escrever o conteúdo**

```sql
alter table public.usuarios                  enable row level security;
alter table public.perfil_prestador          enable row level security;
alter table public.portfolio_prestador       enable row level security;
alter table public.disponibilidade_prestador enable row level security;
alter table public.licencas_certificados     enable row level security;
alter table public.categoria_servico         enable row level security;
alter table public.prestador_categoria       enable row level security;
alter table public.enderecos_usuario         enable row level security;
alter table public.demandas_servico          enable row level security;
alter table public.tarefas_demanda           enable row level security;
alter table public.conversas                 enable row level security;
alter table public.participantes_conversa    enable row level security;
alter table public.mensagens                 enable row level security;
alter table public.anexos_mensagem           enable row level security;
alter table public.propostas                 enable row level security;
alter table public.contratacoes              enable row level security;
alter table public.pagamentos                enable row level security;
alter table public.avaliacoes                enable row level security;
alter table public.notificacoes              enable row level security;
```

- [ ] **Step 3: Escrever `supabase/tests/0015_rls_enable.test.sql`**

```sql
begin;
select plan(19);

select ok(tests.rls_enabled('public', 'usuarios'),                  'RLS: usuarios');
select ok(tests.rls_enabled('public', 'perfil_prestador'),          'RLS: perfil_prestador');
select ok(tests.rls_enabled('public', 'portfolio_prestador'),       'RLS: portfolio_prestador');
select ok(tests.rls_enabled('public', 'disponibilidade_prestador'), 'RLS: disponibilidade_prestador');
select ok(tests.rls_enabled('public', 'licencas_certificados'),     'RLS: licencas_certificados');
select ok(tests.rls_enabled('public', 'categoria_servico'),         'RLS: categoria_servico');
select ok(tests.rls_enabled('public', 'prestador_categoria'),       'RLS: prestador_categoria');
select ok(tests.rls_enabled('public', 'enderecos_usuario'),         'RLS: enderecos_usuario');
select ok(tests.rls_enabled('public', 'demandas_servico'),          'RLS: demandas_servico');
select ok(tests.rls_enabled('public', 'tarefas_demanda'),           'RLS: tarefas_demanda');
select ok(tests.rls_enabled('public', 'conversas'),                 'RLS: conversas');
select ok(tests.rls_enabled('public', 'participantes_conversa'),    'RLS: participantes_conversa');
select ok(tests.rls_enabled('public', 'mensagens'),                 'RLS: mensagens');
select ok(tests.rls_enabled('public', 'anexos_mensagem'),           'RLS: anexos_mensagem');
select ok(tests.rls_enabled('public', 'propostas'),                 'RLS: propostas');
select ok(tests.rls_enabled('public', 'contratacoes'),              'RLS: contratacoes');
select ok(tests.rls_enabled('public', 'pagamentos'),                'RLS: pagamentos');
select ok(tests.rls_enabled('public', 'avaliacoes'),                'RLS: avaliacoes');
select ok(tests.rls_enabled('public', 'notificacoes'),              'RLS: notificacoes');

select * from finish();
rollback;
```

- [ ] **Step 4: Aplicar e testar**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `0015_rls_enable.test.sql` com 19 asserts ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/0015_rls_enable.test.sql
git commit -m "feat(db): habilitar RLS em todas as tabelas de public"
```

---

## Task 18: Migration — policies de leitura pública + escrita pelo dono

**Files:**
- Create: `supabase/migrations/<ts>_rls_publico.sql`
- Create: `supabase/tests/0016_rls_publico.test.sql`

**Interfaces:**
- Consumes: RLS habilitada (Task 17).
- Produces: policies em `categoria_servico`, `perfil_prestador`, `portfolio_prestador`, `prestador_categoria`, `disponibilidade_prestador`, `licencas_certificados`, `avaliacoes` — SELECT liberado para `anon, authenticated`; INSERT/UPDATE/DELETE só pelo dono (`usuario_id`/`prestador_id` = `(select auth.uid())`); `avaliacoes` sem UPDATE/DELETE.

- [ ] **Step 1: Criar o arquivo**

Run: `pnpm db:new rls_publico`

- [ ] **Step 2: Escrever o conteúdo**

```sql
-- categoria_servico: catálogo, leitura livre; sem escrita para app (service_role gerencia)
create policy "categoria_select_todos" on public.categoria_servico
  for select to anon, authenticated using (true);

-- perfil_prestador: leitura livre (descoberta); escrita só do dono
create policy "perfil_prestador_select_todos" on public.perfil_prestador
  for select to anon, authenticated using (true);
create policy "perfil_prestador_insert_dono" on public.perfil_prestador
  for insert to authenticated with check (usuario_id = (select auth.uid()));
create policy "perfil_prestador_update_dono" on public.perfil_prestador
  for update to authenticated using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
create policy "perfil_prestador_delete_dono" on public.perfil_prestador
  for delete to authenticated using (usuario_id = (select auth.uid()));

-- portfolio_prestador
create policy "portfolio_select_todos" on public.portfolio_prestador
  for select to anon, authenticated using (true);
create policy "portfolio_insert_dono" on public.portfolio_prestador
  for insert to authenticated with check (prestador_id = (select auth.uid()));
create policy "portfolio_delete_dono" on public.portfolio_prestador
  for delete to authenticated using (prestador_id = (select auth.uid()));

-- prestador_categoria
create policy "prestador_categoria_select_todos" on public.prestador_categoria
  for select to anon, authenticated using (true);
create policy "prestador_categoria_insert_dono" on public.prestador_categoria
  for insert to authenticated with check (prestador_id = (select auth.uid()));
create policy "prestador_categoria_delete_dono" on public.prestador_categoria
  for delete to authenticated using (prestador_id = (select auth.uid()));

-- disponibilidade_prestador
create policy "disponibilidade_select_todos" on public.disponibilidade_prestador
  for select to anon, authenticated using (true);
create policy "disponibilidade_insert_dono" on public.disponibilidade_prestador
  for insert to authenticated with check (usuario_id = (select auth.uid()));
create policy "disponibilidade_update_dono" on public.disponibilidade_prestador
  for update to authenticated using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));

-- licencas_certificados
create policy "licencas_select_todos" on public.licencas_certificados
  for select to anon, authenticated using (true);
create policy "licencas_insert_dono" on public.licencas_certificados
  for insert to authenticated with check (usuario_id = (select auth.uid()));
create policy "licencas_delete_dono" on public.licencas_certificados
  for delete to authenticated using (usuario_id = (select auth.uid()));

-- avaliacoes: leitura livre; insert só como próprio avaliador; sem update/delete
create policy "avaliacoes_select_todos" on public.avaliacoes
  for select to anon, authenticated using (true);
create policy "avaliacoes_insert_avaliador" on public.avaliacoes
  for insert to authenticated with check (avaliador_id = (select auth.uid()));
```

- [ ] **Step 3: Escrever `supabase/tests/0016_rls_publico.test.sql`**

```sql
begin;
select plan(4);

select tests.create_supabase_user('pub_a');
select tests.create_supabase_user('pub_b');

-- anon consegue ler o catálogo
select tests.clear_authentication();
set local role anon;
select ok(
  (select count(*) from public.categoria_servico) = 9,
  'anon lê categoria_servico'
);
reset role;

-- usuário A cria o próprio perfil_prestador
select tests.authenticate_as('pub_a');
select lives_ok(
  format($$ insert into public.perfil_prestador (usuario_id) values (%L) $$, tests.get_supabase_uid('pub_a')),
  'A insere o próprio perfil_prestador'
);

-- usuário B NÃO consegue criar perfil no nome de A
reset role;
select tests.authenticate_as('pub_b');
select throws_ok(
  format($$ insert into public.perfil_prestador (usuario_id) values (%L) $$, tests.get_supabase_uid('pub_a')),
  '42501',
  null,
  'B não insere perfil_prestador no id de A (RLS)'
);

-- B lê o perfil de A (descoberta)
select ok(
  (select count(*) from public.perfil_prestador where usuario_id = tests.get_supabase_uid('pub_a')) = 1,
  'B lê o perfil_prestador de A'
);

select * from finish();
rollback;
```

- [ ] **Step 4: Aplicar e testar**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `0016_rls_publico.test.sql` com 4 asserts ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/0016_rls_publico.test.sql
git commit -m "feat(db): RLS de leitura pública e escrita pelo dono"
```

---

## Task 19: Migration — policies pessoais (`usuarios`, `enderecos_usuario`, `notificacoes`)

**Files:**
- Create: `supabase/migrations/<ts>_rls_pessoal.sql`
- Create: `supabase/tests/0017_rls_pessoal.test.sql`

**Interfaces:**
- Consumes: RLS habilitada (Task 17).
- Produces:
  - `usuarios`: SELECT só a própria linha; UPDATE só a própria linha; sem INSERT/DELETE (trigger + service_role cuidam).
  - `enderecos_usuario`: todas as operações restritas a `usuario_id = (select auth.uid())`.
  - `notificacoes`: SELECT e UPDATE só das próprias; UPDATE limitado à coluna `lida` via `grant update (lida)`; sem INSERT/DELETE para app.

- [ ] **Step 1: Criar o arquivo**

Run: `pnpm db:new rls_pessoal`

- [ ] **Step 2: Escrever o conteúdo**

```sql
-- usuarios: cada um enxerga e edita só a própria linha
create policy "usuarios_select_propria" on public.usuarios
  for select to authenticated using (id = (select auth.uid()));
create policy "usuarios_update_propria" on public.usuarios
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- enderecos_usuario: tudo restrito ao dono
create policy "enderecos_select_dono" on public.enderecos_usuario
  for select to authenticated using (usuario_id = (select auth.uid()));
create policy "enderecos_insert_dono" on public.enderecos_usuario
  for insert to authenticated with check (usuario_id = (select auth.uid()));
create policy "enderecos_update_dono" on public.enderecos_usuario
  for update to authenticated using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
create policy "enderecos_delete_dono" on public.enderecos_usuario
  for delete to authenticated using (usuario_id = (select auth.uid()));

-- notificacoes: ler as próprias; marcar como lida (só a coluna lida)
revoke update on public.notificacoes from authenticated;
grant update (lida) on public.notificacoes to authenticated;
create policy "notificacoes_select_dono" on public.notificacoes
  for select to authenticated using (usuario_id = (select auth.uid()));
create policy "notificacoes_update_dono" on public.notificacoes
  for update to authenticated using (usuario_id = (select auth.uid()))
  with check (usuario_id = (select auth.uid()));
```

- [ ] **Step 3: Escrever `supabase/tests/0017_rls_pessoal.test.sql`**

```sql
begin;
select plan(4);

select tests.create_supabase_user('pes_a');
select tests.create_supabase_user('pes_b');

-- A só vê a própria linha em usuarios
select tests.authenticate_as('pes_a');
select is(
  (select count(*)::int from public.usuarios),
  1,
  'A enxerga apenas a própria linha em usuarios'
);
select is(
  (select id from public.usuarios),
  tests.get_supabase_uid('pes_a'),
  'a linha visível para A é a de A'
);

-- A insere endereço próprio; não consegue inserir para B
select lives_ok(
  format($$ insert into public.enderecos_usuario (usuario_id, identificacao) values (%L, 'Casa') $$,
         tests.get_supabase_uid('pes_a')),
  'A insere endereço próprio'
);
select throws_ok(
  format($$ insert into public.enderecos_usuario (usuario_id, identificacao) values (%L, 'Casa') $$,
         tests.get_supabase_uid('pes_b')),
  '42501',
  null,
  'A não insere endereço para B (RLS)'
);

select * from finish();
rollback;
```

- [ ] **Step 4: Aplicar e testar**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `0017_rls_pessoal.test.sql` com 4 asserts ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/0017_rls_pessoal.test.sql
git commit -m "feat(db): RLS pessoal (usuarios, enderecos_usuario, notificacoes)"
```

---

## Task 20: Migration — policies de demandas e tarefas

**Files:**
- Create: `supabase/migrations/<ts>_rls_demandas.sql`
- Create: `supabase/tests/0018_rls_demandas.test.sql`

**Interfaces:**
- Consumes: RLS habilitada (Task 17), `public.fn_tem_perfil_prestador` (Task 16).
- Produces:
  - `demandas_servico`: SELECT se `cliente_id = (select auth.uid())` **ou** (`status = 'ABERTA'` e `public.fn_tem_perfil_prestador()`); INSERT/UPDATE/DELETE só do `cliente_id`.
  - `tarefas_demanda`: SELECT se pode ver a demanda-mãe; escrita só do cliente dono da demanda.

- [ ] **Step 1: Criar o arquivo**

Run: `pnpm db:new rls_demandas`

- [ ] **Step 2: Escrever o conteúdo**

```sql
-- demandas_servico
create policy "demandas_select_dono_ou_prestador_abertas" on public.demandas_servico
  for select to authenticated
  using (
    cliente_id = (select auth.uid())
    or (status = 'ABERTA' and public.fn_tem_perfil_prestador())
  );
create policy "demandas_insert_cliente" on public.demandas_servico
  for insert to authenticated with check (cliente_id = (select auth.uid()));
create policy "demandas_update_cliente" on public.demandas_servico
  for update to authenticated using (cliente_id = (select auth.uid()))
  with check (cliente_id = (select auth.uid()));
create policy "demandas_delete_cliente" on public.demandas_servico
  for delete to authenticated using (cliente_id = (select auth.uid()));

-- tarefas_demanda
create policy "tarefas_select_quem_ve_demanda" on public.tarefas_demanda
  for select to authenticated
  using (exists (
    select 1 from public.demandas_servico d
    where d.id = demanda_id
      and (d.cliente_id = (select auth.uid())
           or (d.status = 'ABERTA' and public.fn_tem_perfil_prestador()))
  ));
create policy "tarefas_write_cliente_dono" on public.tarefas_demanda
  for all to authenticated
  using (exists (
    select 1 from public.demandas_servico d
    where d.id = demanda_id and d.cliente_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.demandas_servico d
    where d.id = demanda_id and d.cliente_id = (select auth.uid())
  ));
```

- [ ] **Step 3: Escrever `supabase/tests/0018_rls_demandas.test.sql`**

```sql
begin;
select plan(3);

select tests.create_supabase_user('dem_cliente');
select tests.create_supabase_user('dem_prestador');
select tests.create_supabase_user('dem_outro');
insert into public.perfil_prestador (usuario_id) values (tests.get_supabase_uid('dem_prestador'));

-- cliente cria uma demanda ABERTA
select tests.authenticate_as('dem_cliente');
insert into public.demandas_servico (id, cliente_id, categoria_id, titulo, descricao)
select 'cccccccc-0000-0000-0000-000000000018', tests.get_supabase_uid('dem_cliente'), id,
       'Pintar quarto', 'Pintar 1 quarto de 12m2'
from public.categoria_servico where nome = 'Pintura';

-- prestador (com perfil) enxerga a demanda ABERTA
reset role;
select tests.authenticate_as('dem_prestador');
select is(
  (select count(*)::int from public.demandas_servico where id = 'cccccccc-0000-0000-0000-000000000018'),
  1,
  'prestador vê demanda ABERTA de terceiro'
);

-- usuário sem perfil_prestador NÃO enxerga a demanda de terceiro
reset role;
select tests.authenticate_as('dem_outro');
select is(
  (select count(*)::int from public.demandas_servico where id = 'cccccccc-0000-0000-0000-000000000018'),
  0,
  'não-prestador não vê demanda de terceiro'
);

-- não-prestador também não consegue alterar a demanda alheia
select is(
  (with upd as (
     update public.demandas_servico set titulo = 'hack'
     where id = 'cccccccc-0000-0000-0000-000000000018' returning 1
   ) select count(*)::int from upd),
  0,
  'não-dono não altera demanda alheia (0 linhas afetadas)'
);

select * from finish();
rollback;
```

- [ ] **Step 4: Aplicar e testar**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `0018_rls_demandas.test.sql` com 3 asserts ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/0018_rls_demandas.test.sql
git commit -m "feat(db): RLS de demandas e tarefas"
```

---

## Task 21: Migration — policies de conversas, mensagens e propostas

**Files:**
- Create: `supabase/migrations/<ts>_rls_conversas.sql`
- Create: `supabase/tests/0019_rls_conversas.test.sql`

**Interfaces:**
- Consumes: RLS habilitada (Task 17), `public.fn_e_participante` (Task 16).
- Produces:
  - `conversas`: SELECT/UPDATE se `public.fn_e_participante(id)`; INSERT se `cliente_id = (select auth.uid()) or prestador_id = (select auth.uid())`.
  - `participantes_conversa`: SELECT se `public.fn_e_participante(conversa_id)`; INSERT se o próprio usuário (`usuario_id = (select auth.uid())`) **ou** já participante da conversa.
  - `mensagens`: SELECT se participante; INSERT se `remetente_id = (select auth.uid())` e participante; UPDATE só do próprio remetente.
  - `anexos_mensagem`: SELECT se participante da conversa da mensagem; INSERT se remetente da mensagem.
  - `propostas`: SELECT se participante; INSERT se `prestador_id = (select auth.uid())` e participante; UPDATE se participante.
  - *(As transições de estado sensíveis — aceite de proposta — passam por Edge Function `service_role` no Plano 5; estas policies são o backstop.)*

- [ ] **Step 1: Criar o arquivo**

Run: `pnpm db:new rls_conversas`

- [ ] **Step 2: Escrever o conteúdo**

```sql
-- conversas
create policy "conversas_select_participante" on public.conversas
  for select to authenticated using (public.fn_e_participante(id));
create policy "conversas_insert_parte" on public.conversas
  for insert to authenticated
  with check (cliente_id = (select auth.uid()) or prestador_id = (select auth.uid()));
create policy "conversas_update_participante" on public.conversas
  for update to authenticated using (public.fn_e_participante(id))
  with check (public.fn_e_participante(id));

-- participantes_conversa
create policy "participantes_select_participante" on public.participantes_conversa
  for select to authenticated using (public.fn_e_participante(conversa_id));
create policy "participantes_insert_self_ou_participante" on public.participantes_conversa
  for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    or public.fn_e_participante(conversa_id)
  );

-- mensagens
create policy "mensagens_select_participante" on public.mensagens
  for select to authenticated using (public.fn_e_participante(conversa_id));
create policy "mensagens_insert_remetente_participante" on public.mensagens
  for insert to authenticated
  with check (remetente_id = (select auth.uid()) and public.fn_e_participante(conversa_id));
create policy "mensagens_update_remetente" on public.mensagens
  for update to authenticated using (remetente_id = (select auth.uid()))
  with check (remetente_id = (select auth.uid()));

-- anexos_mensagem
create policy "anexos_select_participante" on public.anexos_mensagem
  for select to authenticated
  using (exists (
    select 1 from public.mensagens m
    where m.id = mensagem_id and public.fn_e_participante(m.conversa_id)
  ));
create policy "anexos_insert_remetente" on public.anexos_mensagem
  for insert to authenticated
  with check (exists (
    select 1 from public.mensagens m
    where m.id = mensagem_id and m.remetente_id = (select auth.uid())
  ));

-- propostas
create policy "propostas_select_participante" on public.propostas
  for select to authenticated using (public.fn_e_participante(conversa_id));
create policy "propostas_insert_prestador_participante" on public.propostas
  for insert to authenticated
  with check (prestador_id = (select auth.uid()) and public.fn_e_participante(conversa_id));
create policy "propostas_update_participante" on public.propostas
  for update to authenticated using (public.fn_e_participante(conversa_id))
  with check (public.fn_e_participante(conversa_id));
```

- [ ] **Step 3: Escrever `supabase/tests/0019_rls_conversas.test.sql`**

```sql
begin;
select plan(3);

select tests.create_supabase_user('c_cli');
select tests.create_supabase_user('c_preA');
select tests.create_supabase_user('c_preB');

-- conversa entre cliente e prestador A, com participantes
insert into public.conversas (id, tipo, cliente_id, prestador_id)
values ('dddddddd-0000-0000-0000-000000000019', 'DIRETA',
        tests.get_supabase_uid('c_cli'), tests.get_supabase_uid('c_preA'));
insert into public.participantes_conversa (conversa_id, usuario_id, papel) values
  ('dddddddd-0000-0000-0000-000000000019', tests.get_supabase_uid('c_cli'),  'CLIENTE'),
  ('dddddddd-0000-0000-0000-000000000019', tests.get_supabase_uid('c_preA'), 'PRESTADOR');
insert into public.mensagens (conversa_id, remetente_id, corpo)
values ('dddddddd-0000-0000-0000-000000000019', tests.get_supabase_uid('c_cli'), 'ola A');

-- prestador A (participante) lê a mensagem
select tests.authenticate_as('c_preA');
select is(
  (select count(*)::int from public.mensagens where conversa_id = 'dddddddd-0000-0000-0000-000000000019'),
  1,
  'prestador A participante lê a mensagem'
);

-- prestador B (NÃO participante) não lê nada dessa conversa (RB15)
reset role;
select tests.authenticate_as('c_preB');
select is(
  (select count(*)::int from public.mensagens where conversa_id = 'dddddddd-0000-0000-0000-000000000019'),
  0,
  'prestador B não participante NÃO lê mensagens da conversa de A'
);
select is(
  (select count(*)::int from public.conversas where id = 'dddddddd-0000-0000-0000-000000000019'),
  0,
  'prestador B não participante NÃO enxerga a conversa'
);

select * from finish();
rollback;
```

- [ ] **Step 4: Aplicar e testar**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `0019_rls_conversas.test.sql` com 3 asserts ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/0019_rls_conversas.test.sql
git commit -m "feat(db): RLS de conversas, mensagens e propostas (isolamento por participante)"
```

---

## Task 22: Migration — policies de contratações e pagamentos

**Files:**
- Create: `supabase/migrations/<ts>_rls_contratacoes.sql`
- Create: `supabase/tests/0020_rls_contratacoes.test.sql`

**Interfaces:**
- Consumes: RLS habilitada (Task 17).
- Produces:
  - `contratacoes`: SELECT se `cliente_id = (select auth.uid()) or prestador_id = (select auth.uid())`. **Sem** policy de INSERT/UPDATE/DELETE → escrita só via `service_role` (Edge Functions do Plano 5).
  - `pagamentos`: SELECT se o usuário é parte da contratação-mãe. **Sem** policy de escrita.

- [ ] **Step 1: Criar o arquivo**

Run: `pnpm db:new rls_contratacoes`

- [ ] **Step 2: Escrever o conteúdo**

```sql
-- contratacoes: leitura pelas partes; escrita exclusivamente via service_role
create policy "contratacoes_select_partes" on public.contratacoes
  for select to authenticated
  using (cliente_id = (select auth.uid()) or prestador_id = (select auth.uid()));

-- pagamentos: leitura pelas partes da contratação; escrita exclusivamente via service_role
create policy "pagamentos_select_partes" on public.pagamentos
  for select to authenticated
  using (exists (
    select 1 from public.contratacoes c
    where c.id = contratacao_id
      and (c.cliente_id = (select auth.uid()) or c.prestador_id = (select auth.uid()))
  ));
```

- [ ] **Step 3: Escrever `supabase/tests/0020_rls_contratacoes.test.sql`**

```sql
begin;
select plan(3);

select tests.create_supabase_user('k_cli');
select tests.create_supabase_user('k_pre');
select tests.create_supabase_user('k_estranho');

insert into public.conversas (id, tipo, cliente_id, prestador_id)
values ('eeeeeeee-0000-0000-0000-000000000020', 'DIRETA',
        tests.get_supabase_uid('k_cli'), tests.get_supabase_uid('k_pre'));
insert into public.propostas (id, conversa_id, prestador_id, cliente_id, valor)
values ('ffffffff-0000-0000-0000-000000000020', 'eeeeeeee-0000-0000-0000-000000000020',
        tests.get_supabase_uid('k_pre'), tests.get_supabase_uid('k_cli'), 200.00);
insert into public.contratacoes (id, proposta_id, titulo_servico, cliente_id, prestador_id, valor_total)
values ('99999999-0000-0000-0000-000000000020', 'ffffffff-0000-0000-0000-000000000020',
        'Serviço', tests.get_supabase_uid('k_cli'), tests.get_supabase_uid('k_pre'), 200.00);

-- cliente (parte) lê a contratação
select tests.authenticate_as('k_cli');
select is(
  (select count(*)::int from public.contratacoes where id = '99999999-0000-0000-0000-000000000020'),
  1,
  'cliente parte lê a contratação'
);

-- cliente NÃO consegue inserir contratação (sem policy de INSERT)
select throws_ok(
  $$ insert into public.contratacoes (proposta_id, titulo_servico, cliente_id, prestador_id, valor_total)
     values ('ffffffff-0000-0000-0000-000000000020', 'x',
             tests.get_supabase_uid('k_cli'), tests.get_supabase_uid('k_pre'), 1.00) $$,
  '42501',
  null,
  'cliente não insere em contratacoes (só service_role)'
);

-- estranho não lê a contratação
reset role;
select tests.authenticate_as('k_estranho');
select is(
  (select count(*)::int from public.contratacoes where id = '99999999-0000-0000-0000-000000000020'),
  0,
  'usuário estranho não lê contratação alheia'
);

select * from finish();
rollback;
```

- [ ] **Step 4: Aplicar e testar**

Run: `pnpm db:reset && pnpm db:test`
Expected: PASS — `0020_rls_contratacoes.test.sql` com 3 asserts ok.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations supabase/tests/0020_rls_contratacoes.test.sql
git commit -m "feat(db): RLS de contratacoes e pagamentos (leitura pelas partes, escrita via service_role)"
```

---

## Task 23: Gerar e commitar `packages/db-types`

**Files:**
- Create: `packages/db-types/package.json`
- Create: `packages/db-types/index.ts` (gerado)
- Create: `packages/db-types/tsconfig.json`

**Interfaces:**
- Consumes: esquema completo (Tasks 3–22), script `pnpm db:types` (Task 1).
- Produces: pacote `@servico-feito/db-types` exportando o tipo `Database` (com `Tables`, `Enums`, `Views`) — consumido por `apps/mobile` no Plano 2.

- [ ] **Step 1: Escrever `packages/db-types/package.json`**

```json
{
  "name": "@servico-feito/db-types",
  "version": "0.0.0",
  "private": true,
  "main": "index.ts",
  "types": "index.ts"
}
```

- [ ] **Step 2: Escrever `packages/db-types/tsconfig.json`**

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["index.ts"]
}
```

- [ ] **Step 3: Garantir a stack local no ar e gerar os tipos**

Run: `pnpm db:start && pnpm db:reset && pnpm db:types`
Expected: cria `packages/db-types/index.ts` não vazio, começando com `export type Json =` e contendo `export type Database = {`.

- [ ] **Step 4: Verificar o conteúdo gerado**

Run: `grep -c "Row:" packages/db-types/index.ts`
Expected: número ≥ 19 (uma entrada `Row:` por tabela; a view `perfis_publicos` some mais uma).

Run: `pnpm -w exec tsc -p packages/db-types/tsconfig.json`
Expected: sai com código 0 (sem erros de tipo).

- [ ] **Step 5: Commit**

```bash
git add packages/db-types
git commit -m "feat(db-types): tipos TypeScript gerados do esquema Supabase"
```

---

## Task 24: Pipeline de CI de banco

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: scripts `pnpm db:*`, `packages/db-types/index.ts` commitado (Task 23).
- Produces: workflow que em cada push/PR sobe o Supabase local, roda `supabase db lint`, `supabase test db` e confere que `packages/db-types/index.ts` está atualizado em relação ao esquema.

- [ ] **Step 1: Escrever `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:

jobs:
  db:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9.12.0

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Subir Supabase local
        run: pnpm supabase start

      - name: Lint do esquema
        run: pnpm supabase db lint --level warning

      - name: Aplicar migrations do zero
        run: pnpm supabase db reset --no-seed

      - name: Testes pgTAP
        run: pnpm supabase test db

      - name: Conferir db-types atualizado
        run: |
          pnpm supabase gen types typescript --local > /tmp/db-types.ts
          if ! diff -u packages/db-types/index.ts /tmp/db-types.ts; then
            echo "::error::packages/db-types/index.ts desatualizado. Rode 'pnpm db:types' e faça commit."
            exit 1
          fi

      - name: Derrubar Supabase local
        if: always()
        run: pnpm supabase stop
```

- [ ] **Step 2: Validar o YAML localmente**

Run: `pnpm -w exec node -e "const y=require('fs').readFileSync('.github/workflows/ci.yml','utf8'); if(!y.includes('supabase test db')) process.exit(1); console.log('ok')"`
Expected: imprime `ok`.

- [ ] **Step 3: Rodar a sequência do CI localmente**

Run: `pnpm db:start && pnpm db:lint && pnpm supabase db reset --no-seed && pnpm db:test && pnpm db:types && git diff --exit-code packages/db-types/index.ts`
Expected: todos os passos com código 0; `git diff` sem saída (tipos já atualizados).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: pipeline de banco (lint, pgTAP, checagem de db-types)"
```

- [ ] **Step 5: Empurrar o branch e confirmar o CI verde**

```bash
git push -u origin HEAD
```
Expected: o workflow `CI / db` roda no GitHub e termina verde. Se falhar por falta de Docker/limite de recursos no runner, revisar os logs antes de prosseguir para o Plano 2.

---

## Task 25: Registro operacional — rotação de segredos e criação dos projetos Supabase

**Files:**
- Create: `docs/superpowers/plans/2026-09-08-fundacao-checklist-operacional.md`

**Interfaces:**
- Consumes: nada de código.
- Produces: checklist versionado das ações manuais (fora do código) que precisam acontecer antes do Plano 6 (pagamento) e do lançamento. Não bloqueia os Planos 2–5.

- [ ] **Step 1: Escrever o checklist**

```markdown
# Fundação — Checklist operacional (ações manuais)

Estas ações são feitas nos painéis da Supabase e da EFI, não no código.
Nenhuma bloqueia os Planos 2–5. As de pagamento bloqueiam o Plano 6.

## Projetos Supabase

- [ ] Criar projeto Supabase **dev** (org do Serviço Feito). Guardar `Project ref`.
- [ ] `supabase link --project-ref <dev>` e `supabase db push` (aplica as migrations deste plano).
- [ ] Preencher `.env` local com `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` do projeto dev.
- [ ] Criar projeto Supabase **prod** só no lançamento; mesmas migrations via `db push`.

## Rotação de segredos vazados (repo Kotlin em docs/arquitetura-antiga/)

- [ ] Revogar / rotacionar a chave `service_role` do projeto antigo `yaqmivazqarfkggypuow`
      (arquivo `.../data/remote/supabase/SupabaseConfig.kt`). O projeto antigo será descartado.
- [ ] Rotacionar `CLIENT_ID` / `CLIENT_SECRET` de **produção** da EFI
      (arquivo `.../data/remote/efi/EfiConfig.kt`) no painel da EFI.
- [ ] Gerar novos certificados `.p12` (homologação e produção) na EFI. Os antigos
      (`.../app/src/main/res/raw/producao.p12`, `homologacao.p12`) são considerados comprometidos.
- [ ] Confirmar que `.gitignore` bloqueia `*.p12` / `*.pem` / `.env` (feito na Task 1).
- [ ] Guardar os valores novos apenas como Supabase secrets no Plano 6
      (`EFI_CLIENT_ID`, `EFI_CLIENT_SECRET`, `EFI_CERT_P12_BASE64`, `EFI_WEBHOOK_TOKEN`,
      `PLATFORM_PIX_KEY`). Nunca no repositório.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-09-08-fundacao-checklist-operacional.md
git commit -m "docs: checklist operacional da fundação (projetos Supabase, rotação de segredos)"
```

---

## Self-Review

**1. Cobertura da spec:**

- Seção 4 (estrutura do repo): Tasks 1, 2, 23, 24 criam `package.json`, `pnpm-workspace.yaml`, `supabase/`, `packages/db-types/`, `.github/`. A consolidação da pasta Kotlin antiga e a remoção de `env/` **não** estão neste plano — são limpeza de arquivos existentes; adicionadas como nota no Plano 2 (shell do app) ou podem ser feitas à mão. *Gap consciente, registrado aqui.*
- Seção 6 (modelo de dados): enums (Task 3), `usuarios` + trigger (Task 6), `perfil_prestador` e extras (Task 7), catálogo (Task 8), endereços (Task 9), demandas (Task 10), conversas/mensagens (Task 11), propostas + colunas geradas (Task 12), contratações/pagamentos + colunas geradas (Task 13), avaliações/notificações (Task 14), view `perfis_publicos` (Task 15). Coberto.
- Seção 7 (RLS): helpers (Task 16), enable (Task 17), policies públicas (Task 18), pessoais (Task 19), demandas (Task 20), conversas/mensagens/propostas com o teste de isolamento RB15 (Task 21), contratações/pagamentos (Task 22). Testes pgTAP em cada uma. Coberto.
- Seção 8 (db-types): Task 23. Coberto (o resto da seção 8 — repositories, hooks — é Plano 3).
- Seção 5 (ambientes + rotação de segredos): Task 25 (checklist operacional). As ações são manuais fora do código; o plano as versiona e não as bloqueia.
- Seções 9–13 (auth, navegação, pagamento, erros, testes de app, visual): fora do escopo deste plano, são Planos 2–7.
- Global Constraints: Node 20 / pnpm 9 (Task 1); `snake_case`, `gen_random_uuid()`, `created_at`/`updated_at` + trigger, colunas geradas 20/80/50, enums nativos, RLS em todas as tabelas, `security definer` com `search_path=''` — aplicados nas migrations e verificados nos testes.

**2. Varredura de placeholders:** sem "TBD"/"TODO" de plano. O `<ts>` nos nomes de migration é o timestamp que `supabase migration new` gera — explicado nas Global Constraints e cada Task tem o Step "criar o arquivo" com o comando exato. O comentário `TODO(release-prod)` na Task 4 é uma anotação de código deliberada (dívida técnica registrada), não um passo do plano em aberto.

**3. Consistência de tipos/nomes:**

- `tests.create_supabase_user` / `tests.get_supabase_uid` / `tests.authenticate_as` / `tests.clear_authentication` / `tests.rls_enabled` — assinaturas idênticas em todas as Tasks que as usam (4, 6–22).
- `public.set_updated_at()` — criada na Task 5, referenciada com o mesmo nome nas Tasks 6, 7, 9, 10, 11, 12, 13.
- `public.fn_e_participante(uuid)` e `public.fn_tem_perfil_prestador(uuid)` — criadas na Task 16, usadas com a mesma assinatura nas Tasks 20, 21.
- Colunas geradas: `taxa_plataforma` (propostas e contratações), `valor_liquido_prestador` (propostas), `valor_entrada` / `valor_final` (contratações) — nomes idênticos nas migrations e nos testes.
- `proposta_id` em `mensagens`: coluna criada na Task 11 sem FK; FK `mensagens_proposta_id_fkey` adicionada na Task 12 (a ordem das migrations garante que `propostas` já existe).
- Códigos de erro Postgres usados nos testes: `23505` (unique), `23514` (check), `42501` (RLS/insufficient privilege), `42703` (coluna inexistente). Consistentes.

Nenhuma inconsistência pendente.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-08-fundacao-monorepo-supabase.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
