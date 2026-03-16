-- Support tickets table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  publisher_id UUID NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  admin_reply TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Publishers own tickets select" ON public.support_tickets
  FOR SELECT USING (publisher_id = public.current_publisher_id());

CREATE POLICY "Publishers own tickets insert" ON public.support_tickets
  FOR INSERT WITH CHECK (publisher_id = public.current_publisher_id());

CREATE POLICY "Super admin full support_tickets" ON public.support_tickets
  FOR ALL USING (public.is_super_admin());

