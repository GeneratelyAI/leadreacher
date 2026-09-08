"use client";

import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "@/components/ui/icons";
import { Captcha } from "@/features/authentication/components/Captcha";
import { GoogleIcon, MicrosoftIcon } from "@/features/authentication/components/Providers";
import { Pill, type PillData } from "@/features/onboarding/public/pill";
import { createLiveCampaignSummary } from "@/features/onboarding/public/summary";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { useAuthForm } from "@/features/authentication/hooks/useAuthForm";
import { useWebsiteScrapeStatus } from "@/features/onboarding/public/website-status";
import { MIN_PASSWORD_LENGTH } from "@/features/authentication/public/password-policy";
import { cn } from "@/lib/utils";
import type { AuthCampaignFormState } from "../components/auth-campaign-types";
import styles from "../components/AuthMobile.module.css";

const inputClassName = cn(
  "signup-campaign-control h-15 rounded-xl border-neutral-200 bg-white pl-13 pr-4 text-[0.98rem] text-[#15192c] shadow-none",
  "placeholder:text-[#8a90a8] focus-visible:border-[#5b3ff0] focus-visible:ring-4 focus-visible:ring-[#5b3ff0]/10",
);

export default function SignupCampaign() {
  const form = useAuthForm("signup");
  const { status, websiteUrl } = useWebsiteScrapeStatus();
  const campaign = createLiveCampaignSummary(status, "signup", undefined, websiteUrl);

  return <SignupCampaignView form={form} campaign={campaign} />;
}

export function SignupCampaignView({ form, campaign, preview = false }: {
  form: AuthCampaignFormState;
  campaign: PillData;
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
    <div data-testid="signup-campaign-auth" className={cn("signup-campaign-layout", styles.layout)}>
      <section className={cn("signup-campaign-form-column", styles.column)} aria-labelledby="signup-campaign-title">
        <div className={cn("signup-campaign-copy", styles.copy)}>
          <h1 id="signup-campaign-title">
            Launch your<span className={styles.mobileOnly}> </span><br className={styles.desktopOnly} />
            first campaign<span className="signup-campaign-period">.</span>
          </h1>
          <p><span className={styles.desktopOnly}>Sign in or create an account to continue.</span><span className={styles.mobileOnly}>Create your account to get started.</span></p>
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
              <Label htmlFor="signup-email" className={cn("sr-only", styles.fieldLabel)}>Email address</Label>
              <div className={styles.controlWrap}>
                <Mail className={cn("pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-[#737a96]", styles.fieldIcon)} aria-hidden />
                <Input id="signup-email" type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} className={cn(inputClassName, styles.control)} />
              </div>
            </div>
            <div className="relative">
              <Label htmlFor="signup-password" className={cn("sr-only", styles.fieldLabel)}>Password</Label>
              <div className={styles.controlWrap}>
              <Lock className={cn("pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-[#737a96]", styles.fieldIcon)} aria-hidden />
              <Input id="signup-password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} className={cn(inputClassName, "pr-13", styles.control, styles.passwordControl)} />
              <button type="button" onClick={() => setShowPassword((current) => !current)} className={cn("tap-target absolute top-1/2 right-4 rounded-md p-1 text-[#737a96] transition-colors hover:text-[#33218e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b3ff0]/35", styles.reveal)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
              </button>
              </div>
            </div>

            {!preview ? <Captcha onTokenChange={setCaptchaToken} resetKey={captchaResetKey} /> : null}
            {error ? <p role="alert" className="signup-campaign-error">{error}</p> : null}

            <Button type="submit" disabled={loading} aria-busy={loading || undefined} className={cn("signup-campaign-submit", styles.submit)}>
              {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              <span className={styles.desktopOnly}>Continue</span><span className={styles.mobileOnly}>Create account</span>
              {!loading ? <ArrowRight className={cn("size-5", styles.submitIcon)} aria-hidden /> : null}
            </Button>
          </form>

          <p className={styles.legal}>By creating an account, you agree to our <Link href="/terms" prefetch={false}>Terms of Service</Link> and <Link href="/privacy" prefetch={false}>Privacy Policy.</Link></p>
          <p className={cn("signup-campaign-login", styles.switchAccount)}>Already have an account? <Link href={preview ? "/onboarding-preview?screen=02" : "/login"} prefetch={false}>Sign in</Link></p>
        </div>

      </section>

      <aside className={cn("signup-campaign-pill-column", styles.summary)} aria-label="Live campaign summary">
        <Pill
          campaign={campaign}
          className="signup-campaign-pill"
          responsiveDefaultCollapsed
        />
      </aside>
    </div>
  );
}
