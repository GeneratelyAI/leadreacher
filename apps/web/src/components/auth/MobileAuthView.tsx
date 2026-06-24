"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Send,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { Fragment } from "react";
import { GoogleIcon, MicrosoftIcon } from "@/components/auth/OAuthIcons";
import { useAuthForm } from "@/hooks/useAuthForm";
import { ASSETS } from "@/lib/constants/brand";
import {
  AUTH_MOBILE_COPY,
  AUTH_MOBILE_PROCESS_STEPS,
} from "@/lib/constants/auth-mobile";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "signup";

type MobileAuthViewProps = {
  mode: AuthMode;
};

const stepIcons = {
  generate: Sparkles,
  approve: CheckCircle2,
  launch: Send,
} as const;

const inputClassName = cn(
  "auth-mobile-glass-input w-full rounded-xl px-4 py-3.5 text-[15px] text-neutral-900 shadow-sm",
  "placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/12",
  "dark:focus-visible:ring-[#c4b5f0]/15",
);

const oauthButtonClassName = cn(
  "auth-mobile-glass-oauth flex flex-1 items-center justify-center gap-2 rounded-xl",
  "px-3 py-3 text-sm font-medium text-neutral-800 shadow-sm active:bg-white/85",
);

export default function MobileAuthView({ mode }: MobileAuthViewProps) {
  const copy = AUTH_MOBILE_COPY[mode];
  const {
    email,
    setEmail,
    password,
    setPassword,
    fullName,
    setFullName,
    showPassword,
    setShowPassword,
    error,
    loading,
    handleEmailSubmit,
    handleOAuth,
  } = useAuthForm(mode);

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-[430px] pb-8 lg:hidden">
      <div className="flex flex-col items-center px-4 pt-14">
        <Link
          href="/"
          className={cn(mode === "login" ? "mb-16" : "mb-10")}
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

        <h1 className="text-center text-[28px] leading-tight font-bold tracking-tight text-[#111827] dark:text-white">
          <span className="block">{copy.heroLine1}</span>
          <span className="block text-brand-purple dark:text-[#c4b5f0]">
            {copy.heroLine2}
          </span>
        </h1>

        <p className="mt-3 max-w-[280px] text-center text-sm leading-relaxed text-neutral-500 dark:text-white/60">
          {copy.subtext}
        </p>

        <div className="mt-6 flex w-full max-w-sm items-center gap-3">
          <div className="h-px flex-1 bg-neutral-300/80 dark:bg-white/15" />
          <div className="flex shrink-0 items-center gap-2 text-[13px] text-[#5e5870] dark:text-white/70">
            <ShieldCheck
              className="size-4 shrink-0 text-brand-purple dark:text-[#c4b5f0]"
              strokeWidth={2}
              aria-hidden
            />
            <span className="whitespace-nowrap">
              You stay in control. We handle the rest.
            </span>
          </div>
          <div className="h-px flex-1 bg-neutral-300/80 dark:bg-white/15" />
        </div>

        <div className="mt-6 flex items-start justify-center gap-2">
          {AUTH_MOBILE_PROCESS_STEPS.map((step, index) => (
            <Fragment key={step.key}>
              {index > 0 ? (
                <div className="flex h-12 items-center">
                  <ArrowRight
                    className="size-4 shrink-0 text-[#c4b8d8] dark:text-white/25"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                </div>
              ) : null}
              <div className="flex flex-col items-center gap-2">
                <span
                  className="inline-flex size-12 items-center justify-center rounded-xl bg-[#ede8f7] dark:bg-white/8"
                  aria-hidden
                >
                  {(() => {
                    const Icon = stepIcons[step.key];
                    return (
                      <Icon
                        className="size-5 text-brand-purple dark:text-[#c4b5f0]"
                        strokeWidth={1.75}
                      />
                    );
                  })()}
                </span>
                <span className="text-xs font-medium text-[#5e5870] dark:text-white/70">
                  {step.label}
                </span>
              </div>
            </Fragment>
          ))}
        </div>

        <div className="mt-8 w-full">
          <div className="flex gap-2.5">
            <button
              type="button"
              className={oauthButtonClassName}
              onClick={() => handleOAuth("google")}
            >
              <GoogleIcon className="size-4" />
              <span>{mode === "signup" ? "Signup" : "Sign in"}</span>
            </button>
            <button
              type="button"
              className={oauthButtonClassName}
              onClick={() => handleOAuth("azure")}
            >
              <MicrosoftIcon className="size-4" />
              <span>{mode === "signup" ? "Signup" : "Sign in"}</span>
            </button>
          </div>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-neutral-300/70 dark:bg-white/12" />
            <span className="text-xs font-medium text-neutral-400 dark:text-white/40">
              OR
            </span>
            <div className="h-px flex-1 bg-neutral-300/70 dark:bg-white/12" />
          </div>

          <form className="space-y-4" onSubmit={handleEmailSubmit}>
            <div className="auth-mobile-glass-card space-y-2 rounded-2xl p-2">
              {copy.showFullName ? (
                <div className="relative">
                  <input
                    id="mobile-auth-full-name"
                    type="text"
                    autoComplete="name"
                    placeholder="Full Name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className={cn(inputClassName, "pr-11")}
                  />
                  <User
                    className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-neutral-400 dark:text-white/35"
                    aria-hidden
                  />
                </div>
              ) : null}

              <div className="relative">
                <input
                  id="mobile-auth-email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="Professional Email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={cn(inputClassName, "pr-11")}
                />
                <Mail
                  className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-neutral-400 dark:text-white/35"
                  aria-hidden
                />
              </div>

              <div className="relative">
                <input
                  id="mobile-auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  required
                  minLength={6}
                  placeholder="Password *"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={cn(inputClassName, "pr-11")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute top-1/2 right-4 -translate-y-1/2 rounded-md p-0.5 text-neutral-400 transition-colors hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30 dark:text-white/35 dark:hover:text-white/60 dark:focus-visible:ring-[#c4b5f0]/30"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>

            {error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-700 ring-1 ring-red-100 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading || undefined}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl bg-brand-purple py-4",
                "text-sm font-bold text-white transition-opacity disabled:opacity-70",
              )}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              <span>{copy.submitLabel}</span>
            </button>

            {copy.showTerms ? (
              <p className="text-center text-xs text-neutral-400 dark:text-white/45">
                By registering you agree to our{" "}
                <Link
                  href="#"
                  className="font-semibold text-brand-purple underline dark:text-[#c4b5f0]"
                >
                  terms of use.
                </Link>
              </p>
            ) : null}
          </form>
        </div>

        <p className="mt-6 text-center text-sm font-semibold text-[#111827] dark:text-white/90">
          {copy.alternatePrompt}{" "}
          <Link
            href={copy.alternateHref}
            className="text-brand-purple dark:text-[#c4b5f0]"
          >
            {copy.alternateLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
