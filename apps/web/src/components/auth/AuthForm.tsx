"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Fragment, useState } from "react";
import { GoogleIcon, MicrosoftIcon } from "@/components/auth/OAuthIcons";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { bootstrapOrganization } from "@/lib/api";
import { defaultOrgNameFromEmail } from "@/lib/auth/org-name";
import { BRAND_COLORS } from "@/lib/constants/brand";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "signup";

type AuthFormProps = {
  mode: AuthMode;
};

const inputClassName = cn(
  "rounded-lg border-neutral-200 bg-white text-neutral-900 shadow-none placeholder:text-neutral-400",
  "h-9 text-xs h-compact:h-8",
  "lg:h-10 lg:text-sm xl:h-11 xl:text-base",
  "focus-visible:border-[#5842e3]/45 focus-visible:ring-2 focus-visible:ring-[#5842e3]/12",
);

const oauthButtonClassName = cn(
  "relative w-full rounded-lg border border-neutral-200 bg-white font-medium text-neutral-800",
  "h-9 px-3 text-xs h-compact:h-8",
  "lg:h-10 lg:px-4 lg:text-sm xl:h-11 xl:text-base",
  "shadow-[0_2px_10px_rgba(15,23,42,0.05)] hover:bg-neutral-50",
);

const processSteps = [
  { icon: Sparkles, label: "Generate" },
  { icon: CheckCircle2, label: "Approve" },
  { icon: Send, label: "Launch" },
] as const;

export default function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";
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
        "mx-auto w-full gap-0 rounded-3xl border border-neutral-200/70 bg-white py-0 antialiased",
        "shadow-[0_10px_48px_rgba(15,23,42,0.07)] ring-0 [--card-spacing:0]",
      )}
    >
      <CardContent
        className={cn(
          "px-6 py-6 h-compact:px-5 h-compact:py-4",
          "lg:px-10 lg:py-9",
          "h-comfortable:px-11 h-comfortable:py-10",
          "h-spacious:px-12 h-spacious:py-12",
        )}
      >
        <header
          className={cn(
            "mb-5 text-center h-compact:mb-4",
            "lg:mb-7 xl:mb-8 h-spacious:mb-10",
          )}
        >
          <h1
            className={cn(
              "text-xl leading-tight font-bold tracking-tight text-[#111827]",
              "h-compact:text-lg",
              "lg:text-2xl xl:text-3xl h-spacious:text-4xl",
            )}
          >
            {isSignup ? (
              <>
                <span className="block">Let&apos;s get your first</span>
                <span className="block" style={{ color: BRAND_COLORS.purple }}>
                  qualified conversation.
                </span>
              </>
            ) : (
              <>
                <span className="block">Welcome back to your</span>
                <span className="block" style={{ color: BRAND_COLORS.purple }}>
                  qualified conversations.
                </span>
              </>
            )}
          </h1>
          <p
            className={cn(
              "mx-auto mt-2 max-w-xs text-xs leading-snug text-neutral-500",
              "h-compact:mt-1.5",
              "lg:mt-3 lg:max-w-sm lg:text-sm lg:leading-relaxed",
              "xl:mt-4 xl:text-base",
            )}
          >
            {isSignup
              ? "Create your account and we'll guide you through the setup in just a few minutes."
              : "Sign in and we'll pick up right where you left off in just a few minutes."}
          </p>
        </header>

        <div
          className={cn(
            "mb-5 space-y-5 h-compact:mb-4 h-compact:space-y-4",
            "lg:mb-7 lg:space-y-7 xl:mb-8",
          )}
        >
          <div className="flex items-center gap-3 h-compact:gap-2 lg:gap-4">
            <div className="h-px flex-1 bg-neutral-200" />
            <div
              className={cn(
                "flex shrink-0 items-center gap-2 text-xs leading-none font-normal text-[#5e5870]",
                "lg:gap-2.5 lg:text-sm xl:text-base",
              )}
            >
              <ShieldCheck
                className={cn(
                  "size-4 shrink-0 h-compact:size-3.5 lg:size-5 xl:size-6",
                )}
                style={{ color: BRAND_COLORS.purple }}
                strokeWidth={2}
                aria-hidden
              />
              <span className="whitespace-nowrap">
                You stay in control. We handle the rest.
              </span>
            </div>
            <div className="h-px flex-1 bg-neutral-200" />
          </div>

          <div
            className={cn(
              "flex items-center justify-center gap-4 text-xs leading-none font-normal text-[#8f84a8]",
              "h-compact:gap-3 lg:gap-6 lg:text-sm xl:gap-8 xl:text-base",
            )}
          >
            {processSteps.map((step, index) => (
              <Fragment key={step.label}>
                {index > 0 ? (
                  <ArrowRight
                    className={cn(
                      "size-3.5 shrink-0 text-[#d8d2e3] lg:size-4 xl:size-5",
                    )}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                ) : null}
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap lg:gap-2">
                  <step.icon
                    className={cn("size-4 lg:size-5 xl:size-6")}
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  {step.label}
                </span>
              </Fragment>
            ))}
          </div>
        </div>

        <div
          className={cn(
            "space-y-2.5 h-compact:space-y-2 lg:space-y-3",
          )}
        >
          <Button
            type="button"
            variant="outline"
            className={oauthButtonClassName}
            onClick={() => handleOAuth("google")}
          >
            <GoogleIcon
              className={cn(
                "absolute left-3 size-4 lg:left-4 lg:size-5",
              )}
            />
            <span className="flex-1 text-center">Continue with Google</span>
            <ChevronRight
              className="absolute right-3 size-3.5 text-neutral-400 lg:right-4 lg:size-4"
              aria-hidden
            />
          </Button>
          <Button
            type="button"
            variant="outline"
            className={oauthButtonClassName}
            onClick={() => handleOAuth("azure")}
          >
            <MicrosoftIcon
              className={cn(
                "absolute left-3 size-4 lg:left-4 lg:size-5",
              )}
            />
            <span className="flex-1 text-center">Continue with Microsoft</span>
            <ChevronRight
              className="absolute right-3 size-3.5 text-neutral-400 lg:right-4 lg:size-4"
              aria-hidden
            />
          </Button>
        </div>

        <div
          className={cn(
            "my-4 flex items-center gap-3 h-compact:my-3 lg:my-6 xl:my-7",
          )}
        >
          <div className="h-px flex-1 bg-neutral-200" />
          <span className="text-xs text-neutral-400">or</span>
          <div className="h-px flex-1 bg-neutral-200" />
        </div>

        <form
          className={cn(
            "space-y-3 h-compact:space-y-2.5 lg:space-y-4",
          )}
          onSubmit={handleEmailSubmit}
        >
          <div>
            <Label htmlFor="auth-email" className="sr-only">
              Work email
            </Label>
            <div className="relative">
              <Mail
                className={cn(
                  "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400",
                  "lg:left-4 lg:size-5",
                )}
                aria-hidden
              />
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                placeholder="Enter your work email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={cn(inputClassName, "pl-9 pr-3 lg:pl-11 lg:pr-4")}
              />
            </div>
          </div>

          <div>
            {!isSignup ? (
              <div className="mb-1.5 flex items-center justify-end h-compact:mb-1 lg:mb-2">
                <Link
                  href="#"
                  className="text-xs font-medium transition-colors hover:opacity-80"
                  style={{ color: BRAND_COLORS.purple }}
                >
                  Forgot password?
                </Link>
              </div>
            ) : null}
            <Label htmlFor="auth-password" className="sr-only">
              Password
            </Label>
            <div className="relative">
              <Lock
                className={cn(
                  "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400",
                  "lg:left-4 lg:size-5",
                )}
                aria-hidden
              />
              <Input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                minLength={6}
                placeholder={
                  isSignup ? "Create a password" : "Enter your password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={cn(inputClassName, "pl-9 pr-9 lg:pl-11 lg:pr-11")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-0.5 text-neutral-400 transition-colors hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5842e3]/30 lg:right-4"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-4 lg:size-5" aria-hidden />
                ) : (
                  <Eye className="size-4 lg:size-5" aria-hidden />
                )}
              </button>
            </div>
          </div>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-100 h-compact:py-1.5 lg:px-4 lg:py-3 lg:text-sm">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={loading}
            aria-busy={loading || undefined}
            className={cn(
              "mt-1 flex w-full items-center justify-center gap-2 rounded-lg border-0 bg-linear-to-r from-[#5842e3] to-[#4f46e5] font-semibold text-white",
              "h-9 px-3 text-xs h-compact:mt-0.5 h-compact:h-8",
              "lg:mt-2 lg:h-10 lg:px-4 lg:text-sm xl:h-11 xl:text-base",
              "shadow-[0_10px_28px_rgba(88,66,227,0.32)] hover:from-[#4c38d4] hover:to-[#4338ca] focus-visible:ring-[#5842e3]/40 disabled:opacity-70",
            )}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            <span>{isSignup ? "Continue" : "Log in"}</span>
            {!loading ? (
              <ArrowRight className="size-4 shrink-0" aria-hidden />
            ) : null}
          </Button>
        </form>

        <p
          className={cn(
            "mt-5 text-center text-xs text-neutral-500",
            "h-compact:mt-4 lg:mt-6 xl:mt-7",
          )}
        >
          {alternatePrompt}{" "}
          <Link
            href={alternateHref}
            className="font-semibold transition-colors hover:opacity-80"
            style={{ color: BRAND_COLORS.purple }}
          >
            {alternateLinkLabel}
          </Link>
        </p>

        {isSignup ? (
          <footer
            className={cn(
              "mt-5 flex items-center justify-center gap-3 text-xs text-neutral-400",
              "h-compact:mt-4 h-compact:gap-2",
              "lg:mt-7 lg:gap-4",
              "xl:mt-9",
            )}
          >
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <Clock className="size-3.5 lg:size-4" aria-hidden />
              Setup in minutes
            </span>
            <span className="h-3 w-px bg-neutral-200" aria-hidden />
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <CheckCircle2 className="size-3.5 lg:size-4" aria-hidden />
              You approve every campaign
            </span>
          </footer>
        ) : null}
      </CardContent>
    </Card>
  );
}
