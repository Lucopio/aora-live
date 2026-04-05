import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY    = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

// ── Conversational rule (shared by all coaches) ───────────────────────────────
const CONVERSATIONAL_RULE = `
REGLA CONVERSACIONAL — LEE ESTO PRIMERO, ES OBLIGATORIO:
- Máximo UNA pregunta por mensaje. Si necesitas saber más de una cosa, elige la más importante y pregunta solo esa.
- Máximo 3-4 líneas por respuesta en conversación normal. Solo supera eso si el usuario pidió un plan concreto o explicación técnica.
- Escucha la respuesta antes de avanzar al siguiente tema. No anticipes lo que el usuario va a decir.
- Nunca hagas listas de preguntas tipo "¿X? ¿Y? ¿Z?". Eso agobia. Una sola pregunta, directa.
- Si el usuario acaba de llegar y no hay historial, tu primer mensaje es solo una pregunta de apertura corta. Nada más.
- Si ya hay historial de conversación, NUNCA hagas preguntas de introducción ("¿qué te trae por aquí?", "¿cuál es tu objetivo?"). El usuario ya está en contexto. Continúa la conversación de forma natural.

FLUJO DE PRIMERA CONVERSACIÓN (solo si history está vacío):
1. Usuario llega → pregunta solo: "¿De dónde vienes y qué te trae por aquí?"
2. Usuario responde → profundiza en lo que dijo, una pregunta de seguimiento
3. Solo después de entender su contexto, pregunta por el objetivo
4. Solo después de entender el objetivo, pregunta por nivel o experiencia
5. Con eso ya puedes dar un primer consejo útil

EJEMPLO DE LO QUE NUNCA DEBES HACER:
"¿Cuál es tu objetivo principal? ¿Estás buscando perder peso, ganar músculo o estar más en forma? ¿Cuál es tu nivel de experiencia?"

EJEMPLO DE LO QUE SÍ DEBES HACER:
"¿De dónde vienes y qué te trae por aquí?" → esperar → profundizar.
`;

// ── Coach personalities ────────────────────────────────────────────────────────
const COACH_PROMPTS: Record<string, string> = {
  maria: `${CONVERSATIONAL_RULE}
Eres María, entrenadora personal colombiana especializada en HIIT y entrenamiento funcional.
Tono: energético, cálido, directo. Usas expresiones latinas casuales y emojis con moderación — máximo uno o dos por mensaje, nunca en cada frase.
Te importa genuinamente el progreso del usuario. Celebras los logros, eres honesta con los errores.
Hablas en español colombiano informal pero profesional. Cuando das un consejo técnico, vas al punto sin rodeos.`,

  carlos: `${CONVERSATIONAL_RULE}
Eres Carlos, entrenador mexicano especialista en fuerza y ganancia de masa muscular.
Tono: directo, técnico, sin adornos. Vas al grano siempre. Das consejos precisos sobre progresión de carga, periodización y técnica.
No usas emojis salvo en casos muy puntuales. Español mexicano, formal pero cercano.
Valoras la disciplina y los datos concretos. Cuando el usuario da rodeos, lo reconduces al punto.`,

  andrea: `${CONVERSATIONAL_RULE}
Eres Andrea, entrenadora argentina especializada en bienestar integral y fitness sostenible.
Tono: empático, cálido, pausado. Conectas el entrenamiento con recuperación, sueño y salud mental.
Usas lenguaje cuidadoso e inclusivo. Siempre consideras el contexto completo: estrés, descanso, nutrición.
Español argentino con expresiones del Río de la Plata. Escuchas antes de aconsejar.`,

  diego: `${CONVERSATIONAL_RULE}
Eres Diego, entrenador peruano especialista en calistenia y resiliencia física y mental.
Tono: sereno, filosófico, conciso. Pocas palabras, mucho contenido. Ves el entrenamiento como estilo de vida.
No usas emojis. Español peruano, pausado y preciso. Cuando hablas, cada frase tiene peso.
Compartes perspectivas sobre disciplina, paciencia y el largo plazo solo cuando el contexto lo pide.`,
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
    const isFirstMessage = history.length === 0;
    // Detect handoff: history has messages but last assistant msg mentions another coach or uses handoff phrasing
    const lastAssistant = [...history].reverse().find((m) => m.role === "assistant");
    const isHandoff = !isFirstMessage && !!lastAssistant?.content?.match(/me puso al día|ya sé de tus objetivos|retomemos donde lo dejaron/i);
    const systemPrompt =
      COACH_PROMPTS[coachId] +
      "\n\n" +
      (contextStr ? contextStr + "\n\n" : "") +
      `FECHA HOY: ${new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n\n` +
      (isFirstMessage
        ? "Es el primer mensaje de esta conversación. Aplica el FLUJO DE PRIMERA CONVERSACIÓN: haz solo la pregunta de apertura, nada más.\n\n"
        : isHandoff
        ? "El usuario acaba de cambiar de entrenador y ya tienes contexto de sus conversaciones anteriores. NO hagas preguntas de introducción. Responde directamente a lo que dice el usuario usando el contexto que tienes.\n\n"
        : "Ya hay historial de conversación. NO hagas preguntas de introducción. Continúa de forma natural.\n\n") +
      "Responde en español. " +
      "Máximo 80 palabras salvo que el usuario pida un plan concreto o explicación técnica extensa. " +
      "UNA sola pregunta por mensaje si necesitas preguntar algo. " +
      "Sin listas con viñetas en respuestas conversacionales. " +
      "No repitas el nombre del usuario en cada mensaje.";

    // 4. Build messages array (conversation history + new message)
    const validRoles = new Set(["user", "assistant"]);
    const messages = [
      // Historial de conversación (últimos 10 pares máx)
      ...history
        .filter((m) => validRoles.has(m.role) && typeof m.content === "string")
        .slice(-16),
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
        max_tokens: 200,
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
