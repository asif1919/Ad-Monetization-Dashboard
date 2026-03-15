import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PublisherForm } from "../publisher-form";

export default async function NewPublisherPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        Add publisher
      </h1>
      <PublisherForm />
    </div>
  );
}
