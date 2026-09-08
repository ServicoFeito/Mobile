# docs/

Contexto do projeto Serviço Feito. Ler nesta ordem:

1. **`regras-de-negocio/regras-de-negocio.md`** — visão, público, modelo de negócio,
   funcionalidades, fluxos, entidades e regras RB01–RB17. Fonte da verdade do produto.
2. **`arquitetura-front-mobile/arquitetura-front-mobile.md`** — padrões do app mobile
   (React Native + Expo + TypeScript, camadas features/hooks/services, TanStack Query,
   Zustand, Atomic Design, testes). Escrito pressupondo a API C#; onde uma decisão só
   faz sentido com a API C#, o design abaixo adapta para o Supabase.
3. **`superpowers/specs/2026-09-08-migracao-react-native-supabase-design.md`** — design
   aprovado da migração Kotlin → React Native + Supabase. MVP sobre Supabase; API C# e
   AWS ficam para depois.
4. **`superpowers/plans/`** — planos de implementação, um por fase. Plano 1 (Fundação:
   monorepo + esquema Supabase + RLS + pgTAP + CI) em execução.
5. **`COORDENACAO-AGENTES.md`** — protocolo de trabalho com múltiplos agentes (board
   Notion, claim de tarefas). Planos 1 e 2 são single-agent; o fan-out por feature
   module começa no Plano 3.
6. **`GIT-FLUXO.md`** — branches (`main` / `homolog` / feature) e setup de push.

## Não versionado (git-ignored)

- **`arquitetura-antiga/`** — cópia do app Android Kotlin original (referência).
  Fica fora do Git: contém `.git` aninhado e **segredos vazados** (`service_role` do
  Supabase antigo, credenciais/certificados EFI). Não republicar. Ver a seção de
  rotação de segredos na spec.
- `env/`, `servico-feito/` (raiz) — artefatos locais.
