"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "@/components/ui/icons";
import { Captcha } from "@/components/auth/Captcha";
import { GoogleIcon, MicrosoftIcon } from "@/components/auth/Providers";
import { Pill, type PillData } from "@/components/onboarding/Pill";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { useAuthForm } from "@/hooks/useAuthForm";
import { useWebsiteScrapeStatus } from "@/hooks/useWebsiteScrapeStatus";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";
import { getWebsiteFaviconUrl, parseWebsiteLink } from "@/lib/discovery-website";
import { cn } from "@/lib/utils";

const inputClassName = cn(
  "signup-campaign-control h-15 rounded-xl border-neutral-200 bg-white pl-13 pr-4 text-[0.98rem] text-[#15192c] shadow-none",
  "placeholder:text-[#8a90a8] focus-visible:border-[#5b3ff0] focus-visible:ring-4 focus-visible:ring-[#5b3ff0]/10",
);

export default function SignupCampaign() {
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
  } = useAuthForm("signup");
  const { status, websiteUrl } = useWebsiteScrapeStatus();

  const campaign = useMemo<PillData>(() => {
    const website = parseWebsiteLink(websiteUrl ?? status.url ?? "");
    return {
      status: "learning",
      statusLabel: "Building your campaign",
      fields: [],
      site: website
        ? {
            label: website.hostname,
            iconUrl: getWebsiteFaviconUrl(website.hostname),
        }
        : undefined,
    };
  }, [status.url, websiteUrl]);

  return (
    <div data-testid="signup-campaign-auth" className="signup-campaign-layout">
      <section className="signup-campaign-form-column" aria-labelledby="signup-campaign-title">
        <div className="signup-campaign-copy">
          <h1 id="signup-campaign-title">
            Launch your<br />
            first campaign<span className="signup-campaign-period">.</span>
          </h1>
          <p>Sign in or create an account to continue.</p>
        </div>

        <div className="signup-campaign-auth-actions">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button type="button" variant="outline" className="signup-campaign-provider" onClick={() => handleOAuth("google")}>
              <GoogleIcon className="size-6" />
              Continue with Google
            </Button>
            <Button type="button" variant="outline" className="signup-campaign-provider" onClick={() => handleOAuth("azure")}>
              <MicrosoftIcon className="size-6" />
              Continue with Microsoft
            </Button>
          </div>

          <div className="signup-campaign-divider" aria-hidden>
            <span />
            <b>or</b>
            <span />
          </div>

          <form className="space-y-3" onSubmit={handleEmailSubmit}>
            <div className="relative">
              <Label htmlFor="signup-email" className="sr-only">Email address</Label>
              <Mail className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-[#737a96]" aria-hidden />
              <Input id="signup-email" type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClassName} />
            </div>
            <div className="relative">
              <Label htmlFor="signup-password" className="sr-only">Password</Label>
              <Lock className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-[#737a96]" aria-hidden />
              <Input id="signup-password" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} className={cn(inputClassName, "pr-13")} />
              <button type="button" onClick={() => setShowPassword((current) => !current)} className="tap-target absolute top-1/2 right-4 -translate-y-1/2 rounded-md p-1 text-[#737a96] transition-colors hover:text-[#33218e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b3ff0]/35" aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
              </button>
            </div>

            <Captcha onTokenChange={setCaptchaToken} resetKey={captchaResetKey} />
            {error ? <p role="alert" className="signup-campaign-error">{error}</p> : null}

            <Button type="submit" disabled={loading} aria-busy={loading || undefined} className="signup-campaign-submit">
              {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              <span>Continue</span>
              {!loading ? <ArrowRight className="size-5" aria-hidden /> : null}
            </Button>
          </form>

          <p className="signup-campaign-login">Already have an account? <Link href="/login">Sign in</Link></p>
        </div>

      </section>

      <aside className="signup-campaign-pill-column" aria-label="Live campaign summary">
        <Pill
          campaign={campaign}
          className="signup-campaign-pill"
        />
      </aside>
    </div>
  );
}
