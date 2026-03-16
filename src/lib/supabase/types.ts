export type Role = "super_admin" | "publisher";

export interface Profile {
  id: string;
  role: Role;
  publisher_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  updated_at: string;
}

export interface Publisher {
  id: string;
  name: string;
  email: string;
  revenue_share_pct: number;
  status: "active" | "suspended";
  phone: string | null;
  website_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Domain {
  id: string;
  publisher_id: string;
  domain_site_id: string;
  display_name: string | null;
  created_at: string;
}

export interface MonthlyConfig {
  id: string;
  month: number;
  year: number;
  expected_revenue: number;
  real_data_imported_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyStat {
  id: string;
  stat_date: string;
  publisher_id: string;
  domain_id: string | null;
  impressions: number;
  clicks: number;
  revenue: number;
  ecpm: number;
  is_estimated: boolean;
  created_at: string;
  updated_at: string;
}

export interface Payout {
  id: string;
  publisher_id: string;
  month: number;
  year: number;
  amount: number;
  status: "pending" | "paid";
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: string;
  publisher_id: string;
  month: number;
  year: number;
  invoice_number: string;
  file_path: string | null;
  total_impressions: number;
  total_revenue: number;
  revenue_share_pct: number;
  publisher_earnings: number;
  status: "pending" | "paid";
  created_at: string;
}

export interface ImportLog {
  id: string;
  uploaded_by: string | null;
  file_name: string;
  total_rows: number;
  imported_rows: number;
  unmatched_data: unknown[];
  errors: unknown[];
  created_at: string;
}
