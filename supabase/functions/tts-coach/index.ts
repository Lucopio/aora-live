const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY") ?? "";
const SUPABASE_ANON_KEY  = Deno.env.get("SUPABASE_ANON_KEY")  ?? "";

// ── Voice IDs por coach ────────────────────────────────────────────────────
const VOICE_IDS: Record<string, string> = {
  maria:   "VmejBeYhbrcTPwDniox7",
  carlos:  "dn9HtxgDwCH96MVX9iAO",
  andrea:  "6Mo5ciGH5nWiQacn5FYk",
  diego:   "eklUXgdI2kEgVcRbATIu",
};

// ── Allowed origins ────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://lucopio.github.io",
  "https://aora-live.pages.dev",
  "https://aoralive.com",
  "https://app.aoralive.com",
  "https://www.aoralive.com",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin":  allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonErr(msg: string, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// ── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonErr("Method not allowed", 405, corsHeaders);
  }

  try {
    // 1. Auth — verificar anon key (ya pública en el frontend, protege de abuso externo)
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!token || token !== SUPABASE_ANON_KEY) {
      return jsonErr("Unauthorized", 401, corsHeaders);
    }

    // 2. Parse body
    const body = await req.json().catch(() => ({}));
    const { text, coachId } = body as { text: string; coachId: string };

    if (!coachId || !VOICE_IDS[coachId]) {
      return jsonErr("coachId inválido. Valores aceptados: maria, carlos, andrea, diego", 400, corsHeaders);
    }
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return jsonErr("text es requerido y no puede estar vacío", 400, corsHeaders);
    }
    if (text.length > 500) {
      return jsonErr("text demasiado largo (máx 500 caracteres)", 400, corsHeaders);
    }

    const voiceId = VOICE_IDS[coachId];

    // 3. Llamar a ElevenLabs TTS
    const elRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key":   ELEVENLABS_API_KEY,
          "Accept":       "audio/mpeg",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability:        0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!elRes.ok) {
      const errText = await elRes.text();
      console.error("ElevenLabs error:", elRes.status, errText);
      return jsonErr(
        `ElevenLabs no disponible (${elRes.status}). Intenta en unos momentos.`,
        502,
        corsHeaders
      );
    }

    // 4. Devolver el audio binario al cliente
    const audioBuffer = await elRes.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type":  "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });

  } catch (err) {
    console.error("tts-coach error:", err);
    return jsonErr("Error interno del servidor", 500, corsHeaders);
  }
});
