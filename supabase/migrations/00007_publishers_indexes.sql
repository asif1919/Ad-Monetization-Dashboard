-- Enable trigram indexes and fast text search on publishers
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_publishers_name_trgm
  ON public.publishers
  USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_publishers_email_trgm
  ON public.publishers
  USING gin (email gin_trgm_ops);

