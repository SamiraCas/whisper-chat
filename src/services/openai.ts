/**
 * SERVICE: Voice Chat Service
 *
 * =====================================================
 * DECISÕES ARQUITETURAIS (DEFINITIVO)
 * =====================================================
 *
 * - ❌ NÃO usa base64
 * - ❌ NÃO usa supabase.functions.invoke
 * - ✅ Usa fetch direto + FormData
 * - ✅ Envia File binário real (multipart/form-data)
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
 * http://127.0.0.1:54321/functions/v1/voice-chat
 *
 * 👉 PRODUÇÃO:
 * https://SEU-PROJETO.supabase.co/functions/v1/voice-chat
 */
const VOICE_CHAT_FUNCTION_URL =
  import.meta.env.DEV
    ? 'http://127.0.0.1:54321/functions/v1/voice-chat'
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
  if (!(audioBlob instanceof Blob)) {
    throw new Error('Objeto de áudio inválido');
  }

  if (audioBlob.size === 0) {
    throw new Error('Áudio vazio');
  }

  console.log('[VoiceChatService] Audio debug:', {
    size: audioBlob.size,
    type: audioBlob.type,
  });

  /**
   * IMPORTANTE:
   * Whisper exige File real com filename válido
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

  let response: Response;

  try {
    response = await fetch(VOICE_CHAT_FUNCTION_URL, {
      method: 'POST',
      body: formData,
      // ❗ NÃO definir headers manualmente
    });
  } catch (err) {
    console.error('[VoiceChatService] Network error:', err);
    throw new Error('Falha de conexão com o backend');
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[VoiceChatService] Backend error:', errorText);
    throw new Error(`Erro na API (${response.status})`);
  }

  let data: any;

  try {
    data = await response.json();
  } catch {
    throw new Error('Resposta inválida do backend (JSON)');
  }

  if (!data || typeof data.transcript !== 'string') {
    throw new Error('Transcrição não retornada pelo backend');
  }

  return {
    transcript: data.transcript,
    response: typeof data.response === 'string' ? data.response : '',
    success: true,
  };
}

/**
 * Apenas transcrição (sem resposta da IA)
 */
export async function transcribeAudio(
  audioBlob: Blob
): Promise<string> {
  if (!(audioBlob instanceof Blob)) {
    throw new Error('Objeto de áudio inválido');
  }

  if (audioBlob.size === 0) {
    throw new Error('Áudio vazio');
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

  const response = await fetch(VOICE_CHAT_FUNCTION_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Erro na transcrição (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();

  if (!data || typeof data.transcript !== 'string') {
    throw new Error('Transcrição vazia');
  }

  return data.transcript;
}
