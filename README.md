# Ad Monetization Dashboard (Publisher Ad Revenue Platform)

Two-layer ad monetization platform: **Super Admin** manages publishers, monthly targets, and estimated daily stats; **Publishers** view performance, earnings, and download monthly reports and PDF invoices.

## Stack

- **Frontend:** Next.js 15 (App Router), React, Tailwind CSS, Recharts
- **Backend:** Supabase (PostgreSQL, Auth, Storage, RLS)

## Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com).

2. **Environment variables**  
   Copy `.env.local.example` to `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL` – project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` – anon key

3. **Database**  
   Run the SQL migrations in `supabase/migrations/` in order (Supabase SQL Editor or CLI):
   - `00001_initial_schema.sql`
   - `00002_rls.sql`
   - `00003_profile_trigger.sql`
   - `00004_storage.sql`  
   Ensure the `invoices` storage bucket exists (for PDF invoices; the migration may create it). An `excel-imports` bucket may exist from older migrations but is unused if you are not using legacy import tooling.

4. **First Super Admin**  
   After signing up a user, set them as super admin and (optionally) link publishers:
   - In Supabase: `profiles` table, set `role = 'super_admin'` for that user’s row.

5. **Publishers**  
   - In Admin: create publishers (name, email, revenue share %).  
   - When a user signs up with the same email, they are linked to that publisher and can use the Publisher Dashboard.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in and you’ll be redirected to Admin (super admin) or Dashboard (publisher).

## Features

- **Admin:** Publishers CRUD, Domains, Revenue config (expected monthly revenue → estimated daily stats), Import Excel (month-end report with column mapping), Payouts (mark paid), Invoices (generate PDFs, list).
- **Publisher:** Overview (today/monthly revenue, impressions, clicks, eCPM, payment due), Revenue chart (last 30 days), Reports (date range, table, monthly summary), Download monthly CSV (only when real data imported for that month), Payments (history, next payout, download invoice PDF).

## Excel import

Upload an Excel file with columns for publisher (email or ID), date, domain/site ID (optional), impressions, clicks, revenue. Map columns in the UI, preview, then import. Real data replaces estimated data for the selected month and is shown to publishers.
