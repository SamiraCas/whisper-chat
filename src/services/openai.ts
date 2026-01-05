/**
 * SERVICE: Voice Chat Service
 *
 * =====================================================
 * DECISÕES ARQUITETURAIS (DEFINITIVO)
 * =====================================================
 *
 * - NÃO usa base64 ❌
 * - NÃO usa supabase.functions.invoke ❌
 * - Usa fetch direto + FormData ✅
 * - Envia File binário real (multipart/form-data) ✅
 *
 * Motivo:
 * - Whisper exige File binário real
 * - Edge Functions aceitam multipart nativamente
 * - Menos conversão = menos bugs
 */

export interface VoiceChatResponse {
  transcript: string;
  response: string;
  success: boolean;
}

/**
 * URLs da Edge Function
 *
 * 👉 LOCAL (supabase start):
 * http://localhost:54321/functions/v1/voice-chat
 *
 * 👉 PRODUÇÃO:
 * https://SEU-PROJETO.supabase.co/functions/v1/voice-chat
 */
const VOICE_CHAT_FUNCTION_URL =
  import.meta.env.DEV
    ? 'http://localhost:54321/functions/v1/voice-chat'
    : 'https://SEU-PROJETO.supabase.co/functions/v1/voice-chat';

/**
 * Processa áudio completo:
 * 1. Envia áudio para Whisper
 * 2. Recebe transcrição
 * 3. Recebe resposta da IA
 */
export async function processVoiceChat(
  audioBlob: Blob
): Promise<VoiceChatResponse> {
  console.log('[VoiceChatService] Audio debug:', {
    size: audioBlob?.size,
    type: audioBlob?.type,
  });

  if (!audioBlob || audioBlob.size === 0) {
    throw new Error('Áudio inválido ou vazio');
  }

  /**
   * IMPORTANTE:
   * Whisper exige File com filename válido
   */
  const audioFile = new File(
    [audioBlob],
    'audio.webm',
    {
      type: audioBlob.type || 'audio/webm',
      lastModified: Date.now(),
    }
  );

  const formData = new FormData();
  formData.append('file', audioFile);

  const res = await fetch(VOICE_CHAT_FUNCTION_URL, {
    method: 'POST',
    body: formData,
    // ⚠️ NÃO definir headers manualmente
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('[VoiceChatService] Backend error:', errorText);
    throw new Error(`Erro na API (${res.status})`);
  }

  const data = await res.json();

  if (!data?.transcript) {
    throw new Error('Transcrição não retornada pelo backend');
  }

  return {
    transcript: data.transcript,
    response: data.response ?? '',
    success: true,
  };
}

/**
 * Apenas transcrição (sem resposta da IA)
 */
export async function transcribeAudio(
  audioBlob: Blob
): Promise<string> {
  if (!audioBlob || audioBlob.size === 0) {
    throw new Error('Áudio inválido');
  }

  const audioFile = new File(
    [audioBlob],
    'audio.webm',
    {
      type: audioBlob.type || 'audio/webm',
      lastModified: Date.now(),
    }
  );

  const formData = new FormData();
  formData.append('file', audioFile);
  formData.append('transcriptOnly', 'true');

  const res = await fetch(VOICE_CHAT_FUNCTION_URL, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Erro na transcrição (${res.status}): ${errorText}`);
  }

  const data = await res.json();

  if (!data?.transcript) {
    throw new Error('Transcrição vazia');
  }

  return data.transcript;
}
