/**
 * EDGE FUNCTION: voice-chat
 *
 * Fluxo:
 * 1. Front envia áudio via FormData (file)
 * 2. Edge recebe o arquivo
 * 3. Whisper transcreve
 * 4. Chat gera resposta
 * 5. Retorna JSON
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import OpenAI from "https://esm.sh/openai@4.56.0";

/* =======================
 * CORS
 * ======================= */
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/* =======================
 * OpenAI
 * ======================= */
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

if (!OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY não configurada");
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY!,
});

/* =======================
 * Whisper
 * ======================= */
async function transcribeAudio(file: File): Promise<string> {
  console.log("[Whisper] Recebido:", {
    name: file.name,
    type: file.type,
    size: file.size,
  });

  if (file.size === 0) {
    throw new Error("Arquivo de áudio vazio");
  }

  // Garantia de compatibilidade
  const safeFile =
    file.type.includes("webm") || file.type.includes("ogg")
      ? file
      : new File([file], "audio.webm", { type: "audio/webm" });

  const transcription = await openai.audio.transcriptions.create({
    file: safeFile,
    model: "whisper-1", // ✅ MODELO CORRETO
    language: "pt",
  });

  console.log("[Whisper] Resultado:", transcription.text);

  if (!transcription.text?.trim()) {
    throw new Error("Transcrição vazia");
  }

  return transcription.text;
}

/* =======================
 * Chat
 * ======================= */
async function generateResponse(transcript: string): Promise<string> {
  console.log("[Chat] Prompt:", transcript.substring(0, 100));

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content:
          "Você é um assistente amigável. Responda em português brasileiro, de forma clara, objetiva e natural.",
      },
      {
        role: "user",
        content: transcript,
      },
    ],
    temperature: 0.7,
  });

  const content = completion.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Resposta do chat vazia");
  }

  return content;
}

/* =======================
 * HTTP Handler
 * ======================= */
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método não permitido" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const formData = await req.formData();

    console.log(
      "[DEBUG] formData:",
      [...formData.entries()].map(([k, v]) => [
        k,
        v instanceof File ? "File" : typeof v,
      ])
    );

    const file = formData.get("file");
    const transcriptOnly = formData.get("transcriptOnly") === "true";

    if (!(file instanceof File)) {
      return new Response(
        JSON.stringify({ error: "Campo 'file' não enviado corretamente" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    /* 1️⃣ Transcrição */
    const transcript = await transcribeAudio(file);

    if (transcriptOnly) {
      return new Response(JSON.stringify({ transcript }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    /* 2️⃣ Chat */
    const response = await generateResponse(transcript);

    return new Response(
      JSON.stringify({
        success: true,
        transcript,
        response,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[VoiceChat] ERRO:", err);

    const message =
      err instanceof Error ? err.message : "Erro interno";

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
