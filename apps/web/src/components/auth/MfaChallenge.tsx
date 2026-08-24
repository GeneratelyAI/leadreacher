"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, ShieldCheck } from "@/components/ui/icons";
import AuthLayout from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { clearAccessTokenCache } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

type AuthFactor = { id: string; status: string };

function safeNextPath(value: string | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export function MfaChallenge({ nextPath }: { nextPath?: string }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    const factor = (factors?.all as AuthFactor[] | undefined)?.find(
      (item: AuthFactor) => item.status === "verified",
    );
    if (factorsError || !factor) {
      setLoading(false);
      setError("No verified authenticator app is available for this account.");
      return;
    }
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challengeError || !challenge) {
      setLoading(false);
      setError("Could not start verification. Try again.");
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code: code.trim(),
    });
    setLoading(false);
    if (verifyError) {
      setError("That code did not work. Check your authenticator app and try again.");
      return;
    }
    clearAccessTokenCache();
    window.location.assign(safeNextPath(nextPath));
  }

  return (
    <AuthLayout>
      <Card className="mx-4 w-full max-w-md sm:mx-auto">
        <CardContent className="p-7 sm:p-9">
          <ShieldCheck className="size-7 text-brand-purple" aria-hidden />
          <h1 className="mt-4 text-2xl font-semibold">Verify your identity</h1>
          <p className="mt-2 text-sm text-muted-foreground">Enter the current code from your authenticator app to continue.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2"><Label htmlFor="mfa-code">Authenticator code</Label><Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={8} required autoFocus value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></div>
            {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}
            <Button className="w-full" disabled={loading || code.length < 6}>{loading ? <Loader2 className="animate-spin" /> : null} Verify</Button>
          </form>
          <Link href="/login" className="mt-6 inline-block text-sm font-medium text-brand-purple">Use a different account</Link>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
