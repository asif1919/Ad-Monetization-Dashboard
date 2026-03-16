-- Per-publisher monthly revenue targets (for estimated daily stats until real data is imported)
CREATE TABLE IF NOT EXISTS public.publisher_monthly_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  publisher_id UUID NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  year INT NOT NULL,
  target_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(publisher_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_publisher_monthly_targets_lookup
  ON public.publisher_monthly_targets(publisher_id, month, year);

ALTER TABLE public.publisher_monthly_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin full publisher_monthly_targets" ON public.publisher_monthly_targets;
DROP POLICY IF EXISTS "Publishers read own publisher_monthly_targets" ON public.publisher_monthly_targets;

CREATE POLICY "Super admin full publisher_monthly_targets"
  ON public.publisher_monthly_targets FOR ALL
  USING (public.is_super_admin());

CREATE POLICY "Publishers read own publisher_monthly_targets"
  ON public.publisher_monthly_targets FOR SELECT
  USING (publisher_id = public.current_publisher_id());
