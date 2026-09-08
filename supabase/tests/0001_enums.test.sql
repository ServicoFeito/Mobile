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
