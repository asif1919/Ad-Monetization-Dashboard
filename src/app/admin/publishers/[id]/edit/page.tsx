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
    .select("id, name, email, phone, website_url, revenue_share_pct, status, allow_adult, allow_gambling, public_id")
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
          phone: publisher.phone ?? undefined,
          website_url: publisher.website_url ?? undefined,
          revenue_share_pct: Number(publisher.revenue_share_pct),
          status: publisher.status as "active" | "suspended",
          allow_adult: !!publisher.allow_adult,
          allow_gambling: !!publisher.allow_gambling,
          public_id: publisher.public_id ?? undefined,
        }}
      />
    </div>
  );
}
