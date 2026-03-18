export type Role = "super_admin" | "publisher";

export type PreferredCurrency = "USD" | "BDT";

export interface Profile {
  id: string;
  role: Role;
  publisher_id: string | null;
  full_name: string | null;
  avatar_url: string | null;
  preferred_currency: PreferredCurrency | null;
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
  allow_adult: boolean;
  allow_gambling: boolean;
  created_at: string;
  updated_at: string;
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

export interface TimeSegment {
  start: string;
  end: string;
  revenue: number;
  impressions: number;
  clicks: number;
}

export interface DailyStat {
  id: string;
  stat_date: string;
  publisher_id: string;
  impressions: number;
  clicks: number;
  revenue: number;
  ecpm: number;
  is_estimated: boolean;
  time_segments?: TimeSegment[] | null;
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

export interface SupportTicket {
  id: string;
  publisher_id: string;
  subject: string;
  message: string;
  status: "open" | "closed";
  created_at: string;
  updated_at: string;
  publisher_last_seen_at?: string | null;
  admin_last_seen_at?: string | null;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_type: "publisher" | "admin";
  body: string;
  created_at: string;
}
