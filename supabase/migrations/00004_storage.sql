-- Storage buckets are created via Supabase Dashboard or API.
-- Policies for excel-imports (admin only) and invoices (publishers read own).
-- Run after creating buckets named: excel-imports, invoices

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('excel-imports', 'excel-imports', false),
  ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- excel-imports: super_admin only (via RLS on storage.objects)
CREATE POLICY "Super admin upload excel"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'excel-imports' AND public.is_super_admin()
);
CREATE POLICY "Super admin read excel"
ON storage.objects FOR SELECT
USING (bucket_id = 'excel-imports' AND public.is_super_admin());

-- invoices: super_admin full; publishers can read own (path prefix by publisher_id)
CREATE POLICY "Super admin all invoices storage"
ON storage.objects FOR ALL
USING (bucket_id = 'invoices' AND public.is_super_admin());
CREATE POLICY "Publishers read own invoice"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invoices' AND
  (storage.foldername(name))[1] = public.current_publisher_id()::text
);
