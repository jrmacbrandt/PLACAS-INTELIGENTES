# CHANGELOG.md — HISTÓRICO DE VERSÕES E ALTERAÇÕES

Todas as modificações relevantes, decisões e marcos do projeto são registrados neste arquivo.

---

## [5.0.0] — 2026-10-26
### Adicionado
- **Prompt Mestre Versão 5.0:** Conversão integral do PDF para `/PROMPT_MESTRE_QRCODE_VERSAO_5.0.md` e `/PROMPT_MESTRE.md`.
- **Adendo Obrigatório v5.0:** Requisitos detalhados de cadastro autônomo, controle individual de placas, ativação/desativação por controle alternável único e compartilhamento de URL permanente entre QR Code e NFC.
- **ADR 001:** Decisão formal de persistência relacional em PostgreSQL puro com RLS compatível com Supabase.
- **ADR 002:** Tabela de precificação global aprovada: R$ 21,90 (1-9 un), R$ 19,90 (10-49 un), R$ 17,90 (50+ un).
- **ADR 003:** Logística dual de Retirada (contato WhatsApp) vs. Correios, com permissão de alteração pelo Administrador com auditoria.
- **Documentação Oficial (Etapa 3):** Criação de `PRD.md`, `ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`, `IMPLEMENTATION_PLAN.md`, `DECISIONS.md`, `TEST_PLAN.md`, `DEPLOYMENT.md`, `RUNBOOK.md`, `GEMINI.md`.

### Alterado
- **Unificação Comercial Total:** Extinção de portais e tabelas comerciais separadas para vendedores internos. Ambos compartilham o modelo unificado de revendedor com o atributo `tipo_parceiro`.
