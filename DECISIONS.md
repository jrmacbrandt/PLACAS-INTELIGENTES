# DECISIONS.md — REGISTRO DE DECISÕES DE ARQUITETURA E NEGÓCIO (ADRs)

Este documento registra todas as decisões formais aprovadas pelo proprietário do projeto, suas justificativas, alternativas analisadas e impactos operacionais.

---

## ADR 001 — Camada de Persistência e Compatibilidade com Supabase
- **Data de Aprovação:** 2026-10-26
- **Status:** Aprovado pelo Proprietário
- **Contexto:** Necessidade de persistência relacional com integridade referencial, transações atômicas e políticas de segurança RLS (Row Level Security), com previsão de uso do Supabase.
- **Decisão:** Modelar todo o banco relacional em PostgreSQL puro (com tabelas, chaves estrangeiras, restrições e políticas RLS prontas para o Supabase) executando sobre a camada Express do projeto para desenvolvimento, testes e homologação imediatos, permitindo transição contínua para o Supabase de produção.
- **Alternativas Consideradas:** Aguardar provisionamento manual de projeto Supabase externo antes de iniciar qualquer código.
- **Consequências:** Permite desenvolvimento autônomo, execução imediata de testes automatizados e suíte de integridade no ambiente do Google AI Studio, sem bloquear a evolução técnica.

---

## ADR 002 — Tabela de Preço Global e Faixas de Volume
- **Data de Aprovação:** 2026-10-26
- **Status:** Aprovado pelo Proprietário
- **Contexto:** Definição da política de precificação de aquisição das placas físicas pelos revendedores e parceiros comerciais.
- **Decisão:** A precificação global padrão de aquisição das placas será:
  - **1 a 9 unidades:** R$ 21,90 por placa.
  - **10 a 49 unidades:** R$ 19,90 por placa.
  - **50 ou mais unidades:** R$ 17,90 por placa.
  - **Quantidade mínima:** 1 unidade.
  - O administrador pode alterar estes valores a qualquer momento no painel de configurações.
  - Preços individuais de revendedores ou parceiros (quando configurados) prevalecem sobre o preço global.
  - Cada pedido salva uma **fotografia imutável** (snapshot) do preço unitário contratado, quantidade e valor total no momento da criação.
- **Alternativas Consideradas:** Preço único sem desconto por volume ou preços arbitrários.
- **Consequências:** Clareza comercial para os revendedores, incentivo à compra em escala e previsibilidade contábil.

---

## ADR 003 — Procedimento de Retirada e Comunicação via WhatsApp
- **Data de Aprovação:** 2026-10-26
- **Status:** Aprovado pelo Proprietário
- **Contexto:** Definição das regras operacionais quando o revendedor seleciona a modalidade de entrega "Retirada".
- **Decisão:**
  1. Quando a modalidade escolhida for **Retirada**, o sistema instruirá o revendedor a **entrar em contato via WhatsApp com a equipe da empresa** para combinar detalhes e agendamento da entrega física.
  2. O tipo de entrega selecionado (Retirada ou Correios) poderá ser **alterado pelo Administrador diretamente no painel administrativo**, com registro de auditoria (data, hora, responsável e motivo).
  3. A placa ou pedido só poderá ser marcado como "Entregue/Retirado" após confirmação operacional de um operador autorizado.
- **Alternativas Consideradas:** Agendamento automatizado de horário em calendário na v1 ou bloqueio de alteração de entrega.
- **Consequências:** Processo humano ágil e adaptável para retirada local, sem complexidade de agendamento prematuro.

---

## ADR 004 — Modelo Comercial Unificado ("Todos são Revendedores" - v5.0)
- **Data de Aprovação:** 2026-10-26
- **Status:** Aprovado (Diretriz Prompt Mestre v5.0)
- **Contexto:** Eliminação de redundâncias arquiteturais entre revendedores independentes e vendedores da equipe interna.
- **Decisão:** Vendedores internos utilizam o mesmo portal comercial e a mesma tabela de perfil de revendedor, diferenciados pelo atributo `tipo_parceiro = 'equipe_interna'`. A aprovação da reserva comercial pelo Administrador autoriza a fabricação sem exigir pagamento prévio do vendedor.
- **Consequências:** Código único, interface consistente, sem duplicação de regras ou tabelas de banco.

---

## ADR 005 — Gestão e Ativação Individual de Placas (Adendo v5.0)
- **Data de Aprovação:** 2026-10-26
- **Status:** Aprovado (Diretriz Adendo v5.0)
- **Contexto:** Controle unitário de placas físicas, QR Code e NFC.
- **Decisão:** Cada placa possui identificador único, token criptográfico inviolável na URL `/r/:token` e controle alternável exclusivo na UI ("Ativar placa" / "Desativar placa"). Salvar configuração não ativa a placa. Desativar bloqueia o redirecionamento público sem apagar dados ou histórico.
- **Consequências:** Garantia de segurança contra fraudes, autonomia total do revendedor sobre cada unidade e preservação histórica de acessos.

---

## ADR 006 — Geração Antecipada de QR Codes e Atribuição de Intervalo por Pedido
- **Data de Aprovação:** 2026-10-28
- **Status:** Aprovado pelo Proprietário
- **Contexto:** Necessidade de adiantar a fabricação física das placas (corte acrílico, gravação a laser da numeração e montagem do NFC) mesmo antes de receber pedidos específicos, mantendo estoque a pronta-entrega e associando a numeração sequencial quando o pedido chegar.
- **Decisão:**
  1. **Item de Menu "Gerar QR Codes":** Disponível no Painel de Gestão e no Drawer administrativo para emissão antecipada de lotes avulsos em estoque sem vínculo imediato a pedidos (`order_id = NULL`).
  2. **Numeração Monotônica e Estrita:** Cada placa física gerada recebe número sequencial indelével e irreversível (`PLK-XXXXXX`), sem risco de duplicação.
  3. **Download Individual e em Lote:** O nome do arquivo exportado para gravação a laser contém estritamente o código sequencial individual: `QRCode_${plate.codigo_sequencial}.png`.
  4. **Dois Campos de Intervalo no Pedido ("Pedidos Recebidos"):** Cada pedido recebido exibe os campos `placa_codigo_inicial` e `placa_codigo_final`.
     - Se o operador clicar em **"Gerar / Baixar QR Codes"** diretamente no pedido, os campos são preenchidos automaticamente com a faixa gerada.
     - Se o operador quiser destinar placas previamente fabricadas (do estoque antecipado), ele pode informar o intervalo e clicar em **"Atribuir Placas"**, que valida a quantidade exata do pedido e a disponibilidade das unidades.
- **Consequências:** Agilidade extrema na logística de pronta-entrega, rastreabilidade completa de fábrica até o revendedor final e conformidade 100% com as diretrizes do projeto.

---

## ADR 007 — Segregação de Modalidades: Revendedores via Correios e Vendedores Internos com Retirada Balcão Isenta
- **Data de Aprovação:** 2026-10-30
- **Status:** Aprovado pelo Proprietário
- **Contexto:** Necessidade de simplificar a entrada de revendedores externos no site público (eliminando a escolha de retirada no balcão e padronizando o despacho postal com rastreamento) e criar um canal administrativo dedicado para a equipe comercial interna da empresa, onde os pedidos não exigem cobrança via gateway de pagamento (Asaas) e a entrega é exclusivamente realizada por retirada presencial.
- **Decisão:**
  1. **Cadastro Público:** A tela inicial e o modal de cadastro público de revendedores não exibem mais a opção de retirada presencial. Todo novo revendedor cadastrado pelo site público é configurado com preferência de entrega `correios`.
  2. **Aba "Vendedores Internos" no Painel Administrativo:** Área exclusiva no Painel Admin para o gestor cadastrar membros da equipe interna (`tipo_parceiro = 'equipe_interna'`) e emitir pedidos internos com valor R$ 0,00 diretamente para a esteira fabril.
  3. **Isenção de Pagamento:** Pedidos de vendedores internos nascem autorizados para fabricação, sem passar por checkout ou gateway Asaas.
  4. **Esteira Fabril Unificada:** Tanto pedidos de revendedores quanto de vendedores internos seguem rigorosamente a mesma esteira produtiva (pedidos recebidos -> atribuição ou geração de QR Codes sequenciais -> início de lote sob demanda -> controle de qualidade). Ao final da esteira, pedidos de revendedores vão para a fila de despacho dos Correios (com etiqueta e OCR) e pedidos de vendedores internos vão para a fila de Retirada Presencial no Balcão com baixa operacional em 1 clique.
- **Consequências:** Clareza total para o cliente e revendedor externo, agilidade operacional para a equipe interna de vendas e rastreabilidade total do inventário.

---

## ADR 008 — Exclusão Total de Pedidos da Esteira com Diálogo de Confirmação e Gestão de Placas
- **Data de Aprovação:** 2026-10-30
- **Status:** Aprovado pelo Proprietário
- **Contexto:** Necessidade operacional de permitir ao Administrador cancelar e apagar totalmente pedidos em qualquer etapa da esteira ("Pedidos Recebidos", "Placas em Produção" e "Despacho e Retirada"), prevenindo erros e desperdício de acrílico já gravado.
- **Decisão:**
  1. **Botão de Opções `(...)`:** Inserido no canto superior direito de cada card de pedido em todas as fases da esteira.
  2. **Caixa de Diálogo de Confirmação:** Ao acionar "Excluir Pedido", um modal de alta visibilidade exibe resumo do pedido, aviso de irreversibilidade e opção seletiva:
     - *Devolver placas ao Estoque Livre (Padrão/Recomendado):* Desvincula as numerações `PLK-XXXXXX` já gravadas para que voltem à aba de estoque antecipado, permitindo que a fábrica reaproveite o material físico em outros pedidos.
     - *Excluir Placas Definitivamente:* Remove completamente o pedido e suas placas do banco.
  3. **Limpeza em Cascata:** A exclusão remove de forma segura e atômica registros de `orders`, `order_logistics`, `manufacturing_orders`, `payments` e `inspections`, registrando a ação no histórico de auditoria.
- **Consequências:** Autonomia completa para o gestor eliminar pedidos de teste ou cancelados, sem perda de placas físicas já cortadas ou gravadas e com integridade referencial mantida.




---

## ADR 009 — Exclusão em Massa de Pedidos na Aba "Todos" com Seleção por Checkbox
- **Data de Aprovação:** 2026-10-30
- **Status:** Aprovado pelo Proprietário
- **Contexto:** Necessidade operacional de permitir a seleção múltipla e exclusão em massa de pedidos com apenas 1 clique, exclusivamente na visualização geral ("Todos") de "Pedidos Recebidos", mantendo as abas filtradas livres de poluição visual.
- **Decisão:**
  1. **Restrição de Escopo:** Checkboxes individuais nos cards, o checkbox mestre de "Selecionar Todos" e os botões de ação em massa são renderizados estritamente quando o filtro ativo for "Todos" (`receivedFilter === 'todos'`).
  2. **Controle de Seleção Flexível:** O operador pode marcar individualmente pedidos através de checkboxes nos cards ou selecionar/deselecionar todos automaticamente via checkbox mestre no topo da lista. Cards selecionados recebem destaque visual (anel azul e sutil sombreamento).
  3. **Barra Flutuante de Ações:** Ao marcar um ou mais pedidos, uma barra flutuante surge no rodapé com o resumo de pedidos e placas selecionadas, botão "Limpar" e botão "Excluir Selecionados".
  4. **Caixa de Diálogo de Confirmação em Massa:** Exibe resumo consolidado de todos os pedidos selecionados (numerações, total de placas e valor consolidado), opção de devolver placas ao Estoque Livre vs excluir definitivamente, e botão de confirmação com indicador de progresso.
  5. **Endpoint Dedicado (`POST /api/orders/bulk-delete`):** Executa a exclusão atômica em cascata de todos os pedidos selecionados, reaproveitando ou destruindo as placas conforme a opção do usuário e registrando log detalhado em `audit_logs`.
- **Consequências:** Operação de limpeza de pedidos em escala extremamente rápida e segura, sem risco de apagar pedidos acidentalmente e com total coerência visual e funcional com o padrão da aplicação.

---

## ADR 010 — Integração Multi-Transportadoras com Melhor Envio para Cotação Inteligente e Emissão de Etiquetas
- **Data de Aprovação:** 2026-10-31
- **Status:** Aprovado pelo Proprietário
- **Contexto:** Necessidade de oferecer fretes significativamente mais baratos aos revendedores no checkout com múltiplos operadores logísticos (Jadlog, Correios e Loggi) com descontos corporativos de até 80%, além de permitir ao administrador emitir e imprimir etiquetas oficiais de envio com código de barras em 1 clique na aba de Despacho.
- **Decisão:**
  1. **Serviço de Logística Centralizado (`server/services/melhor-envio.ts`):**
     - Comunicação com a API v2 do Melhor Envio (`/api/v2/me/shipment/calculate`, `/api/v2/me/cart`, `/api/v2/me/shipment/checkout`, `/api/v2/me/shipment/print`).
     - Cálculo volumétrico preciso baseado na contagem de placas de acrílico (60g/placa + tag NFC, dimensões empilháveis com altura escalável).
     - Modo Híbrido Resiliente: Quando `MELHOR_ENVIO_TOKEN` estiver preenchido no ambiente, comunica diretamente com os servidores da transportadora; na ausência da chave, executa simulação hiper-realista com base nas faixas de CEP e tarifas corporativas de mercado para Jadlog (.Package e .Com), Correios (PAC e SEDEX) e Loggi (Express).
  2. **Seletor de Frete Interativo no Portal do Revendedor (`ResellerPortal.tsx`):**
     - Consulta automática de frete ao digitar o CEP (8 dígitos) ou alterar a quantidade de placas.
     - Cards comparativos destacando a melhor opção ("Mais Barato" e "Mais Rápido"), prazo em dias úteis, desconto corporativo de até 80% e preço final.
     - Preservação da promoção de frete grátis para pedidos a partir de 20 placas (o revendedor escolhe a transportadora de preferência com custo R$ 0,00).
  3. **Persistência de Dados no Banco de Dados (`order_logistics` e `orders`):**
     - Armazenamento de `transportadora`, `servico_frete`, `servico_frete_id`, `valor_frete`, `prazo_dias`, `melhor_envio_cart_id`, `melhor_envio_order_id` e `etiqueta_url`.
     - Atualização do valor total do pedido com a soma exata do frete selecionado.
  4. **Emissão e Impressão de Etiquetas no Painel Admin (`AdminPortal.tsx`):**
     - Card do pedido na aba Despacho exibe a transportadora, serviço e valor contratado.
     - Botão "Emitir Etiqueta Melhor Envio" gera a pré-postagem e código de rastreamento com 1 clique.
     - Botão "Imprimir Etiqueta" abre etiqueta térmica/A4 com código de barras, remetente Atelier das Placas (Jacarepaguá, RJ) e dados completos do destinatário.
- **Consequências:** Redução drástica do custo de frete para revendedores em todo o Brasil, maior taxa de conversão no checkout, eliminação de retrabalho manual para cadastrar encomendas em agências e emissão instantânea de etiquetas prontas para despacho.

---

## ADR 011 — Preparação da Infraestrutura em Nuvem com Supabase (PostgreSQL & Storage)
- **Data de Aprovação:** 2026-10-31
- **Status:** Aprovado pelo Proprietário
- **Contexto:** Necessidade de preparar a aplicação para produção em nuvem de alta escala, eliminando a dependência exclusiva de disco local efêmero (SQLite) em contêineres, habilitando backups contínuos, painel visual de dados e armazenamento em nuvem para fotos de comprovantes e placas, mantendo a latência ultra-baixa (< 100ms) no redirecionamento de QR Codes dinâmicos.
- **Decisão:**
  1. **Arquitetura Híbrida e Resiliente (`server/services/supabase.ts`):**
     - O sistema opera sem falhas em modo SQLite local quando as variáveis do Supabase ainda não foram fornecidas.
     - Assim que `SUPABASE_URL` e as chaves de API forem inseridas no `.env`, a integração é ativada imediatamente.
  2. **Esquema de Banco de Dados Completo em PostgreSQL (`supabase-schema.sql`):**
     - Criação do script DDL contendo 100% das 12 tabelas relacionais do sistema (`profiles`, `pricing_tiers`, `clients`, `orders`, `order_logistics`, `manufacturing_orders`, `plates`, `inspections`, `destination_history`, `payments`, `webhook_events`, `audit_logs`).
     - Índices de alta performance criados especificamente para leitura de `token_publico` em microssegundos.
     - Carga inicial automática de faixas de precificação e perfil administrador.
  3. **Rotas Administrativas de Monitoramento e Sincronização (`server/routes/admin.ts`):**
     - `GET /api/admin/supabase-status`: Diagnóstico em tempo real da conexão e levantamento de registros locais prontos para nuvem.
     - `POST /api/admin/supabase-test`: Validação de conectividade com a API do Supabase.
     - `POST /api/admin/supabase-sync`: Sincronização e migração em lote de todos os dados do SQLite local para o PostgreSQL do Supabase em 1 clique.
  4. **Interface de Gestão no Painel Admin (`AdminPortal.tsx`):**
     - Card visual em "Preços & Regras" com badge de status ("Pronto para Ativar" vs "Conectado em Nuvem").
     - Modal de instruções passo a passo com indicação de região recomendada: `sa-east-1` (São Paulo, Brasil).
     - Botões de teste e sincronização integrados com feedback ao operador.
  5. **Configuração Desacoplada (`.env.example`):**
     - Variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` devidamente documentadas.
- **Consequências:** Transição para nuvem instantânea sem necessidade de refatorar código, dados protegidos por backups redundantes e total escalabilidade para milhares de placas e revendedores.

---

## ADR 012 — Sistema de Backup & Restauração Completa em Arquivo Único com Horário e Agendamento Automático
- **Data de Aprovação:** 2026-11-01
- **Status:** Aprovado pelo Proprietário
- **Contexto:** Necessidade imperativa de garantir a soberania e segurança máxima dos dados do Atelier das Placas, permitindo ao administrador baixar cópias de segurança completas do banco de dados em um único arquivo com carimbo de data e horário exatos no nome, restaurar o sistema a qualquer momento através do upload desse mesmo arquivo, e programar backups automáticos recorrentes com horários personalizados e política de retenção.
- **Decisão:**
  1. **Nomenclatura com Carimbo Completo de Data e Horário:**
     - Arquivos gerados no padrão: `backup_atelier_das_placas_YYYY-MM-DD_HHhmmss.json`.
     - Permite identificação visual instantânea do minuto e segundo exatos em que a cópia foi extraída.
  2. **Estrutura do Arquivo Único Consolidado (`server/services/backup.ts`):**
     - O arquivo exportado consolida metadados (versão do schema 5.0.0, data ISO e legível, origem manual/automática e hash de integridade SHA-256) e todas as 12 tabelas relacionais do sistema (`profiles`, `pricing_tiers`, `clients`, `orders`, `order_logistics`, `manufacturing_orders`, `plates`, `inspections`, `destination_history`, `payments`, `webhook_events`, `audit_logs`).
  3. **Restauração Atômica e Segura com Validação de Integridade:**
     - A restauração verifica a estrutura do arquivo e a integridade do hash SHA-256 antes de qualquer alteração no disco.
     - Executa todas as deleções e inserções dentro de uma transação exclusiva SQLite (`BEGIN EXCLUSIVE TRANSACTION` / `COMMIT` com `ROLLBACK` automático em caso de erro), garantindo que o banco nunca fique em estado parcial ou corrompido.
     - Diálogo modal de confirmação no painel exibe resumo prévio (data/hora, total de pedidos e placas) e alerta de substituição antes de aplicar a restauração.
  4. **Agendamento de Backups Automáticos Diários:**
     - O administrador define se o agendador está ativo ou inativo, configura os horários diários de execução (ex: 08:00, 12:00, 23:00) e determina a quantidade máxima de arquivos retidos no servidor (política de retenção para evitar esgotamento de disco).
     - Scheduler interno em background (`startBackupScheduler()`) verifica periodicamente os horários e executa as cópias sem interferir nas requisições ativas.
  5. **Item de Menu Dedicado no Painel de Controle (`AdminPortal.tsx` e `Header.tsx`):**
     - Nova aba **"Backup & Restauração"** no menu drawer e barra horizontal com badge de contagem de arquivos salvos.
     - Botão de download imediato em 1 clique (`/api/backup/download-instant`).
     - Tabela de histórico de arquivos salvos com botões de download, restauração direta e exclusão.
  6. **Integração Nativa com Google Drive em 1 Clique (`src/services/googleDrive.ts`):**
     - Autenticação OAuth 2.0 segura no cliente via Firebase Auth (`GoogleAuthProvider`) com escopo de menor privilégio `https://www.googleapis.com/auth/drive.file`.
     - Parâmetro `prompt: 'select_account'` permite ao usuário alternar com 1 clique entre qualquer uma das suas contas Google cadastradas.
     - Seleção de pastas existentes ou criação de novas pastas no Google Drive na hora diretamente pela interface (ex: *Atelier das Placas - Backups*).
     - Upload multipart em nuvem, download para restauração direta com 1 clique e exclusão de arquivos.
     - Política de retenção em nuvem (`cleanOldDriveBackups`): mantém os backups mais recentes e recicla os excedentes automaticamente.
  7. **Seletor de Destino dos Backups Automáticos:**
     - O proprietário escolhe para onde os backups periódicos devem ser direcionados:
       - 💻 **Computador / Servidor Local** (`'local'`): Cópia em disco para download manual a qualquer momento.
       - ☁️ **Google Drive** (`'google_drive'`): Envio direto para a pasta selecionada na nuvem do Google Drive.
       - 🚀 **Ambos** (`'ambos'`): Máxima redundância (cópia no servidor + espelhamento em nuvem no Google Drive).
- **Consequências:** Independência tecnológica total para o proprietário, proteção absoluta contra perdas operacionais, redundância em nuvem sem custos adicionais de infraestrutura e facilidade extrema para restaurar ou migrar a plataforma para qualquer servidor em menos de 10 segundos.

---

## ADR 013 — Pedidos de Equipe Interna na Esteira de Aprovados e Inicialização Padronizada
- **Data de Aprovação:** 2026-11-02
- **Status:** Aprovado pelo Proprietário
- **Contexto:** Os pedidos de equipe interna (`equipe_interna` ou `solicitacao_interna`) são totalmente isentos de cobrança financeira e pagamento via checkout Asaas, pois destinam-se a estoque de demonstração e vendas presenciais no balcão. Portanto, esses pedidos nunca devem ser classificados como "pendentes de pagamento", devendo nascer diretamente como autorizados para fabricação física. Além disso, a esteira de pedidos recebidos deve priorizar a visualização dos pedidos liberados para produção, iniciando sempre na aba "Aprovados".
- **Decisão:**
  1. **Nascimento com Status `aprovado` para Equipe Interna (`server/routes/orders.ts`):**
     - Pedidos originados por vendedores da equipe interna ou solicitações administrativas recebem imediatamente o status `aprovado` e valor financeiro de `R$ 0,00` (isento).
     - Execução de sincronização defensiva no banco SQLite para garantir que pedidos internos pré-existentes transitem de `aguardando_pagamento` para `aprovado`.
  2. **Isolamento Estrito da Aba de Pendentes (`AdminPortal.tsx`):**
     - A aba "Pendentes" é reservada exclusivamente para revendedores autônomos externos aguardando liquidação de cobrança via Pix ou cartão no Asaas (suporte à recuperação de carrinho pelo WhatsApp).
     - Pedidos da equipe interna são 100% filtrados para fora da aba "Pendentes".
  3. **Aba "Aprovados" Unificada e Inicialização Padrão (`AdminPortal.tsx`):**
     - A antiga aba "Pagos" foi rebatizada como **"Aprovados"**, agrupando todos os pedidos autorizados para fabricação (pagos via Asaas + isentos da equipe interna).
     - O estado inicial da esteira de pedidos recebidos é configurado por padrão como `receivedFilter = 'aprovados'`, garantindo que a tela sempre abra pronta para o operador gerar os QR Codes e disparar a produção física das placas.
- **Consequências:** Fluxo operacional intuitivo, zero confusão entre pedidos a cobrar e pedidos de equipe interna, e máxima velocidade na esteira fabril do Atelier das Placas.

---

## ADR 014 — Bloqueio de Geração de QR Codes em Pedidos Pendentes e Transição Automática para Aprovados via Asaas e Manual
- **Data de Aprovação:** 2026-11-02
- **Status:** Aprovado pelo Proprietário
- **Contexto:** Placas e pedidos com status de pagamento pendente (`aguardando_pagamento`) não podem ter QR Codes gerados ou intervalos numéricos de estoque atribuídos antes da liquidação financeira, a fim de evitar desperdício de insumos fabris e quebra de sequência em pedidos não concretizados. Além disso, assim que o pagamento é reconhecido no Asaas (via Webhook oficial ou simulação) ou confirmado manualmente pelo operador administrativo, o pedido/placa deve ser automaticamente transferido para a aba "Aprovados", liberando o botão "Gerar QR Codes".
- **Decisão:**
  1. **Bloqueio de UI e Backend na Geração de QR Codes (`AdminPortal.tsx` e `server/routes/orders.ts`):**
     - O botão "Gerar QR Codes" no card do pedido permanece estritamente desabilitado enquanto `order.status === 'aguardando_pagamento'` (com estilo cinza inativo e cursor proibido), exibindo tooltip explicativa: *"Aguardando confirmação de pagamento no Asaas ou aprovação manual para liberar a geração de QR Codes"*.
     - O botão "Salvar Atribuição" de intervalo de estoque também é desabilitado em pedidos pendentes de pagamento.
     - As rotas de backend `POST /api/orders/:id/generate-qrcodes` e `POST /api/orders/:id/assign-range` validam se o pedido está com pagamento pendente e rejeitam a requisição com HTTP 400 caso não esteja pago ou aprovado.
  2. **Reconhecimento Automático via Asaas e Transição Imediata para Aprovados:**
     - O webhook do Asaas (`server/routes/payments.ts`) e o simulador de webhook processam os eventos de pagamento (`PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_AUTHORIZED`), atualizando o status do pedido para `'pago'`, sincronizando a tabela de pagamentos (`CONFIRMED`) e criando o registro na fila de fabricação (`manufacturing_orders`).
     - A interface do `AdminPortal.tsx` realiza polling periódico (a cada 5 segundos) e escuta a transição de status. Quando o pedido transita para `'pago'`, ele sai automaticamente da aba "Pendentes" e passa a constar na aba "Aprovados", exibindo notificação em tempo real e liberando o botão "Gerar QR Codes".
  3. **Aprovação / Confirmação Manual Unificada (`server/routes/orders.ts`):**
     - O endpoint `POST /api/orders/:id/confirm-payment-manual` atualiza `orders.status = 'pago'`, confirma o pagamento na tabela `payments` e insere o registro correspondente em `manufacturing_orders`.
     - Ao clicar em "Confirmar Manual", a interface atualiza o estado imediatamente, movendo o pedido para a aba "Aprovados" e habilitando o botão "Gerar QR Codes".
- **Consequências:** Segurança operacional contra produção indevida de placas não pagas, sincronismo em tempo real com o gateway de pagamentos Asaas e liberdade para o administrador liberar pedidos manualmente via WhatsApp.

---

## ADR 015 — Padronização Visual Pré-Produção (Cards em Vermelho), Geração Manual Estrita de QR Codes e Transição Automática para a Aba de Produção
- **Data de Aprovação:** 2026-11-02
- **Status:** Aprovado pelo Proprietário
- **Contexto:** Nos pedidos aprovados para fabricação (tanto da equipe comercial interna quanto de revendedores autônomos externos), nenhuma placa pode ter QR Codes pré-gerados automaticamente pelo sistema. Antes do início da produção física e antes da geração dos QR Codes, ambos os pedidos devem possuir rigorosamente a mesma apresentação visual com destaque em vermelho no card (`border-l-[6px] border-l-rose-500`, badge "QR Codes Pendentes" em vermelho e botão "Gerar QR Codes" ativo em vermelho), indicando de forma evidente que a fabricação ainda não começou. A geração de QR Codes deve ser uma ação estritamente manual pelo operador. Somente após a geração manual dos códigos os cards se tornam verdes ("QR Codes Prontos") e liberam o botão "Início de Produção". Ao disparar o início da produção, o sistema deve direcionar o operador e o pedido automaticamente para a aba "Placas em Produção".
- **Decisão:**
  1. **Card Idêntico em Vermelho Pré-Produção para Equipe Interna e Revendedores (`AdminPortal.tsx`):**
     - Tanto os pedidos da equipe comercial interna (`solicitacao_interna` / `equipe_interna`) quanto os pedidos de revendedores pagos (`pago` / `aprovado`) são renderizados com borda lateral vermelha (`border-rose-200/80 border-l-[6px] border-l-rose-500`), badge "QR Codes Pendentes" (`bg-rose-50 text-rose-700 border-rose-300`) e texto explicativo *"Gere os QR Codes para habilitar o Início de Produção"*.
     - Elimina qualquer distinção visual de cor prévia antes da geração dos QR Codes.
  2. **Geração Estritamente Manual de QR Codes no Backend e Frontend (`server/routes/orders.ts` e `AdminPortal.tsx`):**
     - Nem a criação de pedidos de revendedores (`POST /api/orders/create`), nem a criação de pedidos internos (`POST /api/orders/create-internal`), nem a transição para aprovado criam placas ou geram QR Codes automaticamente.
     - A rota `POST /api/orders/:id/start-production` bloqueia com HTTP 400 qualquer tentativa de iniciar a produção sem que as placas tenham sido criadas/geradas manualmente previamente, impedindo auto-geração oculta.
  3. **Mudança de Estado para Verde e Liberação do Início de Produção:**
     - Ao clicar no botão vermelho "Gerar QR Codes", o operador abre o visualizador de lotes e aciona a emissão manual.
     - Após a confirmação, o card atualiza para verde (`border-emerald-300/80 border-l-[6px] border-l-emerald-500`), com badge "QR Codes Prontos" em verde, botão verde "Ver / Baixar QR Codes" e o botão azul "Início de Produção" torna-se habilitado.
  4. **Transição Automática para a Aba "Placas em Produção" (`handleIniciarProducao`):**
     - Ao clicar em "Início de Produção", o backend atualiza o pedido e todas as suas placas para `status_fisico = 'em_producao'` e `manufacturing_orders.status = 'em_producao'`.
     - O frontend executa `loadAllAdminData()` e dispara automaticamente `setActiveTab('em_producao')`, abrindo instantaneamente a aba da esteira física com as placas recém-liberadas e seus respectivos botões de "Finalizado".
- **Consequências:** Controle fabril absoluto nas mãos do operador, clareza visual total com código de cores padronizado (vermelho = aguardando QR/pré-produção; verde = QR pronto liberado; azul = ação de início), e transição fluida sem cliques extras para a tela de monitoramento da esteira física.




