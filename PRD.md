# PRD.md — DOCUMENTO DE REQUISITOS DO PRODUTO (VERSÃO 5.0)

**Projeto:** Plataforma de Placas Inteligentes com QR Code Dinâmico e NFC  
**Versão:** 5.0 — Modelo Comercial Unificado, Logística Dual e Gestão Individual  
**Status:** Etapa 3 — Documentação Oficial do Projeto

---

## 1. VISÃO GERAL E OBJETIVO DO PRODUTO

A plataforma gerencia a comercialização, fabricação sob demanda, logística, configuração e ativação dinâmica de placas físicas inteligentes com **QR Code Dinâmico** e chip **NFC**.

As placas conectam o mundo físico ao digital, direcionando clientes para:
- Perfil da Empresa no Google (Google Avaliações).
- WhatsApp Comercial (atendimento ou pedidos).
- Instagram e Redes Sociais.
- Sites institucionais ou cardápios digitais (HTTPS seguro).

---

## 2. ATORES E PERSONAS (MODELO COMERCIAL UNIFICADO)

O sistema segue o princípio inegociável da Versão 5.0: **Todos são Revendedores**. Não existem sistemas comerciais segregados.

### 2.1. Visitante Público
- Acessa o site institucional e a página pública de cadastro autônomo.
- Pode se cadastrar como revendedor independente fornecendo dados cadastrais e criando suas credenciais.
- Acesso público ao endpoint dinâmico `/r/:token` das placas ativas.

### 2.2. Revendedor (Perfil Comercial Único)
Todos os operadores comerciais possuem o mesmo modelo de conta, subdivididos administrativamente pelo atributo `tipo_parceiro`:
1. **Revendedor Independente (`revendedor_independente`):** Compra placas em atacado pela plataforma pagando antecipadamente via Asaas (Pix/Boleto/Cartão). A fabricação só inicia após confirmação do pagamento.
2. **Integrante da Equipe Comercial Interna (`equipe_interna`):** Cadastrado administrativamente pela empresa. Registra solicitações/reservas para seus clientes. A aprovação da reserva pelo Administrador autoriza a fabricação física, sem exigir pagamento prévio do vendedor.
3. **Parceiro Especial / Influenciador (`parceiro_especial`):** Pode possuir condições comerciais personalizadas (preço individual) definidas pelo Administrador.

*Capacidades do Painel do Revendedor:*
- Visualização de resumo de pedidos e compras.
- Tabela de preços aplicável (com desconto por volume).
- Seleção e alteração da preferência de entrega (Retirada ou Correios).
- Acompanhamento da fabricação sob demanda em tempo real.
- Visualização e gestão exclusiva de suas placas liberadas.
- Configuração individual de cada placa (estabelecimento, link do Google Avaliações, URL).
- Ativação e desativação independente de cada placa através de botão alternável único.

### 2.3. Administrador
Possui controle operacional total sobre a empresa:
- Gestão central de revendedores (cadastro, edição, bloqueio, preços individuais).
- Configuração de precificação global e faixas de volume.
- Gestão de pedidos e solicitações de fabricação.
- Aprovação ou rejeição de reservas comerciais internas.
- Fila unificada de fabricação física sob demanda.
- Registro da inspeção de qualidade de cada placa física.
- Atribuição e liberação das placas produzidas para os revendedores.
- Gestão logística:
  - Painel de Retiradas (com orientação de contato por WhatsApp).
  - Painel de Envios via Correios (etiquetas, postagem, rastreamento).
  - Alteração da modalidade de entrega no pedido com trilha de auditoria.
- Leitura assistida de comprovantes de postagem via Gemini OCR com revisão manual.
- Logs de auditoria, eventos de webhook do Asaas e integridade do sistema.

---

## 3. REGRAS DE PREÇOS E CONDIÇÕES COMERCIAIS (ADR 002)

### 3.1. Tabela Global Padrão de Aquisição
O preço de aquisição padrão cobrado dos revendedores segue o escalonamento por volume aprovado:
- **1 a 9 unidades:** R$ 21,90 por placa.
- **10 a 49 unidades:** R$ 19,90 por placa (desconto por volume).
- **50 unidades ou mais:** R$ 17,90 por placa (desconto por escala máxima).
- **Quantidade mínima:** 1 unidade por pedido.

### 3.2. Preço Individual
- O Administrador pode fixar um valor unitário específico para qualquer revendedor.
- Havendo preço individual ativo, ele **prevalece sobre a tabela global**.
- Desativado o preço individual, o revendedor retorna automaticamente à tabela global vigente.
- Todo pedido registra um **snapshot imutável** das condições financeiras contratadas no momento de sua emissão.

---

## 4. FLUXO DE ENTREGA: RETIRADA VS. CORREIOS (ADR 003)

### 4.1. Seleção no Cadastro e nos Pedidos
- No cadastro (público ou administrativo), o revendedor seleciona a opção obrigatória:
  - *"Como você prefere receber suas placas?"* -> **Retirada** ou **Envio pelos Correios**.
- Esta preferência é gravada no perfil (`profiles.preferencia_entrega`) e sugerida como padrão nos novos pedidos.
- O revendedor pode selecionar uma modalidade diferente para um pedido específico (`orders.modalidade_entrega`).

### 4.2. Modalidade Retirada
- Se selecionada a modalidade **Retirada**:
  - O sistema orienta o revendedor a **entrar em contato com a empresa via WhatsApp** para combinar e agendar a retirada presencial assim que as placas forem liberadas.
  - Exibe instruções de atendimento e telefone/link de WhatsApp configurados pela administração.
  - Estados de Retirada: `retirada_selecionada`, `aguardando_producao`, `aguardando_liberacao`, `pronta_para_retirada`, `retirada_realizada`, `cancelada`.

### 4.3. Modalidade Envio pelos Correios
- Se selecionada a modalidade **Correios**:
  - Exige endereço de entrega completo (CEP, Logradouro, Número, Complemento, Bairro, Cidade, UF, Destinatário e Telefone).
  - Estados dos Correios: `aguardando_producao`, `aguardando_liberacao`, `aguardando_etiqueta`, `aguardando_postagem`, `postado`, `em_transito`, `entregue`.

### 4.4. Alteração pelo Administrador
- O Administrador tem autonomia para alterar a modalidade de entrega diretamente na tela de detalhes do pedido (de Correios para Retirada ou vice-versa).
- A alteração exige justificativa e gera um registro detalhado de auditoria (`audit_logs`).

---

## 5. CICLO DE FABRICAÇÃO SOB DEMANDA E INSPEÇÃO FÍSICA

1. **Princípio do Estoque Zero:** Não se presume existência de placas prontas sem registro físico.
2. **Origem da Autorização:**
   - *Pedido Revendedor:* Autorizado exclusivamente após webhook `PAYMENT_RECEIVED` ou `PAYMENT_CONFIRMED` do Asaas validado no backend.
   - *Solicitação Interna:* Autorizada imediatamente após o Administrador clicar em "Aprovar Reserva".
3. **Produção Parcial:** O sistema suporta produção fracionada de lotes (ex.: em pedido de 50 placas, 20 podem ser produzidas e inspecionadas hoje e 30 amanhã).
4. **Inspeção de Qualidade:**
   - Cada placa física é inspecionada individualmente.
   - Itens verificados: legibilidade física do QR Code, acabamento do acrílico/impressão e teste de leitura do chip NFC.
   - Placas reprovadas são marcadas como `reprovada` e jamais podem ser atribuídas ou ativadas.

---

## 6. GESTÃO INDIVIDUAL E ATIVAÇÃO DAS PLACAS (ADENDO V5.0)

### 6.1. Identidade e Tokens Criptográficos
- Cada placa física recebe:
  - ID interno sequencial amigável para controle de fábrica (ex.: `PLK-001042`).
  - Token público aleatório criptográfico (ex.: `xK9pL2mQ7vR4`).
  - URL permanente estável: `https://dominio.com/r/:token`.
  - Chip NFC gravado fisicamente apontando para a mesma URL permanente.

### 6.2. Configuração Individual da Placa
- O revendedor acessa a lista de suas placas liberadas.
- Pode configurar individualmente:
  - Nome do Estabelecimento comercial.
  - Categoria do negócio.
  - Nome e telefone de contato do cliente.
  - Tipo de destino (Google Avaliações, WhatsApp, Instagram, Link Personalizado).
  - URL de destino final validada (rejeita protocolos perigosos como `javascript:` e destinos inválidos).
- **Importante:** Salvar a configuração salva os dados no banco, mas **mantém a placa inativa**.

### 6.3. Controle Alternável Único ("Ativar placa" / "Desativar placa")
- Placa inativa -> Exibe botão **"Ativar placa"**.
- Placa ativa -> Exibe botão **"Desativar placa"**.
- Ao clicar em "Desativar placa", o endpoint `/r/:token` bloqueia o acesso imediatamente exibindo mensagem informativa neutra (sem expor dados pessoais do cliente nem o link final).
- Ao reativar, a placa restaura a URL e configurações anteriores imediatamente.

---

## 7. CRITÉRIOS DE ACEITAÇÃO OBRIGATÓRIOS (CHECKLIST DE HOMOLOGAÇÃO)

O sistema só será aceito se cumprir comprovadamente:
- [ ] Cadastro autônomo cria perfil de revendedor com acesso imediato e sem permissão admin.
- [ ] Administrador cadastra vendedor interno no mesmo modelo com `tipo_parceiro = 'equipe_interna'`.
- [ ] O painel comercial é único e adaptado para todas as categorias de parceiros.
- [ ] Preço individual prevalece sobre o global; histórico de pedidos preserva preço original contratado.
- [ ] Compra de revendedor não fabrica sem confirmação do Asaas validada no backend.
- [ ] Webhook do Asaas é validado com autenticidade, idempotência e tratamento contra repetições.
- [ ] Solicitação interna aprovada autoriza fabricação física sem exigir pagamento do vendedor.
- [ ] Seleção de Retirada exibe orientação de WhatsApp e dados operacionais claros.
- [ ] Administrador consegue alterar modalidade de entrega do pedido com histórico preservado.
- [ ] Cada placa possui token criptográfico único; alterar uma placa não afeta outras.
- [ ] Salvar configuração não ativa a placa automaticamente.
- [ ] Controle único "Ativar placa" / "Desativar placa" opera em tempo real no endpoint `/r/:token`.
- [ ] Desativar a placa suspende QR Code e NFC sem apagar configurações salvas.
- [ ] OCR Gemini extrai dados de comprovantes de envio submetidos a revisão manual humana obrigatória.
