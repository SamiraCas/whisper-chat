/**
 * EDGE FUNCTION: voice-chat
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
 * ENV + OpenAI (SAFE)
 * ======================= */
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

if (!OPENAI_API_KEY) {
  console.error("[BOOT] ❌ OPENAI_API_KEY NÃO CONFIGURADA");
  throw new Error("OPENAI_API_KEY ausente");
}

console.log("[BOOT] ✅ OPENAI_API_KEY carregada");

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

/* =======================
 * Whisper
 * ======================= */
async function transcribeAudio(file: File): Promise<string> {
  if (!file || file.size === 0) {
    throw new Error("Arquivo de áudio inválido ou vazio");
  }

  const safeFile =
    file.type.includes("webm") || file.type.includes("ogg")
      ? file
      : new File([file], "audio.webm", { type: "audio/webm" });

  const transcription = await openai.audio.transcriptions.create({
    file: safeFile,
    model: "whisper-1",
    language: "pt",
  });

  if (!transcription.text?.trim()) {
    throw new Error("Transcrição vazia");
  }

  return transcription.text;
}

/* =======================
 * Chat (API NOVA)
 * ======================= */
async function generateResponse(transcript: string): Promise<string> {
  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content:
          "Você é um assistente amigável. Responda em português brasileiro, de forma clara e natural.",
      },
      {
        role: "user",
        content: transcript,
      },
    ],
  });

  const output = response.output_text;

  if (!output) {
    throw new Error("Resposta do chat vazia");
  }

  return output;
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
    const chatResponse = await generateResponse(transcript);

    return new Response(
      JSON.stringify({
        success: true,
        transcript,
        response: chatResponse,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[VoiceChat] ERRO:", err);

    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Erro interno",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
