# IMPLEMENTATION_PLAN.md — PLANO DE EXECUÇÃO DETALHADO POR ETAPAS (VERSÃO 5.0)

**Projeto:** Plataforma de Placas Inteligentes com QR Code Dinâmico e NFC  
**Status:** Etapa 3 — Documentação Oficial do Projeto  
**Metodologia:** Desenvolvimento sequencial com aprovação formal do proprietário a cada entrega (Seção 2.1).

---

## CRONOGRAMA E DETALHAMENTO DAS ETAPAS

### [x] Etapa 1 — Auditoria Inicial do Projeto
- **Objetivo:** Inspecionar o ambiente, código inicial, dependências e identificar pendências e riscos.
- **Entrega Realizada:** Relatório de Auditoria Inicial em estrita conformidade com a Seção 37 e Seção 24.

### [x] Etapa 2 — Esclarecimento e Validação das Regras de Negócio
- **Objetivo:** Submeter as perguntas bloqueadoras ao proprietário e obter definições oficiais.
- **Entrega Realizada:** Respostas aprovadas pelo proprietário (ADR 001, ADR 002 com faixas de R$ 21,90 / R$ 19,90 / R$ 17,90, e ADR 003 de Retirada via WhatsApp e alteração admin).

### [x] Etapa 3 — Criação da Documentação Oficial do Projeto (Atual)
- **Objetivo:** Criar e persistir os 11 documentos de governança, arquitetura e dados na raiz do projeto.
- **Entrega:** `PROMPT_MESTRE_QRCODE_VERSAO_5.0.md`, `DECISIONS.md`, `PRD.md`, `ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`, `IMPLEMENTATION_PLAN.md`, `TEST_PLAN.md`, `DEPLOYMENT.md`, `RUNBOOK.md`, `CHANGELOG.md`, `GEMINI.md`.

---

### [ ] Etapa 4 — Aprovação Formal da Arquitetura e Modelo de Dados
- **Objetivo:** Apresentação da arquitetura e esquema DDL ao proprietário para validação final antes da codificação do banco.
- **Critério de Aceite:** Aprovação explícita pelo proprietário das entidades, tabelas e fluxos.

### [ ] Etapa 5 — Fundação Técnica, Banco de Dados e Segurança
- **Objetivo:** Criação da estrutura de tabelas relacionais em PostgreSQL com restrições de integridade, seed inicial das faixas de preço e camada base de serviços.
- **Critério de Aceite:** Script de migração executa sem falhas e testes de integridade referencial passam.

### [ ] Etapa 6 — Autenticação e Perfis Comerciais Unificados
- **Objetivo:** Implementação do cadastro e login com sessões seguras, papel unificado de revendedor e classificação administrativa (`tipo_parceiro`).
- **Critério de Aceite:** Sessões autenticadas válidas, proteção de rotas no backend e impossibilidade de auto-elevação de privilégios.

### [ ] Etapa 7 — Cadastro Público e Administrativo de Revendedores
- **Objetivo:** Telas e rotas de cadastro autônomo (com pergunta obrigatória de Retirada vs Correios) e cadastro administrativo pelo Admin por convite seguro.
- **Critério de Aceite:** Teste 1, 2, 3 e 4 da Seção 21 aprovados.

### [ ] Etapa 8 — Cadastro de Clientes, Oportunidades e Solicitações Internas
- **Objetivo:** Cadastro de clientes para vendedores da equipe interna e geração de reservas comerciais.
- **Critério de Aceite:** Aprovação pelo administrador autoriza fabricação sem exigir pagamento prévio do vendedor.

### [ ] Etapa 9 — Motor de Precificação e Pedidos de Compra
- **Objetivo:** Cálculo automático do preço unitário com faixas de volume (R$ 21,90 / R$ 19,90 / R$ 17,90) ou preço individual, gerando snapshot imutável no pedido.
- **Critério de Aceite:** Testes 5 e 6 da Seção 21 aprovados.

### [ ] Etapa 10 — Integração com Asaas (Cobrança e Webhooks Idempotentes)
- **Objetivo:** Emissão de Pix/Boleto e processamento seguro de webhooks com verificação de autenticidade e idempotência.
- **Critério de Aceite:** Testes 7 e 8 da Seção 21 aprovados.

### [ ] Etapa 11 — Fila Unificada de Fabricação Sob Demanda e Inspeção
- **Objetivo:** Fila unificada de produção, registro físico por unidade, suporte a fabricação parcial e checklist de inspeção de qualidade.
- **Critério de Aceite:** Testes 10 e 11 da Seção 21 aprovados.

### [ ] Etapa 12 — Atribuição e Liberação Individual de Placas
- **Objetivo:** Atribuição atômica das unidades aprovadas aos revendedores e controle de liberação administrativa.
- **Critério de Aceite:** Placa reprovada não pode ser liberada; proibição de atribuição duplicada.

### [ ] Etapa 13 — Geração de QR Code e Rota Permanente `/r/:token`
- **Objetivo:** Geração gráfica de QR Code via biblioteca técnica dedicada e criação do endpoint público de redirecionamento dinâmico.
- **Critério de Aceite:** Token aleatório seguro; resposta 302 temporária em placas ativas.

### [ ] Etapa 14 — Gestão Individual de Placas, Ativação/Desativação e NFC (Adendo v5.0)
- **Objetivo:** Configuração independente por placa, validação de URL do Google Avaliações, controle alternável único ("Ativar placa" / "Desativar placa") e registro operacional do chip NFC.
- **Critério de Aceite:** Todos os 14 critérios de aceitação do Adendo Obrigatório v5.0 validados com testes reais.

### [ ] Etapa 15 — Módulo de Entrega: Retirada vs. Correios
- **Objetivo:** Instruções e botão de contato WhatsApp para Retirada e formulário de endereço para Correios.
- **Critério de Aceite:** Testes 13 e 14 da Seção 21 aprovados.

### [ ] Etapa 16 — Gestão Administrativa da Logística e Auditoria
- **Objetivo:** Painel administrativo de envios e retiradas, alteração de modalidade pelo Admin com justificativa e registro em `audit_logs`.
- **Critério de Aceite:** Testes 15, 16, 17, 18 e 19 da Seção 21 aprovados.

### [ ] Etapa 17 — Leitura de Comprovantes com Gemini OCR Assistido
- **Objetivo:** Upload de comprovante de envio, extração de código de rastreio via Gemini 2.5 Flash e interface de conferência humana obrigatória.
- **Critério de Aceite:** Teste 26 da Seção 21 aprovado; nenhum dado inserido no banco sem validação manual.

### [ ] Etapa 18 — Consolidação dos Painéis Comercial e Administrativo
- **Objetivo:** Telas responsivas, visualmente profissionais e intuitivas com dados reais (sem números estáticos fictícios).
- **Critério de Aceite:** Painel unificado do revendedor e painel administrativo 100% integrados às APIs.

### [ ] Etapa 19 — Execução da Suíte Completa de Testes e Homologação
- **Objetivo:** Execução e documentação em relatório de todos os 26 testes de negócio e 14 critérios do Adendo v5.0.
- **Critério de Aceite:** 100% dos testes aprovados com evidências de execução.

### [ ] Etapa 20 — Preparação para Implantação e Operação
- **Objetivo:** Revisão de variáveis de ambiente, build de produção e documentação de recuperação.
- **Critério de Aceite:** Aplicação pronta para publicação segura.
