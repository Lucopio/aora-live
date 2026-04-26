-- ═══════════════════════════════════════════════════════════
-- GymTracker - Supabase Schema
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- ═══════════════════════════════════════════════════════════

-- ─── Perfiles (preferencias por usuario) ────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name  TEXT,
  rest_seconds  INT  DEFAULT 60,
  sound_enabled BOOL DEFAULT TRUE,
  vibration_enabled BOOL DEFAULT TRUE,
  weight_unit   TEXT DEFAULT 'kg' CHECK (weight_unit IN ('kg','lb')),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── Entrenamientos ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workouts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at          TIMESTAMPTZ NOT NULL,
  duration_ms         INT  NOT NULL,
  warmup_duration_ms  INT  DEFAULT 0,
  mode                TEXT NOT NULL CHECK (mode IN ('full','rest-only')),
  rest_count          INT  DEFAULT 0,
  exercise_count      INT  NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ─── Ejercicios dentro de un entrenamiento ──────────────────
CREATE TABLE IF NOT EXISTS workout_exercises (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id    UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  equipment     TEXT DEFAULT '',
  sort_order    INT  NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── Series de cada ejercicio ───────────────────────────────
CREATE TABLE IF NOT EXISTS exercise_sets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_exercise_id UUID NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_number          INT  NOT NULL,
  weight              NUMERIC(6,1) NOT NULL DEFAULT 0,
  reps                INT  NOT NULL,
  unit                TEXT DEFAULT 'kg' CHECK (unit IN ('kg','lb')),
  side                TEXT CHECK (side IN (NULL,'left','right')),
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ─── Ejercicios personalizados por usuario ──────────────────
CREATE TABLE IF NOT EXISTS custom_exercises (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

-- ─── Ultimo peso por ejercicio (cache) ──────────────────────
CREATE TABLE IF NOT EXISTS last_weights (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_key TEXT NOT NULL,
  weight       NUMERIC(6,1) NOT NULL,
  unit         TEXT DEFAULT 'kg',
  updated_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, exercise_key)
);

-- ─── Indices ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_workouts_user_date    ON workouts(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_wid ON workout_exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_exercise_sets_weid    ON exercise_sets(workout_exercise_id);
CREATE INDEX IF NOT EXISTS idx_last_weights_user     ON last_weights(user_id);

-- ─── Row Level Security ─────────────────────────────────────
ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_sets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_exercises  ENABLE ROW LEVEL SECURITY;
ALTER TABLE last_weights      ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo ve sus propios datos
CREATE POLICY "own_profile"   ON profiles
  FOR ALL USING (id = auth.uid());

CREATE POLICY "own_workouts"  ON workouts
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "own_workout_exercises" ON workout_exercises
  FOR ALL USING (workout_id IN (
    SELECT id FROM workouts WHERE user_id = auth.uid()
  ));

CREATE POLICY "own_exercise_sets" ON exercise_sets
  FOR ALL USING (workout_exercise_id IN (
    SELECT we.id FROM workout_exercises we
    JOIN workouts w ON w.id = we.workout_id
    WHERE w.user_id = auth.uid()
  ));

CREATE POLICY "own_custom_exercises" ON custom_exercises
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "own_last_weights" ON last_weights
  FOR ALL USING (user_id = auth.uid());

-- ─── Trigger: auto-actualizar updated_at en profiles ────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
