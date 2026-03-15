import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { DomainForm } from "../../domain-form";

export default async function EditDomainPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: domain } = await supabase
    .from("domains")
    .select("id, publisher_id, domain_site_id, display_name")
    .eq("id", id)
    .single();
  if (!domain) notFound();

  const { data: publishers } = await supabase
    .from("publishers")
    .select("id, name")
    .order("name");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        Edit domain
      </h1>
      <DomainForm
        publishers={publishers ?? []}
        domain={{
          id: domain.id,
          publisher_id: domain.publisher_id,
          domain_site_id: domain.domain_site_id,
          display_name: domain.display_name,
        }}
      />
    </div>
  );
}
