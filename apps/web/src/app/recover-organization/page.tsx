import { OrganizationRecoveryForm } from "@/components/auth/WorkspaceAccess";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { bootstrapOrganizationServer } from "@/lib/api/server";

export default async function RecoverOrganizationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: { session } } = await supabase.auth.getSession();
  if (!user?.email || !session?.access_token) redirect("/login");
  const workspace = await bootstrapOrganizationServer(session.access_token, user.email.split("@")[0] || "LeadReacher");
  if (!workspace.disabledAt) redirect("/dashboard");
  return <OrganizationRecoveryForm canRecover={workspace.role === "owner"} purgeAt={workspace.purgeAt} />;
}
