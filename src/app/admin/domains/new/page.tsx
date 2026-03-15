import { DomainForm } from "../domain-form";
import { createClient } from "@/lib/supabase/server";

export default async function NewDomainPage() {
  const supabase = await createClient();
  const { data: publishers } = await supabase
    .from("publishers")
    .select("id, name")
    .order("name");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        Add domain
      </h1>
      <DomainForm publishers={publishers ?? []} />
    </div>
  );
}
