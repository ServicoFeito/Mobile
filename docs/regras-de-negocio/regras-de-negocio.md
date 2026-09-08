# Serviço Feito — Contexto, Funcionalidades e Regras de Negócio

Documento consolidado do projeto Serviço Feito, reunindo a ideia do aplicativo, público, modelo de negócio, funcionalidades, fluxos, validação e estrutura de dados discutidos.

## Visão Geral
* A **Serviço Feito** é uma plataforma digital de intermediação entre clientes e prestadores de serviços. O objetivo é facilitar a descoberta, comparação, comunicação e contratação de serviços com mais segurança e organização.
* O marketplace possui dois lados: clientes que precisam contratar serviços e prestadores autônomos, MEIs ou pequenas empresas que desejam conquistar clientes.
* Exemplos de categorias: diaristas, limpeza pós-obra, jardineiros, pedreiros, eletricistas, pintores, mecânicos e outros serviços.

## Modelo de Usuário e Navegação
* O usuário possui uma conta unificada, sem precisar escolher 'cliente' ou 'prestador' no login.
* Um usuário pode contratar serviços e também atuar como prestador caso tenha seu perfil de prestador cadastrado.
* **Modo 'Quero Contratar':** Início, Buscar, Prestadores, Mensagens e Perfil.
* **Modo 'Quero Prestar Serviço':** Início, Buscar, Trabalhos, Mensagens e Perfil.
* **Funcionalidades centrais:** criação de demandas, busca/filtros, perfis, chat, propostas, contratação, pagamentos, avaliações e notificações.

## Demandas, Chat e Propostas
* Cliente pode criar uma demanda descrevendo o serviço, categoria, local/endereço e informações necessárias.
* Uma demanda pode receber propostas de vários prestadores.
* Cada prestador deve possuir uma conversa privada com o cliente; propostas e negociações de outros prestadores não devem ser expostas.
* Existem dois tipos de conversa: 
  * **DEMANDA:** vinculada a uma demanda específica.
  * **DIRETA:** iniciada entre cliente e prestador sem demanda.
* Uma conversa direta pode ter demanda NULL. Isso permite contato a partir do perfil do prestador.
* **Status de conversa recomendados:** ATIVA, ENCERRADA e BLOQUEADA. ARQUIVADA pode ser adicionada futuramente.
* Mensagens podem evoluir de texto para imagens, arquivos, áudio, vídeo, localização e mensagens de sistema.
* Proposta é uma entidade própria, vinculada à demanda, prestador e conversa. Pode conter valor, descrição, prazo e validade.
* **Status de proposta:** ENVIADA, VISUALIZADA, ACEITA, RECUSADA, CANCELADA e EXPIRADA.

## Contratação, Pagamento e Avaliação
* **Fluxo principal:** Demanda → Conversa → Proposta → Aceite → Contratação → Execução → Pagamento → Avaliação.
* Contratação deve registrar cliente, prestador, demanda, proposta, valor, datas e status.
* **Status de contratação:** AGUARDANDO_PAGAMENTO, AGENDADA, EM_ANDAMENTO, CONCLUIDA e CANCELADA.
* O plano de negócio considera pagamento em duas etapas: 50% antes da execução e 50% após a execução.
* Pagamentos pertencem à contratação e devem registrar valor, tipo, status, gateway e identificador da transação.
* **Tipos de pagamento previstos:** ENTRADA e FINAL.
* Avaliações devem ser entidades próprias associadas à contratação, permitindo avaliação cliente → prestador e, futuramente, prestador → cliente.

## Prestadores
* Um prestador pode atuar em várias categorias; por isso, prestador e categoria possuem relação N:N através de `prestador_categoria`.
* **Categoria** representa a área de atuação; **serviço** representa aquilo que o profissional efetivamente oferece.
* Pode ser criada futuramente a entidade `servicos_prestador` com nome, descrição, categoria, preço-base e status.
* O perfil pode conter portfólio, disponibilidade, certificados/licenças e dados profissionais.
* CNPJ/MEI pode ser utilizado como elemento de confiança quando disponível, conforme as regras definidas pelo negócio.

## Monetização
* A principal receita planejada é a taxa de intermediação de **20% por serviço**.
* Também foram consideradas receitas de anúncios internos, comissão com empresas e plano premium.
* O plano premium pode oferecer recursos como experiência sem anúncios.
* Publicidade pode ser vendida a empresas em planos mensais ou anuais.

## Público e Proposta de Valor
* **Cliente ideal:** é uma pessoa que precisa contratar serviços para residência ou negócio e valoriza segurança, confiança, praticidade, rapidez, transparência e facilidade de comunicação.
* **Prestadores:** são autônomos, MEIs e pequenas empresas que desejam aumentar visibilidade, receber oportunidades e conquistar clientes.
* **Para clientes:** a plataforma reduz a dificuldade de encontrar profissionais e permite comparar propostas.
* **Para prestadores:** a plataforma funciona como canal adicional de aquisição de clientes e organização das oportunidades.

## Validação de Mercado
* A validação pode ser feita por conversas individuais no WhatsApp, entrevistas presenciais, testes de uso e um concierge MVP.
* Perguntas para prestadores devem abordar como conseguem clientes, dificuldades de divulgação, frequência de trabalho, interesse em receber oportunidades e situação de CNPJ/MEI.
* Um **concierge MVP** pode intermediar manualmente serviços e medir demandas, respostas, propostas e contratações.
* Uma landing page pode medir cadastros antecipados e interesse.
* Para incentivar prestadores a participar da pesquisa, podem ser oferecidos cadastro prioritário, selo Prestador Fundador e/ou destaque gratuito no lançamento.

## Estrutura de Banco de Dados
* **Entidades principais:** `usuarios`, `perfil_cliente`, `perfil_prestador`, `enderecos_usuario`, `categoria_servico`, `prestador_categoria`, `demandas_servico`, `tarefas_demanda`, `conversas`, `participantes_conversa`, `mensagens`, `anexos_mensagem`, `propostas`, `contratacoes`, `pagamentos`, `avaliacoes` e `notificacoes`.
* **Relacionamento central:** 
  * usuário → demanda → conversas → mensagens
  * demanda → propostas → contratação → pagamentos/avaliações
* Chat direto utiliza conversa sem demanda vinculada.
* `participantes_conversa` permite controlar quem participa de cada conversa.
* Arquivos podem ficar no Supabase Storage, com seus metadados no banco.

## Regras de Negócio Essenciais
* **RB01** — Conta unificada; usuário pode ser cliente e/ou prestador.
* **RB02** — Demanda pertence a um cliente e pode receber propostas de vários prestadores.
* **RB03** — Negociação entre cliente e prestador é privada.
* **RB04** — Conversa pode ser DEMANDA ou DIRETA.
* **RB05** — Conversa DIRETA não exige demanda.
* **RB06** — Proposta pertence a uma demanda, prestador e conversa.
* **RB07** — Aceite de proposta gera contratação.
* **RB08** — Contratação controla o ciclo de execução.
* **RB09** — Pagamentos pertencem à contratação.
* **RB10** — Avaliações pertencem a uma contratação.
* **RB11** — Prestador pode pertencer a várias categorias.
* **RB12** — Histórico de mensagens e eventos relevantes deve ser preservado.
* **RB13** — Supabase deve usar autenticação e Row Level Security (RLS) para proteger os dados.
* **RB14** — Cliente não acessa conversas ou propostas privadas de outros prestadores.
* **RB15** — Prestador não acessa negociações privadas de outros prestadores.
* **RB16** — Status da contratação controla as ações disponíveis.
* **RB17** — MVP deve priorizar descoberta, demanda, conversa, proposta e contratação.

## Fluxos
* **Fluxo principal:** Cliente cria demanda → prestadores visualizam → prestador inicia conversa → conversa → proposta → cliente compara → aceita uma proposta → contratação → pagamento inicial → execução → conclusão → pagamento final → avaliação.
* **Fluxo alternativo:** Cliente encontra prestador → inicia conversa direta → negocia → cria/vincula demanda se necessário → proposta → contratação.

## Decisões e Pontos Futuros
* Definir política de cancelamento e reembolso.
* Definir exatamente quando e de quem será cobrada a taxa de 20%.
* Definir regras para prestadores sem CNPJ e verificação documental.
* Definir denúncia, bloqueio, moderação e disputas.
* Definir gateway de pagamento e regras de repasse.
* Definir critérios de ranqueamento na busca.
* Definir regras de disponibilidade, distância e serviços emergenciais.
* Definir política de privacidade, termos de uso e tratamento de dados.
* A tecnologia deve ser escolhida em função do MVP e do prazo; uma web app responsiva pode ser usada para validação antes de um aplicativo mobile definitivo.

## Resumo Executivo
A Serviço Feito é um marketplace de serviços baseado em conta unificada. O núcleo do produto é o ciclo **Demanda → Conversa privada → Proposta → Contratação → Pagamento → Avaliação**. O sistema também permite conversa direta entre cliente e prestador sem demanda. O MVP deve concentrar-se nesse ciclo, validar o problema com clientes e prestadores reais e evoluir funcionalidades secundárias conforme os resultados.
