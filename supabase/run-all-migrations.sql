-- Run this entire file once in Supabase Dashboard: SQL Editor -> New query -> Paste -> Run
-- Project: wszemcsubafjfuzcyuoa

-- ========== 1. Schema ==========
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE public.publishers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  revenue_share_pct DECIMAL(5,2) NOT NULL DEFAULT 70 CHECK (revenue_share_pct >= 0 AND revenue_share_pct <= 100),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  phone TEXT,
  allow_adult BOOLEAN NOT NULL DEFAULT false,
  allow_gambling BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'publisher' CHECK (role IN ('super_admin', 'publisher')),
  publisher_id UUID REFERENCES public.publishers(id) ON DELETE SET NULL,
  full_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.monthly_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  year INT NOT NULL,
  expected_revenue DECIMAL(12,2) DEFAULT 0,
  real_data_imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(month, year)
);

CREATE TABLE public.daily_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stat_date DATE NOT NULL,
  publisher_id UUID NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  revenue DECIMAL(12,2) DEFAULT 0,
  ecpm DECIMAL(10,4) GENERATED ALWAYS AS (CASE WHEN impressions > 0 THEN (revenue / impressions * 1000) ELSE 0 END) STORED,
  is_estimated BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stat_date, publisher_id)
);

CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  publisher_id UUID NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  year INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(publisher_id, month, year)
);

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  publisher_id UUID NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  year INT NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  file_path TEXT,
  total_impressions BIGINT DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  revenue_share_pct DECIMAL(5,2) DEFAULT 0,
  publisher_earnings DECIMAL(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(publisher_id, month, year)
);

CREATE TABLE public.import_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  total_rows INT DEFAULT 0,
  imported_rows INT DEFAULT 0,
  unmatched_data JSONB DEFAULT '[]',
  errors JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.publisher_monthly_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  publisher_id UUID NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  year INT NOT NULL,
  target_revenue DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(publisher_id, month, year)
);

CREATE INDEX idx_daily_stats_publisher_date ON public.daily_stats(publisher_id, stat_date);
CREATE INDEX idx_daily_stats_date ON public.daily_stats(stat_date);
CREATE INDEX idx_payouts_publisher ON public.payouts(publisher_id);
CREATE INDEX idx_publisher_monthly_targets_lookup ON public.publisher_monthly_targets(publisher_id, month, year);
CREATE INDEX idx_invoices_publisher ON public.invoices(publisher_id);
CREATE INDEX IF NOT EXISTS idx_publishers_name_trgm
  ON public.publishers
  USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_publishers_email_trgm
  ON public.publishers
  USING gin (email gin_trgm_ops);

-- ========== 2. RLS ==========
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publisher_monthly_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.current_publisher_id()
RETURNS UUID AS $$
  SELECT publisher_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Super admin can all profiles" ON public.profiles FOR ALL USING (public.is_super_admin());

CREATE POLICY "Super admin full publishers" ON public.publishers FOR ALL USING (public.is_super_admin());
CREATE POLICY "Publishers read own" ON public.publishers FOR SELECT USING (id = public.current_publisher_id());


CREATE POLICY "Super admin full monthly_config" ON public.monthly_config FOR ALL USING (public.is_super_admin());
CREATE POLICY "Publishers read monthly_config" ON public.monthly_config FOR SELECT USING (true);

CREATE POLICY "Super admin full daily_stats" ON public.daily_stats FOR ALL USING (public.is_super_admin());
CREATE POLICY "Publishers read own daily_stats" ON public.daily_stats FOR SELECT USING (publisher_id = public.current_publisher_id());

CREATE POLICY "Super admin full payouts" ON public.payouts FOR ALL USING (public.is_super_admin());
CREATE POLICY "Publishers read own payouts" ON public.payouts FOR SELECT USING (publisher_id = public.current_publisher_id());

CREATE POLICY "Super admin full publisher_monthly_targets" ON public.publisher_monthly_targets FOR ALL USING (public.is_super_admin());
CREATE POLICY "Publishers read own publisher_monthly_targets" ON public.publisher_monthly_targets FOR SELECT USING (publisher_id = public.current_publisher_id());

CREATE POLICY "Super admin full invoices" ON public.invoices FOR ALL USING (public.is_super_admin());
CREATE POLICY "Publishers read own invoices" ON public.invoices FOR SELECT USING (publisher_id = public.current_publisher_id());

CREATE POLICY "Super admin only import_logs" ON public.import_logs FOR ALL USING (public.is_super_admin());

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  publisher_id UUID NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  admin_reply TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  publisher_last_seen_at TIMESTAMPTZ,
  admin_last_seen_at TIMESTAMPTZ
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Publishers own tickets select" ON public.support_tickets
  FOR SELECT USING (publisher_id = public.current_publisher_id());

CREATE POLICY "Publishers own tickets insert" ON public.support_tickets
  FOR INSERT WITH CHECK (publisher_id = public.current_publisher_id());

CREATE POLICY "Super admin full support_tickets" ON public.support_tickets
  FOR ALL USING (public.is_super_admin());

-- Support ticket threaded messages
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('publisher', 'admin')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Publishers own support_messages"
  ON public.support_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.publisher_id = public.current_publisher_id()
    )
  );

CREATE POLICY "Publishers insert support_messages"
  ON public.support_messages
  FOR INSERT WITH CHECK (
    sender_type = 'publisher'
    AND EXISTS (
      SELECT 1
      FROM public.support_tickets t
      WHERE t.id = ticket_id
        AND t.publisher_id = public.current_publisher_id()
    )
  );

CREATE POLICY "Super admin full support_messages"
  ON public.support_messages
  FOR ALL USING (public.is_super_admin());

-- ========== 3. Profile trigger ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (NEW.id, 'publisher', COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== 4. Publishers additional columns ==========
-- Phone (already added if you ran 00005)
ALTER TABLE public.publishers ADD COLUMN IF NOT EXISTS phone TEXT;
-- Website URL assigned by admin when creating publisher
ALTER TABLE public.publishers ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Policy flags
ALTER TABLE public.publishers ADD COLUMN IF NOT EXISTS allow_adult BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.publishers ADD COLUMN IF NOT EXISTS allow_gambling BOOLEAN NOT NULL DEFAULT false;

-- ========== 5. Storage buckets and policies ==========
-- If INSERT fails, create buckets in Dashboard: Storage -> New bucket -> excel-imports (private), invoices (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('excel-imports', 'excel-imports', false), ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Super admin upload excel" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'excel-imports' AND public.is_super_admin());
CREATE POLICY "Super admin read excel" ON storage.objects FOR SELECT
USING (bucket_id = 'excel-imports' AND public.is_super_admin());

CREATE POLICY "Super admin all invoices storage" ON storage.objects FOR ALL
USING (bucket_id = 'invoices' AND public.is_super_admin());
CREATE POLICY "Publishers read own invoice" ON storage.objects FOR SELECT
USING (bucket_id = 'invoices' AND (storage.foldername(name))[1] = public.current_publisher_id()::text);
