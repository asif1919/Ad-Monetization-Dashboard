import { redirect } from "next/navigation";

/** Old bookmark URL — uploads are no longer supported. */
export default function RevenueUploadLegacyPage() {
  redirect("/admin/revenue");
}
