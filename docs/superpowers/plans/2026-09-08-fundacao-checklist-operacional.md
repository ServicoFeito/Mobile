# Fundação — Checklist operacional (ações manuais)

Estas ações são feitas nos painéis da Supabase e da EFI, não no código.
Nenhuma bloqueia os Planos 2–5. As de pagamento bloqueiam o Plano 6.

## Projetos Supabase

- [ ] Criar projeto Supabase **dev** `servico-feito-dev` (org do Serviço Feito). **Pré-requisito da Task 2** — feito antes da execução retomar. Guardar `Project ref` e `Database Password`.
- [ ] `supabase login` na máquina; `.env` da raiz com `SUPABASE_PROJECT_REF`, `SUPABASE_DB_URL`, `SUPABASE_DB_PASSWORD`.
- [ ] GitHub do repo: secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_URL`, `SUPABASE_DB_PASSWORD` + variable `SUPABASE_PROJECT_REF` (para o CI da Task 24).
- [ ] Preencher `.env` local com `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` do projeto dev (para o Plano 2).
- [x] Criar projeto Supabase **prod** `servico-feito-prod` (ref `wauukcijogycavbtkihc`, sa-east-1). **2026-09-09.** As 21 migrations aplicadas via `supabase db push --linked` (`Finished supabase db push.`). Credenciais em `.env.prod` (git-ignored). Worktree re-linkada ao dev depois.
      - ⚠️ **PENDÊNCIA CRIADA:** o push levou `20260908135547_test_helpers.sql` (schema `tests`) para prod — ver seção "Schema tests" abaixo. Prod ainda não tem tráfego / o app aponta pro dev, então não é emergência, mas resolver antes do launch.

> As duas primeiras linhas são pré-requisito da Task 2 e o executor confirma que
> foram feitas antes de rodar `pnpm db:link`. As demais não bloqueiam os Planos 2–5.

## Rotação de segredos vazados (repo Kotlin em docs/arquitetura-antiga/)

- [ ] Revogar / rotacionar a chave `service_role` do projeto antigo `yaqmivazqarfkggypuow`
      (arquivo `.../data/remote/supabase/SupabaseConfig.kt`). O projeto antigo será descartado.
- [x] **DECISÃO DO USUÁRIO (2026-09-11): NÃO rotacionar** `CLIENT_ID` / `CLIENT_SECRET` de
      homologação e produção da EFI (arquivo `.../data/remote/efi/EfiConfig.kt`) nem gerar
      novos certificados `.p12`. Risco foi explicado (o par vazado no histórico do repo Kotlin
      dá acesso permanente de cobrança Pix em nome da empresa a quem já tiver pego o
      vazamento, até ser revogado no painel EFI) e aceito explicitamente pelo usuário. Os
      **mesmos** valores (`CLIENT_ID_HOMOLOG`/`CLIENT_ID_PROD`/certs `homologacao.p12`/
      `producao.p12`) serão usados no Plano 6. Não repetir esse alerta em sessões futuras
      a menos que o usuário peça pra reconsiderar.
- [x] Confirmar que `.gitignore` bloqueia `*.p12` / `*.pem` / `.env` (feito na Task 1;
      reconfirmado 2026-09-11).
- [ ] Guardar os valores (os mesmos, por decisão acima) só como Supabase secrets no Plano 6
      (`EFI_CLIENT_ID`, `EFI_CLIENT_SECRET`, `EFI_CERT_P12_BASE64`, `EFI_WEBHOOK_TOKEN`,
      `PLATFORM_PIX_KEY`). Nunca no repositório.

## Secrets EFI (Plano 6)

- [ ] **Após merge do Plano 6**, executar:
      ```bash
      supabase secrets set \
        EFI_CLIENT_ID=... EFI_CLIENT_SECRET=... \
        EFI_CERT_P12_BASE64="$(base64 -w0 caminho/para/homologacao.p12)" \
        EFI_WEBHOOK_TOKEN=... PLATFORM_PIX_KEY=app.servicofeito@gmail.com
      ```
      - Valores `EFI_CLIENT_ID`, `EFI_CLIENT_SECRET`, `homologacao.p12`: os mesmos já vazados no
        repo Kotlin (`docs/arquitetura-antiga/.../EfiConfig.kt`). **Não rotacionar** — decisão
        registrada acima.
      - `EFI_WEBHOOK_TOKEN`: valor **novo**, não existia no app Kotlin. Gerar um token aleatório
        qualquer no momento de registrar a URL do webhook no painel EFI e inserir aqui.
      - `PLATFORM_PIX_KEY`: chave Pix da conta EFI (exemplo: `app.servicofeito@gmail.com`).

## Schema tests (pgTAP)

**STATUS 2026-09-09:** o schema `tests` FOI para o prod (o `db push` aplicou
`20260908135547_test_helpers.sql`). A decisão abaixo deixou de ser "antes de prod"
e virou "corrigir no prod + impedir reincidência".

- [ ] **Imediato (fazer antes do app apontar pro prod):** no dashboard do prod
      (`wauukcijogycavbtkihc`) → **SQL Editor** → rodar `drop schema if exists tests cascade;`.
      Isso cria drift schema×migrations SÓ no prod — o check de drift do CI roda contra o
      **dev** (`SUPABASE_PROJECT_REF`), então não quebra o CI. Anotar aqui quando feito.
- [ ] **Definitivo (follow-up do Plano 1):** mover o conteúdo de
      `20260908135547_test_helpers.sql` para um setup aplicado pelo runner
      `supabase/tests/run.mjs` (cria o schema `tests` no início de cada rodada, contra o
      dev, fora do histórico de migrations) e apagar essa migration. Assim um `db push`
      futuro pra qualquer ambiente novo (staging, outro prod) não reintroduz o schema.
      Os 22 arquivos pgTAP em `supabase/tests/*.test.sql` continuam chamando `tests.*` —
      o runner passa a garantir que o schema existe antes deles.
- Motivo: `create_supabase_user` / `authenticate_as` escrevem em `auth.users` e não
  podem ficar executáveis em prod. (As migrations 20260908200154 já revogaram execução
  de anon/authenticated nos helpers exceto 2 read-only — mitigação parcial, não suficiente.)
