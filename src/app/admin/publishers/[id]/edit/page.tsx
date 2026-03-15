import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PublisherForm } from "../../publisher-form";

export default async function EditPublisherPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: publisher } = await supabase
    .from("publishers")
    .select("id, name, email, revenue_share_pct, status")
    .eq("id", id)
    .single();

  if (!publisher) notFound();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        Edit publisher
      </h1>
      <PublisherForm
        publisher={{
          id: publisher.id,
          name: publisher.name,
          email: publisher.email,
          revenue_share_pct: Number(publisher.revenue_share_pct),
          status: publisher.status as "active" | "suspended",
        }}
      />
    </div>
  );
}
