"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
  Users,
} from "lucide-react";
import { GoogleIcon, MicrosoftIcon } from "@/components/auth/OAuthIcons";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { useAuthForm } from "@/hooks/useAuthForm";
import { ASSETS } from "@/lib/constants/brand";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "signup";

type MobileAuthViewProps = {
  mode: AuthMode;
};

const inputClassName = cn(
  "auth-glass-control rounded-lg text-neutral-900 shadow-none placeholder:text-neutral-400",
  "dark:text-white dark:placeholder:text-white/55",
  "h-10 text-sm pl-9 pr-3",
);

const oauthButtonClassName = cn(
  "auth-glass-control relative w-full rounded-lg font-medium text-neutral-800",
  "dark:text-white/90",
  "h-10 px-3 text-sm",
);

export default function MobileAuthView({ mode }: MobileAuthViewProps) {
  const {
    email,
    setEmail,
    password,
    setPassword,
    fullName,
    setFullName,
    accountType,
    setAccountType,
    companyName,
    setCompanyName,
    showPassword,
    setShowPassword,
    error,
    loading,
    isSignup,
    handleEmailSubmit,
    handleOAuth,
  } = useAuthForm(mode);

  const alternateHref = isSignup ? "/login" : "/signup";
  const alternatePrompt = isSignup
    ? "Already have an account?"
    : "Don't have an account?";
  const alternateLinkLabel = isSignup ? "Log in" : "Sign up";

  return (
    <div
      data-testid="mobile-auth-view"
      className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center px-4 lg:hidden"
    >
      <Link
        href="/"
        className="flex shrink-0 justify-center pt-[max(4.5rem,env(safe-area-inset-top))] pb-6"
        aria-label="leadreacher home"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ASSETS.logoColored}
          alt="leadreacher"
          className="h-6 w-auto dark:hidden"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ASSETS.logoWhite}
          alt="leadreacher"
          className="hidden h-6 w-auto dark:block"
        />
      </Link>

      <div className="flex w-full flex-1 flex-col items-center justify-center pb-[max(2rem,env(safe-area-inset-bottom))]">
        <Card className="w-full antialiased ring-0 [--card-spacing:0]">
          <CardContent className="px-5 py-6">
            <h2 className="mb-5 text-center text-xs font-bold tracking-[0.14em] uppercase text-brand-purple dark:text-[#c4b5f0]">
              {isSignup
                ? "Welcome to leadreacher"
                : "Welcome back to leadreacher"}
            </h2>

            <div className="space-y-2.5">
              <Button
                type="button"
                variant="outline"
                className={oauthButtonClassName}
                onClick={() => handleOAuth("google")}
              >
                <GoogleIcon className="absolute left-3 size-4" />
                <span className="flex-1 text-center">Continue with Google</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className={oauthButtonClassName}
                onClick={() => handleOAuth("azure")}
              >
                <MicrosoftIcon className="absolute left-3 size-4" />
                <span className="flex-1 text-center">
                  Continue with Microsoft
                </span>
              </Button>
            </div>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-neutral-200 dark:bg-white/16" />
              <span className="text-xs text-neutral-400 dark:text-white/60">or</span>
              <div className="h-px flex-1 bg-neutral-200 dark:bg-white/16" />
            </div>

            <form className="space-y-3" onSubmit={handleEmailSubmit}>
              {isSignup ? (
                <div
                  role="radiogroup"
                  aria-label="Account type"
                  className="auth-glass-control grid grid-cols-2 gap-1 rounded-lg p-1"
                >
                  {(
                    [
                      { value: "individual", label: "Individual", Icon: User },
                      { value: "company", label: "Company / Team", Icon: Users },
                    ] as const
                  ).map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={accountType === value}
                      onClick={() => setAccountType(value)}
                      className={cn(
                        "flex h-9 items-center justify-center gap-1.5 rounded-[7px] text-xs font-semibold transition-colors duration-fast ease-brand",
                        accountType === value
                          ? "bg-linear-to-r from-[#5842e3] to-[#4f46e5] text-white shadow-[0_4px_14px_rgba(88,66,227,0.28)]"
                          : "text-neutral-500 dark:text-white/60",
                      )}
                    >
                      <Icon className="size-3.5" aria-hidden />
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}

              {isSignup ? (
                <div>
                  <Label htmlFor="mobile-auth-full-name" className="sr-only">
                    Full name
                  </Label>
                  <div className="relative">
                    <User
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400 dark:text-white/55"
                      aria-hidden
                    />
                    <Input
                      id="mobile-auth-full-name"
                      type="text"
                      autoComplete="name"
                      enterKeyHint="next"
                      required
                      placeholder="Enter your full name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className={inputClassName}
                    />
                  </div>
                </div>
              ) : null}

              {isSignup && accountType === "company" ? (
                <div>
                  <Label htmlFor="mobile-auth-company-name" className="sr-only">
                    Company name
                  </Label>
                  <div className="relative">
                    <Building2
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400 dark:text-white/55"
                      aria-hidden
                    />
                    <Input
                      id="mobile-auth-company-name"
                      type="text"
                      autoComplete="organization"
                      enterKeyHint="next"
                      aria-required="true"
                      placeholder="Enter your company name"
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                      className={inputClassName}
                    />
                  </div>
                </div>
              ) : null}

              <div>
                <Label htmlFor="mobile-auth-email" className="sr-only">
                  Work email
                </Label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400 dark:text-white/55"
                    aria-hidden
                  />
                  <Input
                    id="mobile-auth-email"
                    type="email"
                    autoComplete="email"
                    enterKeyHint="next"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    placeholder="Enter your work email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={inputClassName}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="mobile-auth-password" className="sr-only">
                  Password
                </Label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400 dark:text-white/55"
                    aria-hidden
                  />
                  <Input
                    id="mobile-auth-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={isSignup ? "new-password" : "current-password"}
                    enterKeyHint="go"
                    required
                    minLength={6}
                    placeholder={
                      isSignup ? "Create a password" : "Enter your password"
                    }
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={cn(inputClassName, "pr-9")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="tap-target absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-0.5 text-neutral-400 transition-colors duration-fast ease-brand hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5842e3]/30 dark:text-white/55 dark:hover:text-white/80 dark:focus-visible:ring-[#c4b5f0]/30"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" aria-hidden />
                    ) : (
                      <Eye className="size-4" aria-hidden />
                    )}
                  </button>
                </div>
                {!isSignup ? (
                  <div className="mt-1.5 flex items-center justify-end">
                    <Link
                      href="/forgot-password"
                      className="tap-target relative text-xs font-medium text-brand-purple transition-colors duration-fast ease-brand hover:opacity-80 dark:text-[#c4b5f0]"
                    >
                      Forgot password?
                    </Link>
                  </div>
                ) : null}
              </div>

              {error ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-100 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20">
                  {error}
                </p>
              ) : null}

              <Button
                type="submit"
                disabled={loading}
                aria-busy={loading || undefined}
                className={cn(
                  "mt-1 flex w-full items-center justify-center gap-2 rounded-lg border-0 bg-linear-to-r from-[#5842e3] to-[#4f46e5] font-semibold text-white",
                  "h-10 px-3 text-sm",
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

            <p className="mt-5 text-center text-xs text-neutral-500 dark:text-white/70">
              {alternatePrompt}{" "}
              <Link
                href={alternateHref}
                className="tap-target relative font-semibold text-brand-purple transition-colors duration-fast ease-brand hover:opacity-80 dark:text-[#c4b5f0]"
              >
                {alternateLinkLabel}
              </Link>
            </p>

            {isSignup ? (
              <footer className="mt-5 flex items-center justify-center gap-3 text-xs text-neutral-400 dark:text-white/60">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <Clock className="size-3.5" aria-hidden />
                  Setup in minutes
                </span>
                <span className="h-3 w-px bg-neutral-200 dark:bg-white/16" aria-hidden />
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  You approve every campaign
                </span>
              </footer>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
