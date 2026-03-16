-- Support ticket threaded messages
CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('publisher', 'admin')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Publishers can see and add messages on their own tickets
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

-- Super admin full access
CREATE POLICY "Super admin full support_messages"
  ON public.support_messages
  FOR ALL USING (public.is_super_admin());

