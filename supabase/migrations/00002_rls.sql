-- RLS: enable on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_logs ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: get current user's publisher_id
CREATE OR REPLACE FUNCTION public.current_publisher_id()
RETURNS UUID AS $$
  SELECT publisher_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles: users can read/update own; super_admin can all
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Super admin can all profiles" ON public.profiles
  FOR ALL USING (public.is_super_admin());

-- Publishers: super_admin full access; publishers can read own
CREATE POLICY "Super admin full publishers" ON public.publishers
  FOR ALL USING (public.is_super_admin());
CREATE POLICY "Publishers read own" ON public.publishers
  FOR SELECT USING (id = public.current_publisher_id());

-- Domains: super_admin full; publishers read own
CREATE POLICY "Super admin full domains" ON public.domains
  FOR ALL USING (public.is_super_admin());
CREATE POLICY "Publishers read own domains" ON public.domains
  FOR SELECT USING (publisher_id = public.current_publisher_id());

-- Monthly config: super_admin full; publishers read only
CREATE POLICY "Super admin full monthly_config" ON public.monthly_config
  FOR ALL USING (public.is_super_admin());
CREATE POLICY "Publishers read monthly_config" ON public.monthly_config
  FOR SELECT USING (true);

-- Daily stats: super_admin full; publishers read own
CREATE POLICY "Super admin full daily_stats" ON public.daily_stats
  FOR ALL USING (public.is_super_admin());
CREATE POLICY "Publishers read own daily_stats" ON public.daily_stats
  FOR SELECT USING (publisher_id = public.current_publisher_id());

-- Payouts: super_admin full; publishers read own
CREATE POLICY "Super admin full payouts" ON public.payouts
  FOR ALL USING (public.is_super_admin());
CREATE POLICY "Publishers read own payouts" ON public.payouts
  FOR SELECT USING (publisher_id = public.current_publisher_id());

-- Invoices: super_admin full; publishers read own
CREATE POLICY "Super admin full invoices" ON public.invoices
  FOR ALL USING (public.is_super_admin());
CREATE POLICY "Publishers read own invoices" ON public.invoices
  FOR SELECT USING (publisher_id = public.current_publisher_id());

-- Import logs: super_admin only
CREATE POLICY "Super admin only import_logs" ON public.import_logs
  FOR ALL USING (public.is_super_admin());
