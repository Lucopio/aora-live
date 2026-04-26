import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Full analysis cooldown: 7 days
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

// Wellness tip categories that rotate
const WELLNESS_CATEGORIES = ["sleep", "hydration", "supplement_omega3", "supplement_magnesium", "supplement_multivitamin", "recovery", "nutrition"];

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

// ── Helper ─────────────────────────────────────────────────────────────────
function jsonErr(message: string, status: number, cors: Record<string, string> = {}) {
  return new Response(JSON.stringify({ error: message }), {
    status, headers: { "Content-Type": "application/json", ...cors },
  });
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonErr("Unauthorized", 401, corsHeaders);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) return jsonErr("Unauthorized", 401, corsHeaders);

    const userId = user.id;
    const body = await req.json().catch(() => ({}));
    const tipType = body.type ?? "full"; // "full" | "tip"

    // Load user profile (used by both modes)
    const { data: profile } = await supabase.from("profiles")
      .select("full_name, age, sex, body_weight, body_weight_unit, training_days, experience, training_goal, activity_level")
      .eq("id", userId).single();

    const profileStr = profile
      ? `Objetivo: ${profile.training_goal || "?"}, Experiencia: ${profile.experience || "?"}, Días/semana: ${profile.training_days || "?"}, Peso: ${profile.body_weight || "?"}${profile.body_weight_unit || "kg"}, Edad: ${profile.age || "?"}`
      : "Perfil no disponible";

    // ── TIP MODE ───────────────────────────────────────────────────────────
    if (tipType === "tip") {
      const context = body.context ?? {};
      const workout = context.workout;
      const tipCategory = context.tip_category ?? "auto";
      const daysSinceLast = context.days_since_last_workout ?? 0;
      const totalWorkouts = context.total_workouts ?? 0;

      let prompt = "";

      if (workout) {
        // Post-workout tip
        const exList = (workout.exercises_detail || []).map((ex: {name: string; equipment?: string; sets?: {reps: number; weight: number; unit: string; rest_after_ms?: number; rest_status?: string}[]}) =>
          `${ex.name}: ${(ex.sets || []).length} series`
        ).join(", ");
        const adherencePct = workout.rest_adherence != null ? Math.round(workout.rest_adherence * 100) : null;
        const avgRestS = workout.avg_rest_ms != null ? Math.round(workout.avg_rest_ms / 1000) : null;

        prompt = `Eres un entrenador personal experto. El usuario acaba de terminar un entrenamiento. Da UNA recomendación específica y accionable basada en los datos reales.

PERFIL: ${profileStr}
ENTRENAMIENTO: Duración ${Math.round((workout.duration || 0) / 60000)}min, ${workout.exercises || 0} ejercicios: ${exList}
DESCANSO: adherencia ${adherencePct != null ? adherencePct + "%" : "sin datos"}, promedio real ${avgRestS != null ? avgRestS + "s" : "sin datos"}

CATEGORÍAS POSIBLES: workout_feedback, hydration, sleep, recovery, progression, supplement
Elige la más relevante según los datos. Si la adherencia al descanso es <50%, prioriza "workout_feedback" sobre el descanso.

Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{"emoji":"...","message":"tip específico y accionable en español, máx 110 caracteres","category":"..."}`;

      } else {
        // Daily wellness tip
        const cat = tipCategory !== "auto" ? tipCategory : WELLNESS_CATEGORIES[Math.floor(Math.random() * WELLNESS_CATEGORIES.length)];
        const categoryPrompts: Record<string, string> = {
          sleep: "sobre la importancia de dormir 8 horas para la recuperación muscular y el crecimiento",
          hydration: "sobre hidratación: cuánta agua tomar y cuándo durante el día",
          supplement_omega3: "sobre el Omega-3: beneficios anti-inflamatorios para el rendimiento deportivo",
          supplement_magnesium: "sobre el magnesio: su rol en la recuperación muscular y calidad del sueño",
          supplement_multivitamin: "sobre multivitamínicos: cuándo considerarlos y qué buscar",
          recovery: "sobre recuperación activa, foam rolling o días de descanso",
          nutrition: "sobre nutrición post-entrenamiento y ventana anabólica",
        };
        const topicHint = categoryPrompts[cat] || "sobre bienestar general para deportistas";

        prompt = `Eres un entrenador personal experto. Da UN tip de bienestar ${topicHint}.

PERFIL: ${profileStr}
CONTEXTO: ${totalWorkouts} entrenamientos registrados, ${daysSinceLast === 0 ? "entrenó hoy" : `último entrenamiento hace ${daysSinceLast} días`}

El tip debe ser:
- Específico y accionable (no genérico)
- Breve (máx 110 caracteres)
- Relevante para el perfil del usuario
- Categoría: ${cat}

Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{"emoji":"...","message":"tip en español, máx 110 caracteres","category":"${cat}"}`;
      }

      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 150,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!anthropicRes.ok) return jsonErr("Error al contactar IA.", 502, corsHeaders);
      const anthropicData = await anthropicRes.json();
      const rawText = anthropicData.content?.[0]?.text ?? "{}";

      let tip;
      try {
        tip = JSON.parse(rawText);
      } catch {
        const match = rawText.match(/\{[\s\S]*\}/);
        tip = match ? JSON.parse(match[0]) : { emoji: "💡", message: "Mantén la constancia, es la clave del progreso.", category: "general" };
      }

      return new Response(JSON.stringify({ tip, generated_at: new Date().toISOString() }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ── FULL ANALYSIS MODE ─────────────────────────────────────────────────
    // Cooldown check
    const { data: lastInsight } = await supabase.from("ai_insights")
      .select("generated_at").eq("user_id", userId)
      .order("generated_at", { ascending: false }).limit(1).single();

    if (lastInsight) {
      const age = Date.now() - new Date(lastInsight.generated_at).getTime();
      if (age < COOLDOWN_MS) {
        const hoursLeft = Math.ceil((COOLDOWN_MS - age) / 3600000);
        return jsonErr(`Análisis disponible en ${hoursLeft}h. Máximo 1 por semana.`, 429, corsHeaders);
      }
    }

    // Load last 30 days workouts
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: workouts } = await supabase.from("workouts")
      .select("id, started_at, duration_ms, mode, exercise_count, rest_count, avg_rest_ms, rest_adherence, total_rests_tracked")
      .eq("user_id", userId).gte("started_at", since).order("started_at", { ascending: false });

    if (!workouts || workouts.length === 0) return jsonErr("Sin suficientes datos. Completa al menos un entrenamiento.", 422, corsHeaders);

    const workoutIds = workouts.map((w: { id: string }) => w.id);
    const { data: exercises } = await supabase.from("workout_exercises")
      .select("id, workout_id, exercise_name, equipment").in("workout_id", workoutIds);

    const exIds = (exercises || []).map((e: { id: string }) => e.id);
    const { data: sets } = exIds.length > 0
      ? await supabase.from("exercise_sets")
          .select("workout_exercise_id, set_number, weight, reps, unit, rest_after_ms, rest_configured_ms, rest_status")
          .in("workout_exercise_id", exIds)
      : { data: [] };

    // Exercise frequency + progression
    const now2 = Date.now();
    const week1Start = now2 - 14 * 86400000; const week1End = now2 - 7 * 86400000;
    const week2Start = now2 - 7 * 86400000;
    const exFrequency: Record<string, { count: number; totalSets: number; w1Weights: number[]; w2Weights: number[] }> = {};
    const workoutDateMap: Record<string, number> = {};
    workouts.forEach((w: { id: string; started_at: string }) => { workoutDateMap[w.id] = new Date(w.started_at).getTime(); });
    (exercises || []).forEach((ex: { id: string; workout_id: string; exercise_name: string; equipment: string }) => {
      const key = ex.exercise_name + (ex.equipment ? ` (${ex.equipment})` : "");
      if (!exFrequency[key]) exFrequency[key] = { count: 0, totalSets: 0, w1Weights: [], w2Weights: [] };
      exFrequency[key].count++;
      const exSets = (sets || []).filter((s: { workout_exercise_id: string }) => s.workout_exercise_id === ex.id);
      exFrequency[key].totalSets += exSets.length;
      const wDate = workoutDateMap[ex.workout_id] || 0;
      exSets.forEach((s: { weight: number }) => {
        if (s.weight > 0) {
          if (wDate >= week1Start && wDate < week1End) exFrequency[key].w1Weights.push(s.weight);
          else if (wDate >= week2Start) exFrequency[key].w2Weights.push(s.weight);
        }
      });
    });
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null;
    const topExercises = Object.entries(exFrequency).sort((a, b) => b[1].count - a[1].count).slice(0, 8)
      .map(([name, stats]) => {
        const w1 = avg(stats.w1Weights); const w2 = avg(stats.w2Weights);
        const progression = w1 != null && w2 != null ? (w2 - w1) : null;
        return { name, sessions: stats.count, totalSets: stats.totalSets, w1AvgWeight: w1, w2AvgWeight: w2, progression };
      });

    // Rest aggregates
    const restWorkouts = workouts.filter((w: { avg_rest_ms: number | null; rest_adherence: number | null }) => w.avg_rest_ms != null && w.rest_adherence != null);
    const avgRestMs = restWorkouts.length ? Math.round(restWorkouts.reduce((s: number, w: { avg_rest_ms: number }) => s + w.avg_rest_ms, 0) / restWorkouts.length) : null;
    const avgAdherence = restWorkouts.length ? restWorkouts.reduce((s: number, w: { rest_adherence: number }) => s + w.rest_adherence, 0) / restWorkouts.length : null;
    const totalRestsTracked = workouts.reduce((s: number, w: { total_rests_tracked: number }) => s + (w.total_rests_tracked || 0), 0);

    const restStr = avgRestMs != null
      ? `Descanso promedio real: ${Math.round(avgRestMs / 1000)}s, Adherencia promedio: ${Math.round((avgAdherence || 0) * 100)}%, Descansos analizados: ${totalRestsTracked}`
      : "Sin datos de descanso aún";
    const exercisesStr = topExercises.map(ex => {
      let s = `${ex.name}: ${ex.sessions} sesiones, ${ex.totalSets} series`;
      if (ex.w2AvgWeight != null) s += `, peso esta semana: ${ex.w2AvgWeight}kg`;
      if (ex.progression != null) s += ` (${ex.progression > 0 ? '+' : ''}${ex.progression}kg vs sem. anterior)`;
      return s;
    }).join("; ");

    // Workout frequency per weekday
    const dayCount = new Array(7).fill(0);
    workouts.forEach((w: { started_at: string }) => { dayCount[new Date(w.started_at).getDay()]++; });
    const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const freqStr = dayCount.map((c, d) => c > 0 ? `${dayNames[d]}(${c})` : '').filter(Boolean).join(', ');
    const consecutiveDays = Math.max(...dayCount);

    const prompt = `Eres un entrenador personal experto con 15+ años de experiencia. Analiza los datos REALES de entrenamiento y genera recomendaciones específicas, numéricas y accionables.

PERFIL: ${profileStr}

DATOS ÚLTIMOS 30 DÍAS:
- Entrenamientos: ${workouts.length} (días activos: ${freqStr})
- ${restStr}
- Progresión semanal por ejercicio: ${exercisesStr || "Sin datos suficientes"}
- Racha máxima de días por semana: ${consecutiveDays}

INSTRUCCIONES CRÍTICAS:
1. Analiza la PROGRESIÓN DE CARGA: ejercicios que mejoraron peso, estancados o que bajaron. Sé específico (ej: "Press banca subió +5kg").
2. Analiza el DESCANSO como factor de rendimiento: si adherencia < 70%, explica que no descansar bien limita la carga en siguientes series.
3. Si el usuario entrena muchos días seguidos, recomienda un día de descanso.
4. Incluye 1 tip de bienestar (sueño 8h, hidratación, o suplemento relevante para su objetivo).
5. Máximo 3 recomendaciones. NO repitas lo que ya hace bien.

Responde ÚNICAMENTE con JSON válido:
{
  "summary": "2 oraciones máximo, menciona datos reales (número de kg, porcentaje, etc.)",
  "rest_analysis": { "status": "good|needs_work|critical|no_data", "message": "análisis específico con números" },
  "recommendations": [
    { "type": "rest|volume|frequency|progression|recovery|sleep|hydration|supplement", "title": "título (máx 40 chars)", "body": "acción concreta con números (máx 120 chars)", "priority": "high|medium|low" }
  ],
  "rest_suggestion_seconds": null
}

Si adherencia < 70%, calcula rest_suggestion_seconds = Math.round(descanso_promedio_real_ms / 1000 * 1.3) como sugerencia.`;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 700, messages: [{ role: "user", content: prompt }] }),
    });

    if (!anthropicRes.ok) return jsonErr("Error al contactar IA. Intenta más tarde.", 502, corsHeaders);
    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData.content?.[0]?.text ?? "";

    let insights;
    try { insights = JSON.parse(rawText); }
    catch { const match = rawText.match(/\{[\s\S]*\}/); if (match) insights = JSON.parse(match[0]); else return jsonErr("Respuesta IA inválida.", 502, corsHeaders); }

    await supabase.from("ai_insights").insert({ user_id: userId, insights });

    return new Response(JSON.stringify({ insights, generated_at: new Date().toISOString() }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (err) {
    console.error("Unexpected error:", err);
    return jsonErr("Error interno del servidor.", 500, corsHeaders);
  }
});
