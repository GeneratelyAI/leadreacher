import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardQueryProvider } from "@/components/providers/DashboardQueryProvider";
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

export default async function DashboardLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal?: React.ReactNode;
}) {
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

  let bootstrap;
  try {
    bootstrap = await bootstrapOrganizationServer(
      session.access_token,
      defaultOrgNameFromEmail(user.email),
    );
  } catch {
    redirect("/login");
  }

  if (bootstrap.disabledAt) {
    redirect("/recover-organization");
  }
  if (!bootstrap.legalAccepted) {
    redirect("/legal-consent");
  }
  if (!bootstrap.onboardedAt) {
    redirect("/onboarding");
  }

  return (
    <DashboardQueryProvider>
      <DashboardShell memberName={displayName(user)} modal={modal ?? null}>{children}</DashboardShell>
    </DashboardQueryProvider>
  );
}
