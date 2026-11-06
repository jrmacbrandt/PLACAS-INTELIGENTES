import { GoogleGenAI } from '@google/genai';

export interface OcrReceiptResult {
  sucesso: boolean;
  codigo_rastreamento: string | null;
  data_postagem: string | null;
  transportadora: string | null;
  confianca: 'alta' | 'media' | 'baixa';
  texto_completo: string;
  requer_revisao_manual: boolean;
  mensagem?: string;
}

/**
 * Análise de Comprovante de Postagem via Gemini OCR
 * Conforme Seção 17 do Prompt Mestre v5.0
 * Sempre requer confirmação manual antes de persistir no banco.
 */
export async function analyzeReceiptWithGemini(imageBase64: string, mimeType: string): Promise<OcrReceiptResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      sucesso: false,
      codigo_rastreamento: null,
      data_postagem: null,
      transportadora: null,
      confianca: 'baixa',
      texto_completo: '',
      requer_revisao_manual: true,
      mensagem: 'GEMINI_API_KEY não configurada no ambiente.',
    };
  }

  try {
    const ai = new GoogleGenAI();
    const prompt = `Você é um assistente de OCR especializado em comprovantes de postagem de encomendas dos Correios e transportadoras do Brasil.
Analise a imagem deste comprovante e extraia as seguintes informações no formato JSON rigoroso:
{
  "codigo_rastreamento": "string com o código de rastreamento (ex: AA123456789BR ou numérico) ou null se não encontrar claramente",
  "data_postagem": "string com a data no formato AAAA-MM-DD ou null",
  "transportadora": "nome da transportadora (ex: Correios, Jadlog, etc) ou null",
  "confianca": "alta" se os dados estão legíveis sem ambiguidade, "media" se há caracteres duvidosos, "baixa" se ilegível,
  "resumo_texto": "texto principal do comprovante"
}
Retorne estritamente o JSON sem marcação extra de markdown.`;

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: cleanBase64,
                mimeType: mimeType || 'image/jpeg',
              },
            },
          ],
        },
      ],
    });

    const textOutput = response.text || '';
    let parsed: any = {};
    try {
      const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Ignora erro de parse, cai no fallback de revisão manual
    }

    return {
      sucesso: true,
      codigo_rastreamento: parsed.codigo_rastreamento || null,
      data_postagem: parsed.data_postagem || null,
      transportadora: parsed.transportadora || 'Correios',
      confianca: parsed.confianca || 'media',
      texto_completo: parsed.resumo_texto || textOutput,
      requer_revisao_manual: true, // Conforme regra inegociável, OCR sempre exige conferência humana
    };
  } catch (error: any) {
    console.error('[GEMINI_OCR_ERROR]', error);
    return {
      sucesso: false,
      codigo_rastreamento: null,
      data_postagem: null,
      transportadora: null,
      confianca: 'baixa',
      texto_completo: '',
      requer_revisao_manual: true,
      mensagem: error?.message || 'Falha ao processar imagem com Gemini.',
    };
  }
}
