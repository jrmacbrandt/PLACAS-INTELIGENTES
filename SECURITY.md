# SECURITY.md — POLÍTICAS DE SEGURANÇA, AUTORIZAÇÃO E LGPD (VERSÃO 5.0)

**Projeto:** Plataforma de Placas Inteligentes com QR Code Dinâmico e NFC  
**Status:** Etapa 3 — Documentação Oficial do Projeto

---

## 1. PRINCÍPIOS FUNDAMENTAIS DE SEGURANÇA

1. **Princípio do Menor Privilégio (Least Privilege):** Nenhum usuário ou endpoint possui permissões além das estritamente necessárias para a sua função operacional.
2. **Defesa em Profundidade:** A segurança nunca depende apenas da interface (ocultar botões não é segurança). Toda ação é validada no backend e filtrada por políticas RLS no banco de dados.
3. **Imutabilidade e Rastreabilidade:** Nenhuma alteração de status crítico (pagamento, aprovação de reserva, liberação de placas, alteração de modalidade de entrega) ocorre sem registro no log de auditoria com data/hora e identificador do operador responsável.

---

## 2. MATRIZ DE AUTORIZAÇÃO E PAPÉIS (RBAC)

| Recurso / Operação | Visitante | Revendedor Autônomo | Vendedor Interno | Administrador |
|---|---|---|---|---|
| Acessar endpoint público `/r/:token` | **Permitido** | **Permitido** | **Permitido** | **Permitido** |
| Criar conta autônoma de revendedor | **Permitido** | - | - | - |
| Fazer pedido de compra com pagamento Asaas | - | **Permitido** | - | **Permitido** |
| Criar solicitação/reserva para cliente | - | - | **Permitido** | **Permitido** |
| Aprovar reserva interna para fabricação | - | - | **Bloqueado** | **Permitido** |
| Alterar preço global ou individual | - | **Bloqueado** | **Bloqueado** | **Permitido** |
| Registrar inspeção física de placas | - | **Bloqueado** | **Bloqueado** | **Permitido** |
| Visualizar e configurar suas próprias placas | - | **Permitido** (se liberada) | **Permitido** (se liberada) | **Permitido** |
| Visualizar ou alterar placas de outros revendedores | - | **Bloqueado** | **Bloqueado** | **Permitido** |
| Ativar / Desativar placa atribuída | - | **Permitido** | **Permitido** | **Permitido** |
| Alterar modalidade de entrega do pedido | - | **Bloqueado** (após produção) | **Bloqueado** | **Permitido** (com auditoria) |
| Acessar painel administrativo geral | - | **Bloqueado** | **Bloqueado** | **Permitido** |

---

## 3. PROTEÇÃO CONTRA VULNERABILIDADES CRÍTICAS

### 3.1. Manipulação de Identificadores (IDOR)
- Todas as rotas de atualização ou leitura (ex: `/api/plates/:id`, `/api/orders/:id`) validam expressamente no backend se o `revendedor_id` da entidade confere com o `user_id` autenticado na sessão.
- Respostas a tentativas de acesso não autorizado retornam código HTTP `403 Forbidden` ou `404 Not Found` neutro para evitar vazamento de existência do registro.

### 3.2. Geração Segura do Token da URL Permanente
- O token da URL `/r/:token` é gerado utilizando gerador criptográfico de números pseudo-aleatórios (CSPRNG):
  ```typescript
  import crypto from 'crypto';
  export function generateSecureToken(length = 12): string {
    return crypto.randomBytes(length).toString('base64url').slice(0, length);
  }
  ```
- O token **nunca** deriva de IDs sequenciais (evitando adivinhação ou scraping por terceiros).

### 3.3. Sanitização e Validação Estrita de URLs de Destino
- Ao cadastrar uma URL de destino para a placa, o backend executa validação rigorosa:
  1. O protocolo **deve ser exclusivamente `https://` ou `http://`**.
  2. Protocolos maliciosos como `javascript:`, `data:`, `vbscript:`, `file:` são terminantemente **rejeitados com erro 400**.
  3. Caracteres de controle, tags HTML e injeções de script são eliminados antes de persistir no banco.

### 3.4. Idempotência e Autenticidade de Webhooks (Asaas)
- O endpoint de webhook do Asaas valida o token de autenticação enviado no cabeçalho `asaas-access-token`.
- Todo evento recebido é submetido à checagem na tabela `webhook_events`. Caso o `event_id` já tenha sido processado, a execução é encerrada imediatamente com retorno `200 OK`, impedindo duplicações de autorização de fabricação.

---

## 4. CONFORMIDADE COM A LGPD (LEI GERAL DE PROTEÇÃO DE DADOS)

1. **Minimização da Coleta de Dados:** O sistema apenas coleta dados essenciais para faturamento, envio postal e contato de entrega (Nome, CPF/CNPJ, E-mail, Telefone, Endereço de entrega).
2. **Privacidade no Redirecionamento Dinâmico:** O endpoint público `/r/:token` jamais revela ao visitante público dados pessoais do revendedor, do proprietário da placa ou detalhes administrativos. Quando a placa está desativada, exibe aviso neutro institucional.
3. **Auditoria de Acesso:** Operações administrativas em dados pessoais ou logísticos geram log em `audit_logs` registrando quem acessou/modificou a informação e quando.
