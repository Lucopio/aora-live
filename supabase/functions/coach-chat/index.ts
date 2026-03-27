import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY    = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

// ── Coach personalities ────────────────────────────────────────────────────────
const COACH_PROMPTS: Record<string, string> = {
  maria: `Eres María, entrenadora personal colombiana especializada en HIIT y entrenamiento funcional.
Tu tono es energético, apasionado y motivador. Usas expresiones latinas casuales y emojis con moderación.
Siempre animas con intensidad y eres directa con los consejos técnicos. Tratas al usuario como tu cliente
y te importa genuinamente su progreso. Hablas en español con calidez colombiana.`,

  carlos: `Eres Carlos, entrenador mexicano especialista en fuerza y ganancia de masa muscular.
Tu tono es directo, técnico y sin rodeos. Vas al grano. Das consejos precisos sobre progresión de carga,
periodización y técnica de levantamiento. No das vueltas innecesarias. Hablas como un coach de alto
rendimiento que valora la disciplina y los resultados concretos. Español mexicano, formal pero cercano.`,

  andrea: `Eres Andrea, entrenadora argentina especializada en bienestar integral y fitness sostenible.
Tu tono es empático, cálido y holístico. Conectas el entrenamiento con la recuperación, el sueño y
la salud mental. Usas un lenguaje cuidadoso e inclusivo. Siempre consideras el contexto completo del
usuario: estrés, descanso, nutrición. Español argentino, con expresiones propias del Río de la Plata.`,

  diego: `Eres Diego, entrenador peruano especialista en calistenia y resiliencia física y mental.
Tu tono es sereno, reflexivo y filosófico. Ves el entrenamiento como un estilo de vida, no solo un
objetivo físico. Compartes perspectivas sobre disciplina, paciencia y el largo plazo. Pocas palabras,
mucho contenido. Español peruano, pausado y preciso.`,
};

// ── Helper: JSON response ──────────────────────────────────────────────────────
function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
function jsonErr(msg: string, status = 400) {
  return jsonRes({ error: msg }, status);
}

// ── Format context for the system prompt ──────────────────────────────────────
function formatContext(context: Record<string, unknown>): string {
  const parts: string[] = [];

  const profile = context.profile as Record<string, unknown> | undefined;
  if (profile) {
    const goal: Record<string, string> = {
      muscle: "ganar músculo", fat_loss: "perder grasa",
      strength: "ganar fuerza", maintenance: "mantenimiento",
    };
    const exp: Record<string, string> = {
      beginner: "principiante", intermediate: "intermedio", advanced: "avanzado",
    };
    parts.push(
      `PERFIL: Nombre: ${profile.name || "Usuario"}, ` +
      `Objetivo: ${goal[profile.goal as string] || profile.goal || "?"}, ` +
      `Nivel: ${exp[profile.experience as string] || profile.experience || "?"}, ` +
      `Días/semana: ${profile.training_days || "?"}, ` +
      `Edad: ${profile.age || "?"}, Sexo: ${profile.sex || "?"}`
    );
  }

  const recentWorkouts = context.recentWorkouts as Array<Record<string, unknown>> | undefined;
  if (recentWorkouts && recentWorkouts.length > 0) {
    const summaries = recentWorkouts.slice(0, 3).map((w, i) => {
      const date = w.date ? new Date(w.date as string).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short" }) : `sesión ${i + 1}`;
      const durationMin = w.duration ? Math.round((w.duration as number) / 60000) : "?";
      const exercises = Array.isArray(w.exercises)
        ? w.exercises.slice(0, 4).map((e: Record<string, unknown>) => e.name || e.exercise_name || "ejercicio").join(", ")
        : "sin detalle";
      return `  • ${date}: ${durationMin}min — ${exercises}`;
    });
    parts.push(`ÚLTIMOS ENTRENAMIENTOS:\n${summaries.join("\n")}`);
  }

  if (context.daysSinceLastWorkout !== undefined) {
    parts.push(`Días desde último entrenamiento: ${context.daysSinceLastWorkout}`);
  }
  if (context.weekSessions !== undefined) {
    parts.push(`Sesiones esta semana: ${context.weekSessions}`);
  }

  return parts.join("\n\n");
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonErr("Method not allowed", 405);
  }

  try {
    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonErr("Unauthorized", 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) return jsonErr("Unauthorized", 401);

    // 2. Parse body
    const body = await req.json().catch(() => ({}));
    const { coachId, message, history = [], context = {} } = body as {
      coachId: string;
      message: string;
      history: Array<{ role: string; content: string }>;
      context: Record<string, unknown>;
    };

    if (!coachId || !COACH_PROMPTS[coachId]) {
      return jsonErr("Coach inválido", 400);
    }
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return jsonErr("Mensaje vacío", 400);
    }
    if (message.length > 1000) {
      return jsonErr("Mensaje demasiado largo (máx 1000 caracteres)", 400);
    }

    // 3. Build system prompt
    const contextStr = formatContext(context);
    const systemPrompt =
      COACH_PROMPTS[coachId] +
      "\n\n" +
      (contextStr ? contextStr + "\n\n" : "") +
      `FECHA HOY: ${new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n\n` +
      "Responde en español. Máximo 200 palabras. Sé conversacional y natural. " +
      "No uses listas con viñetas salvo que sea estrictamente necesario. " +
      "No repitas el nombre del usuario en cada mensaje. " +
      "Si no tienes suficiente contexto para dar un consejo específico, hazlo saber de forma amigable.";

    // 4. Build messages array (conversation history + new message)
    const validRoles = new Set(["user", "assistant"]);
    const messages = [
      // Historial de conversación (últimos 10 pares máx)
      ...history
        .filter((m) => validRoles.has(m.role) && typeof m.content === "string")
        .slice(-20),
      // Nuevo mensaje del usuario
      { role: "user", content: message.trim() },
    ];

    // 5. Call Claude API
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: systemPrompt,
        messages,
      }),
    });

    if (!claudeRes.ok) {
      const errBody = await claudeRes.text();
      console.error("Claude API error:", claudeRes.status, errBody);
      return jsonErr("El coach no está disponible ahora. Intenta en unos momentos.", 502);
    }

    const claudeData = await claudeRes.json();
    const responseText = claudeData?.content?.[0]?.text ?? "";

    if (!responseText) {
      return jsonErr("No se recibió respuesta del coach", 502);
    }

    return jsonRes({
      response: responseText,
      tokens_used: claudeData?.usage?.output_tokens ?? 0,
    });

  } catch (err) {
    console.error("coach-chat error:", err);
    return jsonErr("Error interno del servidor", 500);
  }
});
