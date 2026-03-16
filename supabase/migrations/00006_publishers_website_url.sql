-- Add optional website URL to publishers
ALTER TABLE public.publishers ADD COLUMN IF NOT EXISTS website_url TEXT;

