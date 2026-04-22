-- GymTracker: Tabla de análisis IA generados por Supabase Edge Function
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS ai_insights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insights      JSONB NOT NULL,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para consultas por usuario
CREATE INDEX IF NOT EXISTS ai_insights_user_idx ON ai_insights (user_id, generated_at DESC);

-- RLS
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own insights"   ON ai_insights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Edge function inserts"    ON ai_insights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own"         ON ai_insights FOR DELETE USING (auth.uid() = user_id);
