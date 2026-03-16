ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS publisher_last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_last_seen_at TIMESTAMPTZ;

