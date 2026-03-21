import { createClient } from "jsr:@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL      = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Cooldown: 7 days between analyses per user
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    // ── Auth: extract user from JWT ────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonErr("Unauthorized", 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) return jsonErr("Unauthorized", 401);

    const userId = user.id;

    // ── Cooldown check ────────────────────────────────────────
    const { data: lastInsight } = await supabase
      .from("ai_insights")
      .select("generated_at")
      .eq("user_id", userId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .single();

    if (lastInsight) {
      const age = Date.now() - new Date(lastInsight.generated_at).getTime();
      if (age < COOLDOWN_MS) {
        const hoursLeft = Math.ceil((COOLDOWN_MS - age) / 3600000);
        return jsonErr(`Análisis disponible en ${hoursLeft}h. Máximo 1 por semana.`, 429);
      }
    }

    // ── Load user profile ─────────────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, age, sex, body_weight, body_weight_unit, training_days, experience, training_goal, activity_level")
      .eq("id", userId)
      .single();

    // ── Load last 30 days workouts with exercises + sets ──────
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: workouts } = await supabase
      .from("workouts")
      .select("id, started_at, duration_ms, mode, exercise_count, rest_count, avg_rest_ms, rest_adherence, total_rests_tracked")
      .eq("user_id", userId)
      .gte("started_at", since)
      .order("started_at", { ascending: false });

    if (!workouts || workouts.length === 0) {
      return jsonErr("Sin suficientes datos. Completa al menos un entrenamiento.", 422);
    }

    // Load exercises + sets for each workout
    const workoutIds = workouts.map((w: { id: string }) => w.id);
    const { data: exercises } = await supabase
      .from("workout_exercises")
      .select("id, workout_id, exercise_name, equipment")
      .in("workout_id", workoutIds);

    const exIds = (exercises || []).map((e: { id: string }) => e.id);
    const { data: sets } = exIds.length > 0
      ? await supabase
          .from("exercise_sets")
          .select("workout_exercise_id, set_number, weight, reps, unit, rest_after_ms, rest_configured_ms, rest_status")
          .in("workout_exercise_id", exIds)
      : { data: [] };

    // ── Build exercise frequency map ──────────────────────────
    const exFrequency: Record<string, { count: number; totalSets: number; weights: number[] }> = {};
    (exercises || []).forEach((ex: { id: string; exercise_name: string; equipment: string }) => {
      const key = ex.exercise_name + (ex.equipment ? ` (${ex.equipment})` : "");
      if (!exFrequency[key]) exFrequency[key] = { count: 0, totalSets: 0, weights: [] };
      exFrequency[key].count++;
      const exSets = (sets || []).filter((s: { workout_exercise_id: string }) => s.workout_exercise_id === ex.id);
      exFrequency[key].totalSets += exSets.length;
      exSets.forEach((s: { weight: number }) => { if (s.weight > 0) exFrequency[key].weights.push(s.weight); });
    });
    const topExercises = Object.entries(exFrequency)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([name, stats]) => ({
        name,
        sessions: stats.count,
        totalSets: stats.totalSets,
        avgWeight: stats.weights.length ? Math.round(stats.weights.reduce((a, b) => a + b, 0) / stats.weights.length * 10) / 10 : null,
      }));

    // ── Compute rest stats ────────────────────────────────────
    const restWorkouts = workouts.filter((w: { avg_rest_ms: number | null; rest_adherence: number | null }) => w.avg_rest_ms != null && w.rest_adherence != null);
    const avgRestMs = restWorkouts.length
      ? Math.round(restWorkouts.reduce((s: number, w: { avg_rest_ms: number }) => s + w.avg_rest_ms, 0) / restWorkouts.length)
      : null;
    const avgAdherence = restWorkouts.length
      ? restWorkouts.reduce((s: number, w: { rest_adherence: number }) => s + w.rest_adherence, 0) / restWorkouts.length
      : null;
    const totalRestsTracked = workouts.reduce((s: number, w: { total_rests_tracked: number }) => s + (w.total_rests_tracked || 0), 0);

    // ── Build prompt ──────────────────────────────────────────
    const profileStr = profile
      ? `Nombre: ${profile.full_name || "No especificado"}, Edad: ${profile.age || "?"}, Sexo: ${profile.sex || "?"}, Peso: ${profile.body_weight || "?"}${profile.body_weight_unit || "kg"}, Objetivo: ${profile.training_goal || "?"}, Experiencia: ${profile.experience || "?"}, Días/semana: ${profile.training_days || "?"}, Nivel actividad: ${profile.activity_level || "?"}`
      : "Perfil no disponible";

    const restStr = avgRestMs != null
      ? `Descanso promedio real: ${Math.round(avgRestMs / 1000)}s, Adherencia promedio: ${Math.round((avgAdherence || 0) * 100)}%, Descansos analizados: ${totalRestsTracked}`
      : "Sin datos de descanso aún (entrena más sesiones para obtener análisis de descanso)";

    const exercisesStr = topExercises.map(ex =>
      `${ex.name}: ${ex.sessions} sesiones, ${ex.totalSets} series${ex.avgWeight ? `, peso promedio ${ex.avgWeight}` : ""}`
    ).join("; ");

    const prompt = `Eres un entrenador personal experto con 15+ años de experiencia. Analiza los datos de entrenamiento del usuario y genera recomendaciones personalizadas, específicas y accionables.

PERFIL DEL USUARIO:
${profileStr}

DATOS ÚLTIMOS 30 DÍAS:
- Entrenamientos completados: ${workouts.length} (objetivo: ${profile?.training_days ? `${profile.training_days}/semana ≈ ${Math.round(profile.training_days * 4.3)} en 30 días` : "no especificado"})
- ${restStr}
- Ejercicios frecuentes: ${exercisesStr || "Sin datos"}

INSTRUCCIONES:
- Sé específico y directo, no genérico
- Menciona números concretos cuando sea relevante
- Si los datos de descanso están disponibles, úsalos como eje central del análisis
- El análisis de descanso es la fortaleza de esta app, priorízalo
- Máximo 3 recomendaciones, cada una concisa y accionable

Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{
  "summary": "1-2 oraciones resumiendo el estado general del entrenamiento",
  "rest_analysis": {
    "status": "good | needs_work | critical | no_data",
    "message": "análisis específico del patrón de descanso"
  },
  "recommendations": [
    {
      "type": "rest | volume | frequency | progression | recovery",
      "title": "título corto (máx 40 chars)",
      "body": "descripción concisa y accionable (máx 120 chars)",
      "priority": "high | medium | low"
    }
  ],
  "rest_suggestion_seconds": null
}

Si la adherencia es < 70%, sugiere un ajuste en rest_suggestion_seconds (número entero).`;

    // ── Call Claude Haiku ─────────────────────────────────────
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      console.error("Anthropic error:", err);
      return jsonErr("Error al contactar IA. Intenta más tarde.", 502);
    }

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData.content?.[0]?.text ?? "";

    let insights;
    try {
      insights = JSON.parse(rawText);
    } catch {
      // Try extracting JSON from text if Claude added extra content
      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) insights = JSON.parse(match[0]);
      else return jsonErr("Respuesta IA inválida. Intenta de nuevo.", 502);
    }

    // ── Save to ai_insights table ─────────────────────────────
    const { error: insertErr } = await supabase
      .from("ai_insights")
      .insert({ user_id: userId, insights });

    if (insertErr) console.error("Insert insights error:", insertErr);

    return new Response(JSON.stringify({ insights, generated_at: new Date().toISOString() }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (err) {
    console.error("Unexpected error:", err);
    return jsonErr("Error interno del servidor.", 500);
  }
});

function jsonErr(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
