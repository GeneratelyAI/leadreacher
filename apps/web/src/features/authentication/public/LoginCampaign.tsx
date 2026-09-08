"use client";

import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "@/components/ui/icons";
import { Captcha } from "@/features/authentication/components/Captcha";
import { GoogleIcon, MicrosoftIcon } from "@/features/authentication/components/Providers";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { useAuthForm } from "@/features/authentication/hooks/useAuthForm";
import { cn } from "@/lib/utils";
import { useWebsiteScrapeStatus } from "@/features/onboarding/public/website-status";
import { Pill, type PillData } from "@/features/onboarding/public/pill";
import { createLiveCampaignSummary } from "@/features/onboarding/public/summary";
import type { AuthCampaignFormState } from "../components/auth-campaign-types";
import styles from "../components/AuthMobile.module.css";

const inputClassName = cn(
  "signup-campaign-control h-15 rounded-xl border-neutral-200 bg-white pl-13 pr-4 text-[0.98rem] text-[#15192c] shadow-none",
  "placeholder:text-[#8a90a8] focus-visible:border-[#5b3ff0] focus-visible:ring-4 focus-visible:ring-[#5b3ff0]/10",
);

export default function LoginCampaign() {
  const form = useAuthForm("login");
  const { status, websiteUrl } = useWebsiteScrapeStatus({ autoStart: false });
  const campaign = websiteUrl ? createLiveCampaignSummary(status, "signup", undefined, websiteUrl) : undefined;

  return <LoginCampaignView form={form} campaign={campaign} />;
}

export function LoginCampaignView({ form, campaign, preview = false }: {
  form: AuthCampaignFormState;
  campaign?: PillData;
  preview?: boolean;
}) {
  const {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    error,
    loading,
    setCaptchaToken,
    captchaResetKey,
    handleEmailSubmit,
    handleOAuth,
  } = form;

  return (
    <div data-testid="login-campaign-auth" className={cn("signup-campaign-layout login-campaign-layout", styles.layout, styles.login)}>
      <section className={cn("signup-campaign-form-column", styles.column)} aria-labelledby="login-campaign-title">
        <div className={cn("signup-campaign-copy login-campaign-copy", styles.copy)}>
          <h1 id="login-campaign-title">
            Welcome back<span className="signup-campaign-period">.</span>
          </h1>
          <p><span className={styles.desktopOnly}>Sign in to pick up where you left off.</span><span className={styles.mobileOnly}>Pick up where you left off.</span></p>
        </div>

        <div className={cn("signup-campaign-auth-actions", styles.actions)}>
          <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", styles.providers)}>
            <Button type="button" variant="outline" className={cn("signup-campaign-provider", styles.provider)} onClick={() => handleOAuth("google")}>
              <GoogleIcon className="size-6" />
              Continue with Google
            </Button>
            <Button type="button" variant="outline" className={cn("signup-campaign-provider", styles.provider)} onClick={() => handleOAuth("azure")}>
              <MicrosoftIcon className="size-6" />
              Continue with Microsoft
            </Button>
          </div>

          <div className={cn("signup-campaign-divider", styles.divider)} aria-hidden>
            <span />
            <b>or</b>
            <span />
          </div>

          <form className={cn("space-y-3", styles.form)} onSubmit={handleEmailSubmit}>
            <div className="relative">
              <Label htmlFor="login-email" className={cn("sr-only", styles.fieldLabel)}>Email address</Label>
              <div className={styles.controlWrap}>
                <Mail className={cn("pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-[#737a96]", styles.fieldIcon)} aria-hidden />
                <Input id="login-email" type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} className={cn(inputClassName, styles.control)} />
              </div>
            </div>
            <div className="relative">
              <Label htmlFor="login-password" className={cn("sr-only", styles.fieldLabel)}>Password</Label>
              <div className={styles.controlWrap}>
              <Lock className={cn("pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-[#737a96]", styles.fieldIcon)} aria-hidden />
              <Input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} className={cn(inputClassName, "pr-13", styles.control, styles.passwordControl)} />
              <button type="button" onClick={() => setShowPassword((current) => !current)} className={cn("tap-target absolute top-1/2 right-4 rounded-md p-1 text-[#737a96] transition-colors hover:text-[#33218e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b3ff0]/35", styles.reveal)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
              </button>
              </div>
            </div>

            <div className={cn("login-campaign-forgot", styles.forgot)}><Link href="/forgot-password" prefetch={false}>Forgot password?</Link></div>
            {!preview ? <Captcha onTokenChange={setCaptchaToken} resetKey={captchaResetKey} /> : null}
            {error ? <p role="alert" className="signup-campaign-error">{error}</p> : null}

            <Button type="submit" disabled={loading} aria-busy={loading || undefined} className={cn("signup-campaign-submit", styles.submit)}>
              {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              <span>Sign in</span>
              {!loading ? <ArrowRight className={cn("size-5", styles.submitIcon)} aria-hidden /> : null}
            </Button>
          </form>

          <p className={cn("signup-campaign-login", styles.switchAccount)}>New to LeadReacher? <Link href={preview ? "/onboarding-preview?screen=01" : "/signup"} prefetch={false}><span className={styles.desktopOnly}>Start your first campaign</span><span className={styles.mobileOnly}>Create an account</span></Link></p>
        </div>
      </section>
      {campaign ? <aside className={cn(styles.mobileOnly, styles.summary)} aria-label="Live campaign summary"><Pill campaign={campaign} responsiveDefaultCollapsed /></aside> : null}
    </div>
  );
}
