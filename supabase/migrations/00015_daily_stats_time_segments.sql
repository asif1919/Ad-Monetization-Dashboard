-- Time-based segments for progressive display of estimated daily stats.
-- Only estimated rows use this; real data leaves it null.
ALTER TABLE public.daily_stats
  ADD COLUMN IF NOT EXISTS time_segments JSONB DEFAULT NULL;
