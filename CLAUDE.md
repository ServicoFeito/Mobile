# Serviço Feito — contexto para agentes

Marketplace de serviços (cliente ↔ prestador). App **React Native + Expo + TypeScript**
sobre **Supabase**. Migração de um app Android Kotlin legado. API C# e AWS ficam para
**depois** — o MVP roda só sobre Supabase.

## Leia primeiro (nesta ordem)

1. `docs/README.md` — índice de toda a documentação
2. `docs/regras-de-negocio/regras-de-negocio.md` — regras RB01–RB17
3. `docs/superpowers/specs/2026-09-08-migracao-react-native-supabase-design.md` — design aprovado
4. `docs/superpowers/plans/` — planos de implementação (um por fase)
5. `docs/COORDENACAO-AGENTES.md` — como vários agentes trabalham sem conflito
6. `docs/GIT-FLUXO.md` — branches e push

## Branch de trabalho

Clonar e **`git checkout homolog`** (ou a feature branch ativa). `main` só recebe
merge de `homolog` via PR. Criar feature branch a partir de `homolog`.

## Pré-requisitos da máquina

- Node 20 LTS (18 funciona, com WARN de engine). pnpm 9 (`corepack enable && corepack prepare pnpm@9.12.0 --activate`).
- **Sem Docker. Sem Postgres local.** O desenvolvimento é direto no projeto Supabase
  **dev** na nuvem (`servico-feito-dev`).
- Conta Supabase com acesso ao projeto dev. Conta GitHub com escrita em `ServicoFeito/Mobile`.

## Setup (uma vez, após o clone)

```bash
pnpm install

# 1. Login da CLI Supabase (abre navegador)
pnpm supabase login        # ou: npx --yes supabase@latest login

# 2. Criar .env na raiz (git-ignored). Copiar de .env.example e preencher.
#    Valores vêm de quem administra o projeto servico-feito-dev:
#    - SUPABASE_PROJECT_REF   (dashboard/project/<ref>)
#    - SUPABASE_DB_URL        (Project Settings > Database > Connection string > Session pooler, 5432;
#                              senha URL-encoded: @->%40 #->%23 !->%21)
#    - SUPABASE_DB_PASSWORD   (Database Password do projeto)
#    - EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY  (Project Settings > API)

# 3. Ligar o repo ao projeto dev
pnpm supabase link --project-ref <SUPABASE_PROJECT_REF>
```

## Rodar tarefas de banco

pnpm **não** carrega `.env` sozinho. Antes de qualquer `db:*`:

```bash
set -a && . ./.env && set +a
```

| Comando | O quê |
|---|---|
| `pnpm db:new <nome>` | cria `supabase/migrations/<timestamp>_<nome>.sql` vazio |
| `pnpm db:push` | aplica migrations pendentes no dev (`supabase db push --linked`) |
| `pnpm db:test` | roda o runner pgTAP Node (`supabase/tests/run.mjs`) contra o dev |
| `pnpm db:types` | regenera `packages/db-types/index.ts` (`supabase gen types --linked`) |
| `pnpm db:advisors` | lint de segurança/performance no dev |
| `pnpm db:diff` | diferença esquema dev × migrations |

Cada migration nova tem teste pgTAP em `supabase/tests/*.test.sql` (cada arquivo em
`begin … select * from finish(); rollback;`). Migration sem teste não é considerada pronta.

## Estado atual (2026-09-08)

- **Plano 1 (Fundação: monorepo + esquema Supabase + RLS + pgTAP + CI)** em execução.
  Feitas: T1 (monorepo), T2 (link dev + runner pgTAP), T3 (extensões + enums), T25
  (checklist operacional). Próxima: T4.
- Execução via `superpowers:subagent-driven-development`. Quem retomar o Plano 1 lê o
  ledger em `.superpowers/sdd/2026-09-08-fundacao-monorepo-supabase/progress.md` da
  worktree correspondente.
- **Planos 1 e 2 são single-agent** (cadeia linear). O trabalho paralelo por feature
  module começa no **Plano 3**.

## Regras

- Nunca commitar `.env`, `*.p12`, `*.pem` (bloqueados no `.gitignore`).
- `docs/arquitetura-antiga/` é git-ignored (contém segredos vazados do app Kotlin) —
  referência local, não republicar.
- Rotação de segredos vazados pendente: `docs/superpowers/plans/2026-09-08-fundacao-checklist-operacional.md`.
- Commits: Conventional Commits. `git config user`: `VitorHugoVH` / `vhfraga007@gmail.com`.
