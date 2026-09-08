# Fluxo Git — Serviço Feito

## Branches

| Branch | Papel | Regras |
|---|---|---|
| `main` | Produção | Protegida. Só recebe merge de `homolog` via PR. Deploy de prod parte daqui. |
| `homolog` | Homologação / staging | Tudo passa por aqui antes de `main`. Feature branches fazem PR para `homolog`. |
| `<feature>` | Trabalho em andamento | Ex.: `fundacao-monorepo-supabase`. Criada a partir de `homolog`. PR para `homolog` quando o plano/tarefa fecha. |

Fluxo: `<feature>` → PR → `homolog` → (validação) → PR → `main`.

## Histórico

O repositório remoto foi criado com um commit inicial `4ab4dfc` (README de 1 linha),
sem relação com o histórico de trabalho. Esse commit foi **descartado**: `main` foi
resetado (force-push único) para o histórico local, que carrega a spec, os planos e a
implementação. `homolog` nasceu do tip da branch `fundacao-monorepo-supabase` em
2026-09-08 (commit `5835402`, com Tasks 1–3 e 25 do Plano 1 da Fundação).

## Convenções

- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `ci:`, `test:`).
- Rodapé dos commits desta automação:
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`
- `git config user` local: `VitorHugoVH` / `vhfraga007@gmail.com`.
- Conta GitHub com escrita em `ServicoFeito/Mobile`: `VitorHugoVH`.
- Nunca commitar `.env`, `*.p12`, `*.pem` (bloqueados no `.gitignore`).

## Setup de push (uma vez)

O Git Credential Manager pode estar com a credencial de outra conta
(`vitorhugo-sudo`, sem escrita). Para corrigir:

```
printf "protocol=https\nhost=github.com\n\n" | git credential-manager erase
```

ou remover `git:https://github.com` no Windows Credential Manager. No próximo
`git push`, autenticar como `VitorHugoVH`.

## Primeira publicação (após corrigir o push)

```
git push -f origin main        # main = histórico local; descarta 4ab4dfc
git push -u origin homolog
git push -u origin fundacao-monorepo-supabase
```
