-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Publishers (before profiles since profiles references publishers)
CREATE TABLE public.publishers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  revenue_share_pct DECIMAL(5,2) NOT NULL DEFAULT 70 CHECK (revenue_share_pct >= 0 AND revenue_share_pct <= 100),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'publisher' CHECK (role IN ('super_admin', 'publisher')),
  publisher_id UUID REFERENCES public.publishers(id) ON DELETE SET NULL,
  full_name TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Domains (for Excel row matching)
CREATE TABLE public.domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  publisher_id UUID NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
  domain_site_id TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(publisher_id, domain_site_id)
);

-- Monthly config (estimated revenue + real data flag)
CREATE TABLE public.monthly_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  year INT NOT NULL,
  expected_revenue DECIMAL(12,2) DEFAULT 0,
  real_data_imported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(month, year)
);

-- Daily stats (per domain or publisher)
CREATE TABLE public.daily_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stat_date DATE NOT NULL,
  publisher_id UUID NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
  domain_id UUID REFERENCES public.domains(id) ON DELETE SET NULL,
  impressions BIGINT DEFAULT 0,
  clicks BIGINT DEFAULT 0,
  revenue DECIMAL(12,2) DEFAULT 0,
  ecpm DECIMAL(10,4) GENERATED ALWAYS AS (CASE WHEN impressions > 0 THEN (revenue / impressions * 1000) ELSE 0 END) STORED,
  is_estimated BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stat_date, publisher_id, domain_id)
);

-- Payouts
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  publisher_id UUID NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  year INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(publisher_id, month, year)
);

-- Invoices
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  publisher_id UUID NOT NULL REFERENCES public.publishers(id) ON DELETE CASCADE,
  month INT NOT NULL CHECK (month >= 1 AND month <= 12),
  year INT NOT NULL,
  invoice_number TEXT NOT NULL UNIQUE,
  file_path TEXT,
  total_impressions BIGINT DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  revenue_share_pct DECIMAL(5,2) DEFAULT 0,
  publisher_earnings DECIMAL(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(publisher_id, month, year)
);

-- Import logs
CREATE TABLE public.import_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  total_rows INT DEFAULT 0,
  imported_rows INT DEFAULT 0,
  unmatched_data JSONB DEFAULT '[]',
  errors JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_daily_stats_publisher_date ON public.daily_stats(publisher_id, stat_date);
CREATE INDEX idx_daily_stats_date ON public.daily_stats(stat_date);
CREATE INDEX idx_domains_publisher ON public.domains(publisher_id);
CREATE INDEX idx_domains_site_id ON public.domains(domain_site_id);
CREATE INDEX idx_payouts_publisher ON public.payouts(publisher_id);
CREATE INDEX idx_invoices_publisher ON public.invoices(publisher_id);
