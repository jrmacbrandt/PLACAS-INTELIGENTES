# DEPLOYMENT.md — GUIA DE IMPLANTAÇÃO E AMBIENTES (VERSÃO 5.0)

**Projeto:** Plataforma de Placas Inteligentes com QR Code Dinâmico e NFC  
**Status:** Etapa 3 — Documentação Oficial do Projeto

---

## 1. AMBIENTES DA PLATAFORMA

- **Ambiente de Desenvolvimento (AI Studio / Local):**
  - Execução na porta 3000 via `npm run dev` (Vite) ou `node server.ts` (Express + Vite middlewares).
  - Testes com banco relacional local e simuladores seguros de webhook.
- **Ambiente de Homologação (Staging):**
  - Conectado ao Asaas Sandbox (sem transações reais de dinheiro).
  - Base de dados Supabase/PostgreSQL com dados fictícios controlados.
- **Ambiente de Produção:**
  - Build estático do frontend otimizado com `npm run build`.
  - Servidor Node.js em contêiner ou Vercel Serverless / Cloud Run.
  - Conexão criptografada (SSL) com o PostgreSQL gerenciado do Supabase.

---

## 2. VARIÁVEIS DE AMBIENTE REQUERIDAS

```bash
# GEMINI API (Injetada automaticamente no AI Studio)
GEMINI_API_KEY="AIzaSy..."

# URL BASE DA APLICAÇÃO
APP_URL="https://ais-dev-6ezygfhqwiuwevza32effv-186490178798.us-west2.run.app"

# BANCO DE DADOS (PostgreSQL / Supabase)
DATABASE_URL="postgres://user:password@host:5432/placas_db"
SUPABASE_URL="https://xxxx.supabase.co"
SUPABASE_ANON_KEY="eyJhbG..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."

# GATEWAY ASAAS
ASAAS_API_URL="https://sandbox.asaas.com/api/v3"
ASAAS_API_KEY="$aact_YTU5..."
ASAAS_WEBHOOK_SECRET="whsec_..."

# ATENDIMENTO E LOGÍSTICA (ADR 003)
WHATSAPP_SUPPORT_PHONE="5511999999999"
WHATSAPP_SUPPORT_MESSAGE="Olá! Meu pedido de placas foi liberado e gostaria de combinar a retirada."
```

---

## 3. CHECKLIST PRÉ-DEPLOY EM PRODUÇÃO

1. [ ] Todas as migrações aplicadas no banco de produção.
2. [ ] RLS ativado e testado em todas as tabelas sensíveis.
3. [ ] Endpoint de webhook HTTPS configurado no painel do Asaas com validação de token.
4. [ ] Chave de produção do Asaas gerada e injetada com segurança em variáveis de segredo.
5. [ ] Suíte completa do `TEST_PLAN.md` executada e 100% aprovada.
