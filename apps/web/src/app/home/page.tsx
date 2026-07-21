import { redirect } from "next/navigation";
import { HomeDashboardClient } from "@/components/dashboard/HomeDashboardClient";
import { defaultOrgNameFromEmail } from "@/lib/auth/org-name";
import { bootstrapOrganizationServer } from "@/lib/api/server";
import { createClient } from "@/lib/supabase/server";

function displayName(input: { email?: string; user_metadata?: unknown }): string {
  if (
    input.user_metadata &&
    typeof input.user_metadata === "object" &&
    "full_name" in input.user_metadata &&
    typeof input.user_metadata.full_name === "string" &&
    input.user_metadata.full_name.trim()
  ) {
    return input.user_metadata.full_name.trim();
  }

  return input.email?.split("@")[0] || "Workspace member";
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!user || !session?.access_token || !user.email) {
    redirect("/login");
  }

  try {
    const bootstrap = await bootstrapOrganizationServer(
      session.access_token,
      defaultOrgNameFromEmail(user.email),
    );

    if (!bootstrap.onboardedAt) {
      redirect("/onboarding");
    }
  } catch {
    redirect("/login");
  }

  return <HomeDashboardClient memberName={displayName(user)} />;
}
