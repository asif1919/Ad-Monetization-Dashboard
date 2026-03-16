-- Add policy flags to publishers
ALTER TABLE public.publishers
  ADD COLUMN IF NOT EXISTS allow_adult BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_gambling BOOLEAN NOT NULL DEFAULT false;

