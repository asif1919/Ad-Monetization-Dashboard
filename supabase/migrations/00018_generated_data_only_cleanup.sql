-- Generated-data-only: remove upload-era table and real-vs-estimate columns.

DROP TABLE IF EXISTS public.import_logs;

ALTER TABLE public.monthly_config
  DROP COLUMN IF EXISTS real_data_imported_at;

ALTER TABLE public.daily_stats
  DROP COLUMN IF EXISTS is_estimated;
