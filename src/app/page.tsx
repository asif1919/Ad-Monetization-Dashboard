import { authDebug } from "@/lib/auth-debug";
import {
  DASHBOARD_VIEW_AS_COOKIE,
  verifyViewAsCookieValue,
} from "@/lib/dashboard-effective-publisher";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    authDebug("home", { step: "redirectLoginNoUser" });
    redirect("/login");
  }

  const store = await cookies();
  const viewAsRaw = store.get(DASHBOARD_VIEW_AS_COOKIE)?.value;
  const viewAsOk = verifyViewAsCookieValue(viewAsRaw, user.id);
  authDebug("home", {
    step: "viewAsCheck",
    viewAsCookiePresent: !!viewAsRaw,
    viewAsValid: !!viewAsOk,
  });
  if (viewAsOk) {
    authDebug("home", { step: "redirectDashboardViewAs" });
    redirect("/dashboard");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  authDebug("home", {
    step: "profileLoaded",
    userId: user.id,
    profileRole: profile?.role ?? null,
  });

  if (profile?.role === "super_admin") {
    redirect("/admin");
  }
  authDebug("home", { step: "redirectDashboardPublisher" });
  redirect("/dashboard");
}
