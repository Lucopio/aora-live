-- ═══════════════════════════════════════════════════════════
-- GymTracker - Update Schema: Perfil de usuario
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query
-- ═══════════════════════════════════════════════════════════

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name         TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age               INT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sex               TEXT;          -- 'male' | 'female' | 'other'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS body_weight       NUMERIC(5,1); -- peso corporal de la persona
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS body_weight_unit  TEXT DEFAULT 'kg';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS height_cm         INT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS training_days     INT;          -- dias/semana
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS experience        TEXT;         -- 'beginner' | 'intermediate' | 'advanced'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS training_goal     TEXT;         -- 'muscle' | 'fat_loss' | 'strength' | 'maintenance'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS activity_level    TEXT;         -- 'sedentary' | 'light' | 'moderate' | 'active'
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_done   BOOLEAN DEFAULT FALSE;
