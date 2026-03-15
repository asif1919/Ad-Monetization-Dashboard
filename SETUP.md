# Setup – Ad Monetization Dashboard

Your Supabase project is configured and storage buckets are created. Complete these steps once:

---

## Step 1: Run database migrations

1. Open **Supabase Dashboard**: https://supabase.com/dashboard/project/wszemcsubafjfuzcyuoa  
2. Go to **SQL Editor** → **New query**.  
3. Open the file **`supabase/run-all-migrations.sql`** in this project and copy its **entire** contents.  
4. Paste into the SQL Editor and click **Run**.  
5. You should see “Success. No rows returned.”

---

## Step 2: Create your first admin user

1. In Supabase, go to **Authentication** → **Users** → **Add user** → **Create new user**.  
2. Enter an **email** and **password** (e.g. your own). Click **Create user**.  
3. Go to **Table Editor** → **`profiles`**.  
4. Find the row whose **id** matches the user you just created (same as in Authentication → Users).  
5. Set **role** to `super_admin`. Save.

---

## Step 3: Run the app

```bash
npm install
npm run dev
```

Open http://localhost:3000 → **Login** with the email and password from Step 2. You should be redirected to the **Admin** dashboard.

---

## Optional: Add a publisher and test the publisher dashboard

1. In **Admin** → **Publishers**, click **Add publisher**.  
2. Enter name, email, **password** (min 8 characters), and optionally phone and revenue share %. Save.  
3. The publisher can log in immediately with that email and password. Sign out, then sign in as the publisher to see the **Publisher Dashboard** (overview, reports, payments).

---

## Optional: Add phone column (existing databases)

If you ran the migrations before the phone field was added, run this in SQL Editor once:

```sql
ALTER TABLE public.publishers ADD COLUMN IF NOT EXISTS phone TEXT;
```

---

**Credentials (already set in `.env.local`):**

- URL: `https://wszemcsubafjfuzcyuoa.supabase.co`  
- Anon key and **SUPABASE_SERVICE_ROLE_KEY** (required for creating publishers with login and for delete publisher). Do not commit `.env.local`.
