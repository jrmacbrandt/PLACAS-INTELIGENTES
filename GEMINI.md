# GEMINI.md — DIRETRIZES TÉCNICAS DO AMBIENTE GOOGLE AI STUDIO

**Projeto:** Plataforma de Placas Inteligentes com QR Code Dinâmico e NFC  
**Versão:** 5.0

---

## 1. AMBIENTE DE EXECUÇÃO
- **Servidor Dev:** Porta 3000 (`npm run dev`).
- **Framework:** React 19 SPA com TypeScript e Tailwind CSS v4.
- **Backend:** Express montado com TypeScript (via `tsx`).
- **Segurança de Segredos:** Nenhuma chave de API ou segredo é exposto no bundle do cliente. Rotas `/api/*` intermediam requisições sensíveis.
- **SDK Gemini:** `@google/genai` utilizando o modelo `gemini-2.5-flash` para tarefas multimodais de OCR de comprovantes de postagem.

---

## 2. GOVERNANÇA DE DESENVOLVIMENTO
- Toda execução deve respeitar estritamente o `PROMPT_MESTRE_QRCODE_VERSAO_5.0.md` e as decisões registradas em `DECISIONS.md`.
- Nenhuma etapa deve ser executada sem a conclusão, comprovação e autorização prévia da etapa anterior.
