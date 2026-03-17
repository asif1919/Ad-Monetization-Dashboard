import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { UploadPageClient } from "./upload-page-client";

export default async function RevenueUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ publisher_id?: string; month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const publisherId = params.publisher_id;
  const month = params.month ? Number(params.month) : NaN;
  const year = params.year ? Number(params.year) : NaN;

  if (!publisherId || Number.isNaN(month) || Number.isNaN(year)) {
    redirect("/admin/revenue");
  }

  const supabase = await createClient();
  const { data: publisher } = await supabase
    .from("publishers")
    .select("id, name, public_id")
    .eq("id", publisherId)
    .maybeSingle();

  if (!publisher) notFound();

  return (
    <UploadPageClient
      publisherId={publisher.id}
      publisherName={publisher.name}
      publicId={publisher.public_id ?? null}
      month={month}
      year={year}
    />
  );
}

