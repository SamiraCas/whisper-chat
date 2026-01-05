/**
 * SERVIÇO: OpenAI Service
 * 
 * ============================================
 * ARQUITETURA DO CLIENTE
 * ============================================
 * 
 * Este serviço encapsula as chamadas às edge functions,
 * fornecendo uma API limpa para os componentes React.
 * 
 * DECISÕES:
 * - Usa supabase.functions.invoke (não fetch direto)
 * - Converte Blob para base64 para transmissão segura
 * - Tratamento centralizado de erros
 * - Tipagem forte para respostas
 * 
 * POR QUE BASE64?
 * - JSON não suporta dados binários diretamente
 * - Base64 é padrão para transmissão de binário via HTTP
 * - Overhead de ~33% é aceitável para áudios curtos
 */

import { supabase } from '@/integrations/supabase/client';

export interface VoiceChatResponse {
  transcript: string;
  response: string;
  success: boolean;
}

export interface TranscriptionResponse {
  transcript: string;
}

/**
 * Converte Blob para string base64
 * 
 * Usa FileReader para leitura assíncrona do blob,
 * retornando uma Promise com a string base64
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Falha ao converter para base64'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo de áudio'));
    };
    
    reader.readAsDataURL(blob);
  });
}

/**
 * Processa áudio e obtém transcrição + resposta da IA
 * 
 * FLUXO:
 * 1. Converte áudio para base64
 * 2. Envia para edge function
 * 3. Recebe transcrição e resposta
 * 4. Retorna dados tipados
 * 
 * @param audioBlob - Blob de áudio gravado
 * @returns Transcrição e resposta da IA
 */
export async function processVoiceChat(audioBlob: Blob): Promise<VoiceChatResponse> {
  console.log('[OpenAIService] Processing voice chat...');
  console.log(`[OpenAIService] Audio size: ${audioBlob.size} bytes, type: ${audioBlob.type}`);

  try {
    // Converte para base64
    const base64Audio = await blobToBase64(audioBlob);
    console.log(`[OpenAIService] Base64 length: ${base64Audio.length}`);

    // Chama edge function
    const { data, error } = await supabase.functions.invoke('voice-chat', {
      body: { audio: base64Audio },
    });

    if (error) {
      console.error('[OpenAIService] Edge function error:', error);
      throw new Error(error.message || 'Erro ao processar áudio');
    }

    if (data?.error) {
      console.error('[OpenAIService] API error:', data.error);
      throw new Error(data.error);
    }

    console.log('[OpenAIService] Success:', {
      transcript: data.transcript?.substring(0, 50),
      response: data.response?.substring(0, 50),
    });

    return {
      transcript: data.transcript || '',
      response: data.response || '',
      success: true,
    };
  } catch (err) {
    console.error('[OpenAIService] Error:', err);
    throw err;
  }
}

/**
 * Obtém apenas a transcrição (sem resposta da IA)
 * 
 * Útil quando você quer processar o texto de outra forma
 */
export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  console.log('[OpenAIService] Transcribing audio...');

  try {
    const base64Audio = await blobToBase64(audioBlob);

    const { data, error } = await supabase.functions.invoke('voice-chat', {
      body: { audio: base64Audio, transcriptOnly: true },
    });

    if (error) {
      throw new Error(error.message || 'Erro na transcrição');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data.transcript || '';
  } catch (err) {
    console.error('[OpenAIService] Transcription error:', err);
    throw err;
  }
}

/**
 * Gera resposta da IA a partir de texto
 * 
 * Alternativa para quando já tem o texto e quer apenas a resposta
 */
export async function generateChatResponse(text: string): Promise<string> {
  console.log('[OpenAIService] Generating response for:', text.substring(0, 50));

  try {
    const { data, error } = await supabase.functions.invoke('voice-chat', {
      body: { text },
    });

    if (error) {
      throw new Error(error.message || 'Erro ao gerar resposta');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data.response || '';
  } catch (err) {
    console.error('[OpenAIService] Chat error:', err);
    throw err;
  }
}
