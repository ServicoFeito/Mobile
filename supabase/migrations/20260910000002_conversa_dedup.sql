-- Plano 4 — uma conversa por (demanda, prestador) e uma por (cliente, prestador) direta.
-- O repo faz find-or-create; estes indices sao a autoridade sob corrida.

create unique index conversas_demanda_prestador_uniq
  on public.conversas (demanda_id, prestador_id)
  where tipo = 'DEMANDA';

create unique index conversas_direta_par_uniq
  on public.conversas (cliente_id, prestador_id)
  where tipo = 'DIRETA';
