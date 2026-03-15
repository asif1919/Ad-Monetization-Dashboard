/**
 * Creates storage buckets excel-imports and invoices in Supabase.
 * Run once: node scripts/create-buckets.mjs
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");
if (!existsSync(envPath)) {
  console.error(".env.local not found. Create it with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);
const buckets = [
  { id: "excel-imports", name: "excel-imports", public: false },
  { id: "invoices", name: "invoices", public: false },
];
for (const b of buckets) {
  const { data, error } = await supabase.storage.createBucket(b.id, { public: b.public });
  if (error) {
    if (error.message?.includes("already exists")) console.log(`Bucket ${b.id} already exists.`);
    else console.error(`Bucket ${b.id}:`, error.message);
  } else console.log(`Created bucket: ${b.id}`);
}
console.log("Done.");
