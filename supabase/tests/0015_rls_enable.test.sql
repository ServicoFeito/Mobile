begin;
select plan(19);

select ok(tests.rls_enabled('public', 'usuarios'),                  'RLS: usuarios');
select ok(tests.rls_enabled('public', 'perfil_prestador'),          'RLS: perfil_prestador');
select ok(tests.rls_enabled('public', 'portfolio_prestador'),       'RLS: portfolio_prestador');
select ok(tests.rls_enabled('public', 'disponibilidade_prestador'), 'RLS: disponibilidade_prestador');
select ok(tests.rls_enabled('public', 'licencas_certificados'),     'RLS: licencas_certificados');
select ok(tests.rls_enabled('public', 'categoria_servico'),         'RLS: categoria_servico');
select ok(tests.rls_enabled('public', 'prestador_categoria'),       'RLS: prestador_categoria');
select ok(tests.rls_enabled('public', 'enderecos_usuario'),         'RLS: enderecos_usuario');
select ok(tests.rls_enabled('public', 'demandas_servico'),          'RLS: demandas_servico');
select ok(tests.rls_enabled('public', 'tarefas_demanda'),           'RLS: tarefas_demanda');
select ok(tests.rls_enabled('public', 'conversas'),                 'RLS: conversas');
select ok(tests.rls_enabled('public', 'participantes_conversa'),    'RLS: participantes_conversa');
select ok(tests.rls_enabled('public', 'mensagens'),                 'RLS: mensagens');
select ok(tests.rls_enabled('public', 'anexos_mensagem'),           'RLS: anexos_mensagem');
select ok(tests.rls_enabled('public', 'propostas'),                 'RLS: propostas');
select ok(tests.rls_enabled('public', 'contratacoes'),              'RLS: contratacoes');
select ok(tests.rls_enabled('public', 'pagamentos'),                'RLS: pagamentos');
select ok(tests.rls_enabled('public', 'avaliacoes'),                'RLS: avaliacoes');
select ok(tests.rls_enabled('public', 'notificacoes'),              'RLS: notificacoes');

select * from finish();
rollback;
