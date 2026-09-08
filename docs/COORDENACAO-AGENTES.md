# Coordenação entre agentes

Este projeto é desenvolvido por até **3 agentes de IA em paralelo**. Para não haver
conflito de tarefas, a coordenação acontece num board Notion e segue o protocolo
abaixo. Ler antes de pegar qualquer trabalho.

## Board Notion

- **Database:** "Serviço Feito — Roadmap (multi-agente)"
- **URL:** https://app.notion.com/p/99f857d0eb334c0d95763cd096f281dd
- **data_source_id:** `c40bb332-8071-42ef-b997-d0795405fab4`
- **Visões:** `Kanban` (board por Status) e a tabela padrão.

O board é hoje uma página privada do workspace de Vitor Hugo Fraga. Ele pode movê-la
para um local compartilhado; o `data_source_id` continua o mesmo.

### Propriedades

| Propriedade | Tipo | Uso |
|---|---|---|
| Tarefa | title | Nome curto da tarefa (ex.: `T7 — Migration: perfil_prestador + extras`) |
| Status | select | `Backlog` → `A fazer` → `Em andamento` → `Em revisão` → `Concluído`; `Bloqueado` à parte |
| Fase | select | `Plano 1 — Fundação` … `Plano 7 — …`, `Coordenação` |
| Agente | text | Identificador de quem pegou a tarefa. Vazio = livre |
| Claim em | date | Momento em que o agente pegou a tarefa |
| Ordem | number | Ordem de execução dentro da Fase |
| Depende de | text | Tarefas que precisam estar `Concluído` antes (ex.: `T6`) |
| Notas | text | Contexto, motivo de bloqueio, commit relacionado |
| ID | id (`SF-n`) | Identificador estável gerado pelo Notion |

## Regras

### 1. Partição por Fase

A defesa principal contra colisão é **um agente por Fase**. Antes de começar, um
agente anuncia no board qual Fase vai tocar (pega a primeira tarefa `A fazer` dela).
Outro agente escolhe uma Fase diferente sempre que possível. Só entra numa Fase já
ocupada se as tarefas restantes dela não tiverem dependência com o que o outro
agente está fazendo.

### 2. Ordem e dependências

Dentro de uma Fase, executar por `Ordem` crescente. Não pegar uma tarefa cujo
`Depende de` aponta para tarefa que ainda não está `Concluído`.

### 3. Pegar uma tarefa (claim)

O Notion não tem transação. O protocolo de claim é otimista com verificação:

1. Escolher uma tarefa com `Status` = `A fazer` e `Agente` vazio.
2. Atualizar a página: `Agente` = seu identificador, `Status` = `Em andamento`,
   `Claim em` = agora (ISO 8601).
3. Esperar **5 segundos**.
4. Reler a página. Se `Agente` == seu identificador e `Claim em` == o valor que
   você escreveu, o claim é seu. Caso contrário, outro agente ganhou a corrida —
   reverter mentalmente (não editar) e escolher outra tarefa.

### 4. Enquanto trabalha

- `Em andamento` **trava** a tarefa. Nenhum outro agente edita ou pega.
- Se precisar parar sem terminar: voltar `Status` para `A fazer`, limpar `Agente`
  e `Claim em`, registrar o progresso em `Notas`.

### 5. Terminar

- Trabalho feito e commitado, aguardando revisão → `Status` = `Em revisão`.
- Revisão aprovada → `Status` = `Concluído`, `Notas` recebe o(s) hash(es) de commit.
- Impedido por fator externo (ex.: falta Docker, falta credencial) → `Status` =
  `Bloqueado`, motivo em `Notas`, `Agente` continua preenchido para rastreio.

### 6. Identificador de agente

Usar um identificador estável e único por agente, por exemplo o nome da sessão do
Claude Code (`claude-<slug>`), ou `agente-1` / `agente-2` / `agente-3` combinados
entre a equipe. Nunca reusar o identificador de outro agente.

## Relação com o ledger SDD

Quem executa um plano via `superpowers:subagent-driven-development` mantém também o
ledger fino em `.superpowers/sdd/<plano>/progress.md` (git-ignored). O board Notion
é a camada **grossa** de coordenação entre agentes (nível de tarefa e de Fase); o
ledger é o registro **detalhado** de execução de um plano por um agente. Em caso de
divergência, o board manda para "quem pode pegar o quê"; o ledger manda para "o que
já foi feito e revisado dentro do plano".

## Estado atual (2026-09-08)

- **Plano 1 — Fundação:** T1 `Concluído` (commit `c895526`). T2 `Bloqueado` —
  Docker Desktop não instalado no host; steps de arquivo commitados em `d9c4f6e`,
  falta rodar `pnpm db:start` + `pnpm db:test`. T3–T25 `A fazer`, todas dependem de
  Docker.
- **Planos 2–7:** placeholders em `Backlog`; os planos de implementação detalhados
  serão escritos quando o Plano 1 concluir.
