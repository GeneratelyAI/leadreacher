"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "@/components/ui/icons";
import AuthLayout from "@/components/auth/AuthLayout";
import { MfaSecurityPanel } from "@/components/auth/MfaSecurityPanel";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { apiFetch } from "@/lib/api";

function AccessCard({ children }: { children: React.ReactNode }) {
  return (
    <AuthLayout>
      <Card className="mx-auto w-full max-w-md">
        <CardContent className="p-7 sm:p-9">{children}</CardContent>
      </Card>
    </AuthLayout>
  );
}

export function LegalConsentForm() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/dashboard/legal/accept", { method: "POST" });
      router.replace("/onboarding");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Acceptance could not be saved");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AccessCard>
      <CheckCircle2 className="size-6 text-brand-purple" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold">Review the current terms</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        LeadReacher records the policy versions accepted by your organization. Review both documents before continuing.
      </p>
      <label className="mt-6 flex items-start gap-3 rounded-lg border p-4 text-sm">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-0.5 size-4 accent-brand-purple"
        />
        <span>
          I agree to the <Link href="/terms" target="_blank" className="font-medium text-brand-purple">Terms</Link> and acknowledge the <Link href="/privacy" target="_blank" className="font-medium text-brand-purple">Privacy Policy</Link>.
        </span>
      </label>
      {error ? <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-300">{error}</p> : null}
      <Button className="mt-6 w-full" disabled={!accepted || loading} onClick={submit}>
        {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Accept and continue
      </Button>
    </AccessCard>
  );
}

export function OrganizationRecoveryForm({
  canRecover,
  purgeAt,
  needsMfaEnrollment,
}: {
  canRecover: boolean;
  purgeAt: string | null;
  needsMfaEnrollment: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function recover() {
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/auth/organization/recover", { method: "POST" });
      router.replace("/dashboard");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Workspace recovery failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AccessCard>
      <AlertTriangle className="size-6 text-amber-500" aria-hidden />
      <h1 className="mt-4 text-2xl font-semibold">Workspace pending deletion</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Outreach and access are disabled. {canRecover ? "You can restore this workspace" : "Only an organization owner can restore this workspace"}{purgeAt ? ` before ${new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(purgeAt))}` : " during its recovery period"}.
      </p>
      {needsMfaEnrollment ? (
        <div className="mt-6 border-t pt-6">
          <h2 className="text-sm font-semibold">Verify your identity</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Set up an authenticator app before recovering this workspace.
          </p>
          <div className="mt-4">
            <MfaSecurityPanel />
          </div>
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-300">{error}</p> : null}
      <Button className="mt-6 w-full" disabled={loading || !canRecover} onClick={recover}>
        {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {canRecover ? "Recover workspace" : "Owner access required"}
      </Button>
      <Link href="/login" className="mt-5 block text-center text-sm font-medium text-muted-foreground">Use another account</Link>
    </AccessCard>
  );
}
