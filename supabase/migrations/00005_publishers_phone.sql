-- Add optional phone number to publishers
ALTER TABLE public.publishers ADD COLUMN IF NOT EXISTS phone TEXT;
