# TEST_PLAN.md — PLANO DE TESTES E CRITÉRIOS DE ACEITAÇÃO (VERSÃO 5.0)

**Projeto:** Plataforma de Placas Inteligentes com QR Code Dinâmico e NFC  
**Status:** Etapa 3 — Documentação Oficial do Projeto  
**Regra Inegociável:** Nenhum teste pode ser declarado aprovado sem ter sido efetivamente executado e com evidência técnica registrada.

---

## 1. SUÍTE DE TESTES OBRIGATÓRIOS DE NEGÓCIO (SEÇÃO 21)

| ID | Descrição do Teste | Critério de Aceite Esperado |
|---|---|---|
| **T01** | Cadastro público de revendedor | Cria usuário com papel `revendedor`, status ativo e acesso imediato ao painel. |
| **T02** | Cadastro administrativo de vendedor interno | Administrador cadastra usuário usando o mesmo perfil com `tipo_parceiro = 'equipe_interna'`. |
| **T03** | Segregação de privilégio do vendedor interno | O usuário de equipe interna não possui permissões de administrador. |
| **T04** | Painel comercial unificado | Todos os revendedores acessam o mesmo portal comercial. |
| **T05** | Prevalência do preço individual | Se o revendedor tiver preço individual de R$ 18,00, a compra de 5 placas calcula R$ 90,00 e não R$ 109,50. |
| **T06** | Preservação do preço em pedidos históricos | Alterar a tabela global não altera o valor de pedidos criados anteriormente. |
| **T07** | Bloqueio de fabricação sem pagamento | Pedido de revendedor permanece em `aguardando_pagamento` e não gera ordem na fila de fábrica. |
| **T08** | Rejeição de webhook inválido | Webhook com token incorreto ou sem assinatura válida é rejeitado com erro 401/403 e não autoriza produção. |
| **T09** | Autorização de fabricação por reserva interna | Reserva aprovada pelo Administrador gera ordem de produção sem exigir pagamento. |
| **T10** | Proibição de atribuição duplicada de placa | Tentativa de atribuir a mesma placa a dois revendedores falha com erro de restrição única. |
| **T11** | Bloqueio de liberação de placa reprovada | Placa com inspeção `reprovada` não pode ser marcada como liberada nem atribuída. |
| **T12** | Isolamento de dados entre revendedores | Revendedor A não consegue consultar pedidos ou placas do Revendedor B. |
| **T13** | Seleção de Retirada no cadastro | Formulário de cadastro salva `preferencia_entrega = 'retirada'`. |
| **T14** | Seleção de Correios no cadastro | Formulário de cadastro salva `preferencia_entrega = 'correios'` e valida campos de endereço. |
| **T15** | Visibilidade da preferência no Admin | Listagem e detalhes do revendedor no Admin exibem claramente a preferência de entrega. |
| **T16** | Alteração da preferência padrão pelo Admin | Administrador pode atualizar a preferência padrão de um revendedor. |
| **T17** | Alteração de modalidade de entrega do pedido pelo Admin | Administrador altera modalidade no pedido com justificativa e registro em `audit_logs`. |
| **T18** | Independência entre preferência de perfil e pedidos anteriores | Alterar a preferência do perfil não modifica pedidos já emitidos. |
| **T19** | Imutabilidade de histórico de postagem | Alterar modalidade não apaga histórico nem código de rastreamento de postagem já realizada. |
| **T20** | Confirmação operacional de Retirada | Pedido em Retirada só é marcado como entregue após ação explícita de operador autorizado. |
| **T21** | Não presunção de entrega por código de rastreio | Cadastrar o código de rastreio não altera o status do pedido diretamente para 'entregue'. |
| **T22** | Validação de dados de entrega | Backend rejeita submissão de CEP inválido ou endereço incompleto. |
| **T23** | Bloqueio de alteração indevida de terceiros | Revendedor não consegue alterar endereço ou modalidade de entrega de outro revendedor. |
| **T24** | Preservação de histórico na troca de destino do QR Code | Mudar o destino da placa grava novo registro na tabela `destination_history`. |
| **T25** | Recuperação de senha segura | Fluxo de recuperação preserva a conta, permissões e histórico sem criar duplicatas. |
| **T26** | Revisão humana no OCR Gemini | Dados extraídos do comprovante de envio ficam como `pendente_revisao` até confirmação manual. |

---

## 2. SUÍTE DE ACEITAÇÃO DO ADENDO OBRIGATÓRIO V5.0

| ID | Descrição do Teste (Adendo v5.0) | Critério de Aceite Esperado |
|---|---|---|
| **A01** | Cadastro autônomo sem intervenção manual | Criação de conta pelo site libera acesso comercial imediato. |
| **A02** | Criação de revendedor via convite seguro pelo Admin | O administrador não define nem conhece a senha permanente do usuário. |
| **A03** | Estrutura unificada de perfil | Revendedor cadastrado por qualquer via utiliza o mesmo modelo de portal. |
| **A04** | Impossibilidade de auto-elevação para Admin | Cadastro autônomo não permite que o usuário defina seu papel como `admin`. |
| **A05** | Gestão exclusiva de placas próprias e liberadas | O revendedor visualiza apenas placas com `status_fisico = 'liberada'` a ele atribuídas. |
| **A06** | Bloqueio de acesso por manipulação de parâmetros | Acessar `/api/plates/:id` de placa de outro revendedor retorna erro `403 Forbidden`. |
| **A07** | Salvar URL válida não ativa a placa | Ao salvar um link do Google Avaliações, a placa permanece com `status_digital = 'inativa'`. |
| **A08** | Encaminhamento correto em placa ativa | Ao acessar `/r/:token` de placa ativa, o servidor responde `302 Found` para o link configurado. |
| **A09** | Desativação sem perda de dados | Ao desativar, a URL `/r/:token` bloqueia o acesso público, mantendo URL, histórico e dados intactos. |
| **A10** | Reativação com restauração de configuração | Ao reativar a placa, o redirecionamento para a URL salva volta a funcionar imediatamente. |
| **A11** | Independência entre placas | Ativar, desativar ou alterar a URL da placa A não modifica os dados da placa B. |
| **A12** | Bloqueio de ativação em placa não liberada | Revendedor não consegue ativar uma placa que ainda não passou por inspeção ou liberação. |
| **A13** | Registro em auditoria de mudanças de estado | Ativação, desativação e troca de URL gravam log com `user_id`, data/hora e valores. |
| **A14** | Segurança contra concorrência | Requisições simultâneas de ativação não geram estados contraditórios no banco. |
