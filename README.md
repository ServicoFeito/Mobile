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
