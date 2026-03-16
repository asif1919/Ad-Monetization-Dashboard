import { createClient } from "@/lib/supabase/server";
import { SupportStatusTabs } from "./support-tabs";

export default async function AdminSupportPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("support_tickets")
    .select("id, publisher_id, subject, status, created_at, publishers(name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  const tickets = (data ?? []).map((t: any) => ({
    id: t.id,
    subject: t.subject,
    status: t.status as "open" | "closed",
    created_at: t.created_at as string | null,
    publisher_name: t.publishers?.name ?? "",
    publisher_email: t.publishers?.email ?? "",
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">Support tickets</h1>
      <SupportStatusTabs tickets={tickets} />
    </div>
  );
}

