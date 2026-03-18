-- Preferred display currency for the user (USD or BDT). All stored amounts remain in USD.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'USD' CHECK (preferred_currency IN ('USD', 'BDT'));
