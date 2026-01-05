/**
 * EDGE FUNCTION: voice-chat
 * 
 * ============================================
 * ARQUITETURA DO FLUXO
 * ============================================
 * 
 * 1. Cliente envia áudio em base64
 * 2. Edge function converte para File
 * 3. Envia para OpenAI Whisper (transcrição)
 * 4. Recebe texto transcrito
 * 5. Envia para Lovable AI (completions)
 * 6. Retorna transcrição + resposta
 * 
 * ============================================
 * DECISÕES TÉCNICAS
 * ============================================
 * 
 * POR QUE USAR FormData?
 * - A API Whisper espera arquivos de áudio
 * - FormData é o padrão para upload de arquivos via HTTP
 * - Permite enviar metadados junto com o arquivo
 * - Suporta diferentes formatos de áudio
 * 
 * POR QUE PROCESSAR NO BACKEND?
 * - Mantém a API key segura (nunca exposta ao cliente)
 * - Permite transformações no áudio se necessário
 * - Centraliza lógica de erro e retry
 * - Facilita logging e monitoramento
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Converte base64 para Uint8Array
 * 
 * Necessário porque a API Whisper espera bytes binários,
 * mas transmitimos como base64 para segurança no JSON
 */
function base64ToUint8Array(base64: string): Uint8Array {
  // Remove o prefixo data URL se existir
  const base64Clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = atob(base64Clean);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes;
}

/**
 * Detecta o tipo MIME do áudio pelo header base64
 */
function detectMimeType(base64: string): string {
  if (base64.startsWith('data:')) {
    const match = base64.match(/data:([^;]+);/);
    if (match) return match[1];
  }
  
  // Fallback para webm (mais comum)
  return 'audio/webm';
}

/**
 * Transcreve áudio usando Lovable AI Gateway
 * 
 * Usamos o modelo whisper via gateway da Lovable
 * que é compatível com a API da OpenAI
 */
async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY não está configurada');
  }

  console.log(`[Transcribe] Audio blob size: ${audioBlob.size} bytes`);

  // Cria FormData com o arquivo de áudio
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', 'whisper-1');
  formData.append('language', 'pt'); // Português
  formData.append('response_format', 'json');

  const response = await fetch('https://ai.gateway.lovable.dev/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Transcribe] Error:', response.status, errorText);
    throw new Error(`Erro na transcrição: ${response.status}`);
  }

  const result = await response.json();
  console.log('[Transcribe] Success:', result.text?.substring(0, 100));
  
  return result.text || '';
}

/**
 * Gera resposta usando Lovable AI Gateway
 * 
 * Envia a transcrição para o modelo de chat
 * e recebe uma resposta contextual
 */
async function generateResponse(transcript: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  
  if (!LOVABLE_API_KEY) {
    throw new Error('LOVABLE_API_KEY não está configurada');
  }

  console.log(`[Chat] Generating response for: ${transcript.substring(0, 50)}...`);

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content: `Você é um assistente de IA amigável e prestativo. 
Responda de forma clara, concisa e em português brasileiro.
Seja natural e conversacional, como se estivesse em uma conversa por voz.
Se a pergunta for técnica, forneça informações precisas e úteis.
Mantenha as respostas relativamente curtas (2-4 parágrafos) para adequar-se ao formato de voz.`
        },
        {
          role: 'user',
          content: transcript
        }
      ],
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Chat] Error:', response.status, errorText);
    
    // Tratamento específico de rate limits
    if (response.status === 429) {
      throw new Error('Limite de requisições excedido. Tente novamente em alguns segundos.');
    }
    if (response.status === 402) {
      throw new Error('Créditos esgotados. Por favor, adicione créditos na sua conta.');
    }
    
    throw new Error(`Erro na geração de resposta: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || '';
  
  console.log('[Chat] Response generated:', content.substring(0, 100));
  
  return content;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audio, transcriptOnly } = await req.json();

    if (!audio) {
      return new Response(
        JSON.stringify({ error: 'Áudio não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[VoiceChat] Processing audio...');

    // Converte base64 para Blob
    const audioBytes = base64ToUint8Array(audio);
    const mimeType = detectMimeType(audio);
    // Cria ArrayBuffer explicitamente para compatibilidade com Deno
    const arrayBuffer = new ArrayBuffer(audioBytes.length);
    new Uint8Array(arrayBuffer).set(audioBytes);
    const audioBlob = new Blob([arrayBuffer], { type: mimeType });

    console.log(`[VoiceChat] Audio size: ${audioBlob.size} bytes, type: ${mimeType}`);

    // Etapa 1: Transcrição
    const transcript = await transcribeAudio(audioBlob);

    if (!transcript || transcript.trim() === '') {
      return new Response(
        JSON.stringify({ 
          error: 'Não foi possível transcrever o áudio. Tente falar mais alto ou mais perto do microfone.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se solicitado apenas transcrição, retorna aqui
    if (transcriptOnly) {
      return new Response(
        JSON.stringify({ transcript }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Etapa 2: Geração de resposta
    const response = await generateResponse(transcript);

    return new Response(
      JSON.stringify({ 
        transcript,
        response,
        success: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[VoiceChat] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
