"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import AuthLayout from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { createClient, getBrowserSession } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error: resetError } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (resetError) setError(resetError.message);
    else setSent(true);
  }

  return (
    <AuthLayout>
      <Card className="mx-4 w-full max-w-md sm:mx-auto">
        <CardContent className="p-7 sm:p-9">
          <h1 className="text-2xl font-semibold">Reset your password</h1>
          <p className="mt-2 text-sm text-muted-foreground">We’ll send a secure recovery link to your account email.</p>
          {sent ? (
            <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
              <CheckCircle2 className="mb-2 size-5" /> Check your inbox. The recovery link may take a minute to arrive.
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recovery-email">Work email</Label>
                <div className="relative">
                  <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="pl-9" />
                </div>
              </div>
              {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}
              <Button className="w-full" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : null} Send recovery link
              </Button>
            </form>
          )}
          <Link href="/login" className="mt-6 inline-block text-sm font-medium text-brand-purple">Return to login</Link>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void getBrowserSession().then((session) => setReady(Boolean(session)));
    const { data } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setLoading(false);
    if (updateError) setError(updateError.message);
    else setComplete(true);
  }

  return (
    <AuthLayout>
      <Card className="mx-4 w-full max-w-md sm:mx-auto">
        <CardContent className="p-7 sm:p-9">
          <h1 className="text-2xl font-semibold">Choose a new password</h1>
          {complete ? (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-muted-foreground">Your password has been updated.</p>
              <Button asChild className="w-full"><Link href="/login">Continue to login</Link></Button>
            </div>
          ) : ready ? (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="confirm-password">Confirm password</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div>
              {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-300">{error}</p> : null}
              <Button className="w-full" disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : null} Update password</Button>
            </form>
          ) : (
            <div className="mt-6 rounded-lg border p-4 text-sm text-muted-foreground">Open this page from the recovery link in your email. If the link expired, request a new one.</div>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
