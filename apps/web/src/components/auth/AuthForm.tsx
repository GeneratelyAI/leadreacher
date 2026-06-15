"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { GoogleIcon, MicrosoftIcon } from "@/components/auth/OAuthIcons";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { bootstrapOrganization } from "@/lib/api";
import { defaultOrgNameFromEmail } from "@/lib/auth/org-name";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "signup";

type AuthFormProps = {
  mode: AuthMode;
};

const inputClassName =
  "h-auto min-h-11 rounded-xl border-neutral-200 bg-white py-3 text-sm text-neutral-900 shadow-none placeholder:text-neutral-400 focus-visible:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-500/20";

const oauthButtonClassName =
  "relative h-auto min-h-11 w-full rounded-xl border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50";

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";
  const title = isSignup ? "Create your account" : "Welcome back";
  const subtitle = isSignup
    ? "Sign up for your Leadreacher account"
    : "Log in to your Leadreacher account";
  const alternateHref = isSignup ? "/login" : "/signup";
  const alternatePrompt = isSignup
    ? "Already have an account?"
    : "Don't have an account?";
  const alternateLinkLabel = isSignup ? "Log in" : "Sign up";

  async function ensureOrganizationBootstrapped(userEmail: string) {
    await bootstrapOrganization(defaultOrgNameFromEmail(userEmail));
  }

  async function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    try {
      if (isSignup) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) {
          throw signUpError;
        }
        if (!data.session) {
          setError(
            "Check your email to confirm your account, then sign in to continue.",
          );
          return;
        }
        await ensureOrganizationBootstrapped(email);
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) {
          throw signInError;
        }
        await ensureOrganizationBootstrapped(email);
      }

      router.push("/");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Authentication failed",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "azure") {
    setError(null);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });

    if (oauthError) {
      setError(oauthError.message);
    }
  }

  return (
    <Card
      className={cn(
        "mx-auto w-full max-w-[500px] gap-0 rounded-2xl border-0 bg-white py-0",
        "shadow-[0_4px_24px_rgba(15,23,42,0.08)] ring-0 [--card-spacing:0]",
      )}
    >
      <CardContent className="p-8 sm:p-10">
        <div className="mb-8 space-y-2 text-center">
          <CardTitle className="text-[1.75rem] font-bold tracking-tight text-[#0f172a]">
            {title}
          </CardTitle>
          <CardDescription className="text-sm text-neutral-500">
            {subtitle}
          </CardDescription>
        </div>

        <div className="space-y-3">
          <Button
            type="button"
            variant="outline"
            className={oauthButtonClassName}
            onClick={() => handleOAuth("google")}
          >
            <GoogleIcon className="absolute left-4 size-5" />
            Continue with Google
          </Button>
          <Button
            type="button"
            variant="outline"
            className={oauthButtonClassName}
            onClick={() => handleOAuth("azure")}
          >
            <MicrosoftIcon className="absolute left-4 size-5" />
            Continue with Microsoft
          </Button>
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-neutral-200" />
          <span className="text-xs text-neutral-400">or</span>
          <div className="h-px flex-1 bg-neutral-200" />
        </div>

        <form className="space-y-5" onSubmit={handleEmailSubmit}>
          <div className="space-y-2">
            <Label
              htmlFor="auth-email"
              className="block text-sm font-semibold text-[#0f172a]"
            >
              Work email
            </Label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-neutral-400"
                aria-hidden
              />
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={cn(inputClassName, "pl-11 pr-4")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label
                htmlFor="auth-password"
                className="text-sm font-semibold text-[#0f172a]"
              >
                Password
              </Label>
              {!isSignup ? (
                <Link
                  href="#"
                  className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700"
                >
                  Forgot password?
                </Link>
              ) : null}
            </div>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-neutral-400"
                aria-hidden
              />
              <Input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                minLength={6}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={cn(inputClassName, "pl-11 pr-11")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute top-1/2 right-3.5 -translate-y-1/2 rounded-md p-0.5 text-neutral-400 transition-colors hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-[18px]" aria-hidden />
                ) : (
                  <Eye className="size-[18px]" aria-hidden />
                )}
              </button>
            </div>
          </div>

          {error ? (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={loading}
            aria-busy={loading || undefined}
            className="flex h-auto min-h-11 w-full items-center justify-center gap-2 rounded-xl border-0 bg-linear-to-r from-indigo-500 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:from-indigo-600 hover:to-violet-700 focus-visible:ring-indigo-500/40 disabled:opacity-70"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            <span>{isSignup ? "Sign up" : "Log in"}</span>
            {!loading ? (
              <ArrowRight className="size-4 shrink-0" aria-hidden />
            ) : null}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-neutral-500">
          {alternatePrompt}{" "}
          <Link
            href={alternateHref}
            className="font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
          >
            {alternateLinkLabel}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
