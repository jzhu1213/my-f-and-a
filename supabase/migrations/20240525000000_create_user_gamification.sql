-- Migration: Create user_gamification table
-- Purpose: Sync gamification state (streaks, challenges, zero-spend days) to server
-- for cross-device access.
-- Requirements: 32.4

-- ============================================================================
-- Table: user_gamification
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_gamification (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  streak_data   JSONB NOT NULL DEFAULT '{}'::jsonb,
  challenge_progress JSONB NOT NULL DEFAULT '{}'::jsonb,
  zero_spend_days TEXT[] NOT NULL DEFAULT '{}',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_gamification ENABLE ROW LEVEL SECURITY;

-- RLS Policies: user can only access their own row
CREATE POLICY "Users can read own gamification data"
  ON user_gamification
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gamification data"
  ON user_gamification
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gamification data"
  ON user_gamification
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own gamification data"
  ON user_gamification
  FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at on any change
CREATE OR REPLACE FUNCTION update_user_gamification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_user_gamification_updated_at
  BEFORE UPDATE ON user_gamification
  FOR EACH ROW
  EXECUTE FUNCTION update_user_gamification_updated_at();
