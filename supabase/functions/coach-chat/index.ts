import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY    = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL         = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// ── Allowed origins ────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://lucopio.github.io",
  "https://aora-live.pages.dev",
  "https://app.aoralive.com",
  "https://aoralive.com",
  "https://www.aoralive.com",
  "http://localhost:5500",   // dev — Live Server
  "http://127.0.0.1:5500",  // dev — Live Server
];

// Regex para subdominios de Cloudflare Pages preview (hash hex + .aora-live.pages.dev)
const PREVIEW_SUBDOMAIN_REGEX = /^https:\/\/[a-f0-9]+\.aora-live\.pages\.dev$/;

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || PREVIEW_SUBDOMAIN_REGEX.test(origin);
  const allowedOrigin = isAllowed ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

// ── Conversational rule (shared by all coaches) ────────────────────────────
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

// ── Workout context interpretation rules (shared by all coaches) ──────────
const WORKOUT_CONTEXT_RULES = `
Si activeWorkout es null o no existe → el usuario NO está entrenando. No actúes como si estuviera en el gym.
Si activeWorkout.isActive === true → ESTÁ entrenando ahora mismo. Nunca preguntes si sigue entrenando.

Identifica el ejercicio correcto:
- "Ejercicio en curso" = lo que hace AHORA (puede ser nulo si está entre ejercicios).
- "Último ejercicio completado" = el que terminó justo antes.
- "Ejercicios completados" = historial de la sesión (no incluye el actual).
- "Ejercicios pendientes" = lo que falta según la rutina.

Reglas de precisión:
- Para hablar del ejercicio actual: usa "Ejercicio en curso". Si es nulo, usa "Último ejercicio completado" para felicitar, no para decir que sigue haciéndolo.
- Para decir cuántas series faltan: usa el campo "Faltan: X" de las series registradas. Si no está, no inventes — di "vamos paso a paso".
- Para comentar RPE: usa "Última serie RPE". Si no está, no comentes RPE.
- Si ves "Estado: descansando" → el usuario está en pausa. Respeta el momento.
- Si ves "Estado: entre ejercicios" → valida lo que terminó antes de presionarlo con lo siguiente.

Tono según avance:
- Menos de 2 ejercicios completados y menos de 10 min → energía de inicio.
- Muchos ejercicios completados con RPE alto promedio → reconoce el esfuerzo, no exijas más.
- Más de 60 minutos → considera sugerir cierre.

Precisión ante elocuencia: nunca inventes series, pesos, RPE ni ejercicios que no estén en el contexto.
`.trim();

// ── Coach personalities ────────────────────────────────────────────────────
const COACH_PROMPTS: Record<string, string> = {
  maria: `${CONVERSATIONAL_RULE}
Eres María, entrenadora personal colombiana especializada en HIIT y entrenamiento funcional.
Tono: energético, cálido, directo. Usas expresiones latinas casuales y emojis con moderación — máximo uno o dos por mensaje, nunca en cada frase.
Te importa genuinamente el progreso del usuario. Celebras los logros, eres honesta con los errores.
Hablas en español colombiano informal pero profesional. Cuando das un consejo técnico, vas al punto sin rodeos.

REGLAS PARA INTERPRETAR EL CONTEXTO DEL USUARIO:
${WORKOUT_CONTEXT_RULES}`,

  carlos: `${CONVERSATIONAL_RULE}
Eres Carlos, entrenador mexicano especialista en fuerza y ganancia de masa muscular.
Tono: directo, técnico, sin adornos. Vas al grano siempre. Das consejos precisos sobre progresión de carga, periodización y técnica.
No usas emojis salvo en casos muy puntuales. Español mexicano, formal pero cercano.
Valoras la disciplina y los datos concretos. Cuando el usuario da rodeos, lo reconduces al punto.

REGLAS PARA INTERPRETAR EL CONTEXTO DEL USUARIO:
${WORKOUT_CONTEXT_RULES}`,

  andrea: `${CONVERSATIONAL_RULE}
Eres Andrea, entrenadora argentina especializada en bienestar integral y fitness sostenible.
Tono: empático, cálido, pausado. Conectas el entrenamiento con recuperación, sueño y salud mental.
Usas lenguaje cuidadoso e inclusivo. Siempre consideras el contexto completo: estrés, descanso, nutrición.
Español argentino con expresiones del Río de la Plata. Escuchas antes de aconsejar.

REGLAS PARA INTERPRETAR EL CONTEXTO DEL USUARIO:
${WORKOUT_CONTEXT_RULES}`,

  diego: `${CONVERSATIONAL_RULE}
Eres Diego, entrenador peruano especialista en calistenia y resiliencia física y mental.
Tono: sereno, filosófico, conciso. Pocas palabras, mucho contenido. Ves el entrenamiento como estilo de vida.
No usas emojis. Español peruano, pausado y preciso. Cuando hablas, cada frase tiene peso.
Compartes perspectivas sobre disciplina, paciencia y el largo plazo solo cuando el contexto lo pide.

REGLAS PARA INTERPRETAR EL CONTEXTO DEL USUARIO:
${WORKOUT_CONTEXT_RULES}`,
};

// ── Helper: JSON response ──────────────────────────────────────────────────
function jsonRes(body: unknown, status = 200, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
function jsonErr(msg: string, status = 400, cors: Record<string, string> = {}) {
  return jsonRes({ error: msg }, status, cors);
}

// ── Format context for the system prompt ──────────────────────────────────
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

  // ── Contexto del entrenamiento ACTIVO (si hay uno en curso) ────────────
  const activeWorkout = context.activeWorkout as Record<string, unknown> | null | undefined;
  if (activeWorkout && activeWorkout.isActive) {
    const awLines: string[] = [];
    awLines.push("⚡ ENTRENAMIENTO ACTIVO AHORA MISMO:");
    awLines.push("El usuario está entrenando EN ESTE MOMENTO. No le sugieras \"intenta mañana\" ni \"la próxima sesión\" — está en medio del entrenamiento ahora. Da feedback sobre lo que está haciendo AHORA.");

    if (activeWorkout.routineName) {
      awLines.push(`Rutina: ${activeWorkout.routineName}`);
    }
    awLines.push(`Tiempo transcurrido: ${activeWorkout.elapsedMinutes} min`);

    if (activeWorkout.primaryMuscleGroup) {
      awLines.push(`Grupo muscular principal: ${activeWorkout.primaryMuscleGroup}`);
    }

    if (activeWorkout.mode === "rest-only") {
      awLines.push("Modo: solo descansos (no registra sets, solo tiempos)");
    }

    if (activeWorkout.currentExercise) {
      const equip = activeWorkout.currentExerciseEquipment ? ` (${activeWorkout.currentExerciseEquipment})` : "";
      awLines.push(`Ejercicio en curso: ${activeWorkout.currentExercise}${equip}`);

      const currentSets = (activeWorkout.currentSets as Array<Record<string, unknown>>) || [];
      const workSets = currentSets.filter(s => !s.is_warmup_set);
      const target = activeWorkout.currentTargetSets as number | null;
      const remaining = activeWorkout.setsRemaining as number | null;

      if (workSets.length > 0) {
        const targetStr = target ? ` de ${target} · Faltan: ${remaining}` : "";
        awLines.push(`  Series registradas: ${workSets.length}${targetStr}`);
        workSets.forEach((s, i) => {
          const rpe = s.rpe != null ? ` · RPE ${s.rpe}` : "";
          const side = s.side ? ` (${s.side})` : "";
          awLines.push(`    Serie ${i + 1}: ${s.weight}kg × ${s.reps} reps${rpe}${side}`);
        });
        if (activeWorkout.lastSetRpe != null) {
          awLines.push(`  Última serie RPE: ${activeWorkout.lastSetRpe}`);
        }
      } else {
        const targetStr = target ? ` (objetivo: ${target} series)` : "";
        awLines.push(`  Aún no ha registrado series en este ejercicio${targetStr}.`);
      }
      if (activeWorkout.isResting) {
        awLines.push(`  Estado: descansando`);
      }
    } else {
      const lastEx = activeWorkout.lastCompletedExercise as Record<string, unknown> | null;
      if (lastEx) {
        const lastRpe = lastEx.avgRpe != null ? ` · RPE prom ${lastEx.avgRpe}` : "";
        awLines.push(`Estado: entre ejercicios`);
        awLines.push(`Último ejercicio completado: ${lastEx.name} (${lastEx.setsCount} series${lastRpe})`);
      } else {
        awLines.push("Estado: inicio de sesión, aún no hay ejercicio seleccionado.");
      }
    }

    const completedCount = activeWorkout.totalExercisesCompleted as number || 0;
    if (completedCount > 0) {
      const completed = (activeWorkout.completedExercises as Array<Record<string, unknown>>) || [];
      awLines.push(`Ejercicios completados en esta sesión (${completedCount}):`);
      completed.forEach(e => {
        const rpe = e.avgRpe != null ? ` · RPE prom ${e.avgRpe}` : "";
        awLines.push(`  - ${e.name}: ${e.setsCount} series${rpe}`);
      });
    }

    const pendingCount = activeWorkout.totalExercisesPending as number || 0;
    if (pendingCount > 0) {
      const pending = (activeWorkout.pendingExercises as Array<Record<string, unknown>>) || [];
      awLines.push(`Ejercicios pendientes en la rutina (${pendingCount}):`);
      pending.slice(0, 5).forEach(e => {
        awLines.push(`  - ${e.name}`);
      });
      if (pendingCount > 5) {
        awLines.push(`  ...y ${pendingCount - 5} más`);
      }
    }

    parts.push(awLines.join("\n"));
  }

  return parts.join("\n\n");
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
    // 1. Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonErr("Unauthorized", 401, corsHeaders);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) return jsonErr("Unauthorized", 401, corsHeaders);

    // 2. Parse body
    const body = await req.json().catch(() => ({}));
    const { coachId, message, history = [], context = {} } = body as {
      coachId: string;
      message: string;
      history: Array<{ role: string; content: string }>;
      context: Record<string, unknown>;
    };

    if (!coachId || !COACH_PROMPTS[coachId]) {
      return jsonErr("Coach inválido", 400, corsHeaders);
    }
    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return jsonErr("Mensaje vacío", 400, corsHeaders);
    }
    if (message.length > 1000) {
      return jsonErr("Mensaje demasiado largo (máx 1000 caracteres)", 400, corsHeaders);
    }

    // 3. Build system prompt
    const contextStr = formatContext(context);
    const isFirstMessage = history.length === 0;
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

    // 4. Build messages array
    const validRoles = new Set(["user", "assistant"]);
    const messages = [
      ...history
        .filter((m) => validRoles.has(m.role) && typeof m.content === "string")
        .slice(-16),
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
      return jsonErr("El coach no está disponible ahora. Intenta en unos momentos.", 502, corsHeaders);
    }

    const claudeData = await claudeRes.json();
    const responseText = claudeData?.content?.[0]?.text ?? "";

    if (!responseText) {
      return jsonErr("No se recibió respuesta del coach", 502, corsHeaders);
    }

    return jsonRes({
      response: responseText,
      tokens_used: claudeData?.usage?.output_tokens ?? 0,
    }, 200, corsHeaders);

  } catch (err) {
    console.error("coach-chat error:", err);
    return jsonErr("Error interno del servidor", 500, corsHeaders);
  }
});
