import { OrganizationRecoveryForm } from "@/components/auth/WorkspaceAccess";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type AuthFactor = { status: string };
import { bootstrapOrganizationServer } from "@/lib/api/server";

export default async function RecoverOrganizationPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: { session } } = await supabase.auth.getSession();
  if (!user?.email || !session?.access_token) redirect("/login");
  const workspace = await bootstrapOrganizationServer(session.access_token, user.email.split("@")[0] || "LeadReacher");
  if (!workspace.disabledAt) redirect("/dashboard");

  const [{ data: assurance }, { data: factors }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  const hasVerifiedFactor = (factors?.all as AuthFactor[] | undefined)?.some(
    (factor: AuthFactor) => factor.status === "verified",
  );
  if (hasVerifiedFactor && assurance?.currentLevel !== "aal2") {
    redirect("/verify-mfa?next=/recover-organization");
  }

  return (
    <OrganizationRecoveryForm
      canRecover={workspace.role === "owner"}
      purgeAt={workspace.purgeAt}
      needsMfaEnrollment={workspace.role === "owner" && !hasVerifiedFactor}
    />
  );
}
