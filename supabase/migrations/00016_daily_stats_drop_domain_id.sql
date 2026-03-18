-- Drop domain_id from daily_stats and adjust constraints to be publisher-only.

-- Drop foreign key that references domains(id), if it exists.
ALTER TABLE public.daily_stats
  DROP CONSTRAINT IF EXISTS daily_stats_domain_id_fkey;

-- Drop old unique constraint that included domain_id, if it exists.
ALTER TABLE public.daily_stats
  DROP CONSTRAINT IF EXISTS daily_stats_stat_date_publisher_id_domain_id_key;

-- Drop the domain_id column itself, if it exists.
ALTER TABLE public.daily_stats
  DROP COLUMN IF EXISTS domain_id;

-- Ensure we still enforce uniqueness per publisher per day.
ALTER TABLE public.daily_stats
  ADD CONSTRAINT IF NOT EXISTS daily_stats_stat_date_publisher_id_key
  UNIQUE (stat_date, publisher_id);

