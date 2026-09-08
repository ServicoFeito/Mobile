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
