-- Add eco-friendly public_id for publishers, e.g. "Pub_0000123"
ALTER TABLE public.publishers
  ADD COLUMN IF NOT EXISTS public_id TEXT;

-- Backfill existing rows with deterministic unique IDs
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM public.publishers
)
UPDATE public.publishers p
SET public_id = 'Pub_' || LPAD(numbered.rn::TEXT, 7, '0')
FROM numbered
WHERE p.id = numbered.id
  AND p.public_id IS NULL;

-- Ensure uniqueness and fast lookup
ALTER TABLE public.publishers
  ADD CONSTRAINT publishers_public_id_unique UNIQUE (public_id);

CREATE INDEX IF NOT EXISTS idx_publishers_public_id
  ON public.publishers(public_id);

