# ARCHITECTURE.md — ARQUITETURA DA PLATAFORMA (VERSÃO 5.0)

**Projeto:** Plataforma de Placas Inteligentes com QR Code Dinâmico e NFC  
**Status:** Etapa 3 — Documentação Oficial do Projeto  
**Alinhamento:** ADR 001, ADR 002, ADR 003, ADR 004, ADR 005

---

## 1. VISÃO GERAL DA ARQUITETURA

A plataforma é concebida como uma aplicação web moderna full-stack, desacoplada entre a camada de apresentação do usuário e o motor central de autorização, regras de negócio e redirecionamento dinâmico.

```
                      +-----------------------------------+
                      |         USUÁRIO / BROWSER         |
                      |  (React 19 + Tailwind v4 + Vite)  |
                      +-----------------+-----------------+
                                        | (HTTPS / REST)
                                        v
                      +-----------------+-----------------+
                      |     BACKEND / API GATEWAY         |
                      |  (Node.js + Express + TypeScript) |
                      +----+-----------+------------+-----+
                           |           |            |
            +--------------+           |            +----------------+
            |                          v                             |
+-----------v-----------+   +----------+----------+        +---------v---------+
|     POSTGRESQL        |   |   ASAAS PAYMENT     |        |   GEMINI API      |
|  (Schemas, Triggers,  |   |   (Cobranças Pix /  |        |   (OCR de Compro- |
|   Restrições e RLS)   |   |   Boleto + Webhooks)|        |   vantes de Envio)|
+-----------------------+   +---------------------+        +-------------------+
```

---

## 2. COMPONENTES E MÓDULOS DO SISTEMA

### 2.1. Módulo de Autenticação e Perfis (`auth` & `profiles`)
- **Papéis Técnicos:** `visitante`, `revendedor`, `admin`.
- **Classificação Comercial:** Atributo `tipo_parceiro`:
  - `revendedor_independente`: Compra no atacado com pagamento antecipado.
  - `equipe_interna`: Membro do time comercial interno; solicita fabricação para clientes.
  - `parceiro_especial`: Parceiro comercial / influenciador com preços diferenciados.
- **Segurança de Sessão:** Tokens assinados via JWT com validação estrita no backend em cada requisição. O papel nunca é confiado a partir do cabeçalho ou corpo da requisição do cliente.

### 2.2. Módulo de Precificação e Pedidos (`pricing` & `orders`)
- **Motor de Cálculo:** Executado 100% no servidor.
- **Regra de Prioridade:**
  1. Verifica se o revendedor possui `preco_individual` ativo na tabela `profiles`.
  2. Caso contrário, aplica a tabela global escalonada por faixas (`pricing_tiers`):
     - 1 a 9 un: R$ 21,90
     - 10 a 49 un: R$ 19,90
     - 50+ un: R$ 17,90
- **Snapshot Imutável:** Cada pedido gerado grava `preco_unitario_aplicado`, `quantidade_total`, `desconto_total` e `valor_total`. Modificações futuras na tabela de preços não alteram pedidos existentes.

### 2.3. Módulo de Pagamentos e Webhooks (`payments` & `asaas`)
- **Gateway:** Asaas API (Pix, Boleto Bancário e Cartão).
- **Tratamento de Webhooks:**
  - Validação do token de autenticação do webhook (`asaas-access-token`).
  - **Idempotência Garantida:** Tabela `webhook_events` registra o `event_id` do Asaas antes do processamento. Eventos duplicados ou repetidos são descartados com status `200 OK`.
  - Transição de estado: Somente eventos confirmados (`PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED`) alteram o status do pedido para `pago`, o que dispara a criação da ordem de produção na fila de fabricação.

### 2.4. Módulo de Fabricação Sob Demanda e Inspeção (`manufacturing` & `plates`)
- **Fila Unificada de Fabricação:**
  - Registra a origem de cada lote: `pedido_revendedor` ou `reserva_interna`.
  - Permite produção e inspeção parcial.
- **Rastreabilidade Unitária da Placa:**
  - Cada placa física gerada recebe:
    - `id` (UUID interno).
    - `codigo_sequencial` (ex.: `PLK-001042`).
    - `token_publico` (criptograficamente aleatório de alta entropia).
    - `status_fisico`: `planejada` -> `em_producao` -> `produzida` -> `aprovada` (ou `reprovada`).
    - `status_digital`: `inativa`, `ativa`, `bloqueada`.
    - `status_nfc`: `nao_instalado`, `gravado`, `testado`.

### 2.5. Módulo de Logística Dual (`logistics` & `shipments`)
- **Desacoplamento de Preferência:**
  - Perfil possui `preferencia_entrega` padrão (`retirada` ou `correios`).
  - Pedido possui `modalidade_entrega` efetiva.
- **Fluxo de Retirada:**
  - Se `modalidade_entrega == 'retirada'`: instruções de contato via WhatsApp com o suporte e telefone oficial da empresa.
  - Estados: `retirada_selecionada`, `aguardando_producao`, `aguardando_liberacao`, `pronta_para_retirada`, `retirada_realizada`.
- **Fluxo de Correios:**
  - Coleta de endereço completo e geração de código de rastreamento.
  - Estados: `aguardando_postagem`, `postado`, `em_transito`, `entregue`.
- **Governança do Administrador:**
  - O Administrador pode converter a modalidade no pedido com justificativa obrigatória registrada em `audit_logs`.

### 2.6. Motor de Redirecionamento Dinâmico (`redirect_engine`)
- **Endpoint Público Permanente:** `GET /r/:token`
- **Fluxo de Execução:**
  1. Busca a placa correspondente ao token na tabela `plates`.
  2. Verifica `status_digital`:
     - Se `ativa`: redireciona com `302 Found` (redirecionamento temporário para evitar cache agressivo no navegador do cliente) para `url_destino`.
     - Se `inativa`: renderiza página institucional amigável informando que a placa está temporariamente pausada (sem expor informações confidenciais do cliente).
     - Se `bloqueada`: exibe tela de suspensão administrativa.
     - Se `inexistente`: exibe tela 404 padronizada.
  3. Registra métrica de leitura (data/hora, user-agent e IP anonimizado para fins de auditoria de acessos).

### 2.7. Módulo de OCR Assistido via Gemini (`gemini_ocr`)
- **Função:** Extração de dados de comprovantes de postagem enviados pelo operador.
- **Modelo:** `gemini-2.5-flash` com entrada multimodal de imagem.
- **Segurança:** O resultado do OCR (código de rastreio, transportadora, data) é marcado como `pendente_revisao` e exige validação e clique de confirmação do operador antes de atualizar o status do pedido.

---

## 3. LIMITES DE RESPONSABILIDADE E ISOLAMENTO

1. **Frontend não calcula valores nem altera papéis:** Todas as regras monetárias, autorizações e transições de status são executadas e validadas exclusivamente no backend.
2. **Revendedor não visualiza dados de terceiros:** Consultas no banco são filtradas pelo `user_id` autenticado (via middleware de autorização e políticas RLS).
3. **Placa Reprovada é Inacessível:** Uma placa que foi reprovada na inspeção física nunca pode ser atribuída a um revendedor nem ativada na URL permanente.
