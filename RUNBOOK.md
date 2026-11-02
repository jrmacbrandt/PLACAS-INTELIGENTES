# RUNBOOK.md — PROCEDIMENTOS OPERACIONAIS E CONTINGÊNCIA (VERSÃO 5.0)

**Projeto:** Plataforma de Placas Inteligentes com QR Code Dinâmico e NFC  
**Status:** Etapa 3 — Documentação Oficial do Projeto

---

## 1. FALHAS DE WEBHOOK DO ASAAS

### Cenário: Cliente efetuou o pagamento, mas o pedido continua em "Aguardando Pagamento"
1. **Verificação nos Logs:** Acessar a tabela `webhook_events` e consultar se o evento foi recebido com erro ou se houve timeout.
2. **Reconciliação Manual Segura:**
   - O Administrador acessa a tela de detalhes do pedido no painel administrativo.
   - Utiliza a ação **"Reconciliar com Asaas"**.
   - O backend consulta diretamente a API oficial do Asaas via GET `/api/v3/payments/:id`.
   - Se o status no Asaas for `CONFIRMED` ou `RECEIVED`, o sistema atualiza o status para `pago`, registra o evento no histórico e autoriza a fabricação.

---

## 2. MODALIDADE DE RETIRADA E COMUNICAÇÃO POR WHATSAPP

### Cenário: Revendedor escolheu Retirada e o lote foi aprovado e liberado
1. O revendedor visualiza no painel: **"Suas placas estão prontas para retirada"**.
2. O sistema exibe o botão destacado: **"Falar no WhatsApp para Combinar Retirada"**, pré-preenchendo o número do pedido e identificação.
3. No momento da entrega presencial, o operador da empresa acessa o painel de pedidos e clica em **"Confirmar Retirada Efetiva"**, informando quem retirou.
4. O pedido transita para `retirada_realizada` e as placas ficam prontas para ativação.

---

## 3. ALTERAÇÃO DE MODALIDADE DE ENTREGA PELO ADMINISTRADOR

### Cenário: Revendedor escolheu Retirada, mas solicita envio pelos Correios (ou vice-versa)
1. O Administrador acessa o pedido em questão no painel administrativo.
2. Clica em **"Alterar Modalidade de Entrega"**.
3. Se converter para Correios, preenche os dados de endereço do destinatário.
4. Fornece uma justificativa operacional obrigatória.
5. O sistema atualiza a tabela `order_logistics` e grava o registro na tabela `audit_logs`.

---

## 4. SUSPENSÃO OU BLOQUEIO DE UMA PLACA FÍSICA

### Cenário: Placa perdida, furtada, danificada ou cliente inadimplente
1. O Administrador acessa a placa no painel administrativo.
2. Seleciona a ação **"Bloquear Placa"**, preenchendo o motivo.
3. O status digital é alterado imediatamente para `bloqueada`.
4. O endpoint `/r/:token` passa a responder página de placa suspensa, interrompendo qualquer redirecionamento público.
5. O histórico e os dados configurados permanecem preservados para reativação futura pelo Administrador.
