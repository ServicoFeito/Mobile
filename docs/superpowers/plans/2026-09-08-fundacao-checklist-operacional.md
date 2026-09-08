# Fundação — Checklist operacional (ações manuais)

Estas ações são feitas nos painéis da Supabase e da EFI, não no código.
Nenhuma bloqueia os Planos 2–5. As de pagamento bloqueiam o Plano 6.

## Projetos Supabase

- [ ] Criar projeto Supabase **dev** `servico-feito-dev` (org do Serviço Feito). **Pré-requisito da Task 2** — feito antes da execução retomar. Guardar `Project ref` e `Database Password`.
- [ ] `supabase login` na máquina; `.env` da raiz com `SUPABASE_PROJECT_REF`, `SUPABASE_DB_URL`, `SUPABASE_DB_PASSWORD`.
- [ ] GitHub do repo: secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_URL`, `SUPABASE_DB_PASSWORD` + variable `SUPABASE_PROJECT_REF` (para o CI da Task 24).
- [ ] Preencher `.env` local com `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` do projeto dev (para o Plano 2).
- [ ] Criar projeto Supabase **prod** só no lançamento; mesmas migrations via `supabase db push`.

> As duas primeiras linhas são pré-requisito da Task 2 e o executor confirma que
> foram feitas antes de rodar `pnpm db:link`. As demais não bloqueiam os Planos 2–5.

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
