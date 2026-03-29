-- Allow publishers to create/update their own invoice and payout rows and upload PDFs (self-serve generation).

CREATE POLICY "Publishers insert own invoices" ON public.invoices
  FOR INSERT
  WITH CHECK (publisher_id = public.current_publisher_id());

CREATE POLICY "Publishers update own invoices" ON public.invoices
  FOR UPDATE
  USING (publisher_id = public.current_publisher_id())
  WITH CHECK (publisher_id = public.current_publisher_id());

CREATE POLICY "Publishers insert own payouts" ON public.payouts
  FOR INSERT
  WITH CHECK (publisher_id = public.current_publisher_id());

CREATE POLICY "Publishers update own payouts" ON public.payouts
  FOR UPDATE
  USING (publisher_id = public.current_publisher_id())
  WITH CHECK (publisher_id = public.current_publisher_id());

CREATE POLICY "Publishers insert own invoice pdf" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'invoices'
    AND (storage.foldername(name))[1] = public.current_publisher_id()::text
  );

CREATE POLICY "Publishers update own invoice pdf" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'invoices'
    AND (storage.foldername(name))[1] = public.current_publisher_id()::text
  );
