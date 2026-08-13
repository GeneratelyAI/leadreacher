"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Copy, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { clearAccessTokenCache } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

type Enrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

type AuthFactor = { id: string; status: string };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Could not update multi-factor authentication.";
}

export function MfaSecurityPanel() {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadFactors = useCallback(async () => {
    setLoading(true);
    const { data, error: factorsError } = await createClient().auth.mfa.listFactors();
    setLoading(false);
    if (factorsError || !data) {
      setError(errorMessage(factorsError));
      return;
    }
    setFactorId((data.all as AuthFactor[]).find((factor: AuthFactor) => factor.status === "verified")?.id ?? null);
  }, []);

  useEffect(() => {
    void loadFactors();
  }, [loadFactors]);

  async function beginEnrollment() {
    setWorking(true);
    setError(null);
    setMessage(null);
    const { data, error: enrollError } = await createClient().auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "LeadReacher authenticator",
    });
    setWorking(false);
    if (enrollError || !data) {
      setError(errorMessage(enrollError));
      return;
    }
    setEnrollment({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    });
  }

  async function verifyEnrollment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment) return;

    setWorking(true);
    setError(null);
    const supabase = createClient();
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: enrollment.factorId,
    });
    if (challengeError || !challenge) {
      setWorking(false);
      setError(errorMessage(challengeError));
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: enrollment.factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setWorking(false);
    if (verifyError) {
      setError("That code did not work. Check your authenticator app and try again.");
      return;
    }

    clearAccessTokenCache();
    setEnrollment(null);
    setCode("");
    setMessage("Authenticator app enabled. Sensitive workspace actions now require a current code.");
    await loadFactors();
  }

  async function disableMfa() {
    if (!factorId || !window.confirm("Disable your authenticator app? Sensitive actions will no longer require a second factor.")) {
      return;
    }
    setWorking(true);
    setError(null);
    const { error: unenrollError } = await createClient().auth.mfa.unenroll({ factorId });
    setWorking(false);
    if (unenrollError) {
      setError(errorMessage(unenrollError));
      return;
    }
    clearAccessTokenCache();
    setFactorId(null);
    setMessage("Authenticator app disabled.");
  }

  async function copySecret() {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setMessage("Setup key copied.");
    } catch {
      setError("Could not copy the setup key. Select and copy it manually.");
    }
  }

  if (loading) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading security settings</p>;
  }

  if (factorId) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-400/25 dark:bg-emerald-400/10">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="size-5 text-emerald-700 dark:text-emerald-300" aria-hidden />
            <div>
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Authenticator app enabled</p>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-200/75">Billing, data exports, and organization recovery require a second factor.</p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void disableMfa()} disabled={working}>
            {working ? <Loader2 className="animate-spin" /> : <Trash2 />}
            Disable
          </Button>
        </div>
        {message ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}
        {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}
      </div>
    );
  }

  if (enrollment) {
    return (
      <form onSubmit={verifyEnrollment} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <Image className="size-40 rounded-lg border border-border bg-white p-2" src={enrollment.qrCode} alt="QR code for your authenticator app" width={160} height={160} unoptimized />
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium">Scan this code in your authenticator app</p>
              <p className="mt-1 text-xs text-muted-foreground">Then enter the six-digit code to activate multi-factor authentication.</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-2 text-xs">{enrollment.secret}</code>
              <Button type="button" variant="outline" size="icon" onClick={() => void copySecret()} aria-label="Copy setup key"><Copy /></Button>
            </div>
          </div>
        </div>
        <div className="grid gap-2 sm:max-w-xs">
          <Label htmlFor="mfa-enrollment-code">Authenticator code</Label>
          <Input id="mfa-enrollment-code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} pattern="[0-9]*" required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
        </div>
        {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" disabled={working || code.length < 6}>{working ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Verify and enable</Button>
          <Button type="button" variant="ghost" onClick={() => { setEnrollment(null); setCode(""); setError(null); }}>Cancel</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">Use an authenticator app to add a second verification step before sensitive workspace actions.</p>
        <p className="mt-1 text-xs text-muted-foreground">Keep access to your authenticator app. Recovery requires support verification until recovery codes are available.</p>
      </div>
      {message ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p> : null}
      {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}
      <Button type="button" variant="primary" onClick={() => void beginEnrollment()} disabled={working}>{working ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Set up authenticator app</Button>
    </div>
  );
}
