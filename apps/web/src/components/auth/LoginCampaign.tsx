"use client";

import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "@/components/ui/icons";
import { Captcha } from "@/components/auth/Captcha";
import { GoogleIcon, MicrosoftIcon } from "@/components/auth/Providers";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/label";
import { useAuthForm } from "@/hooks/useAuthForm";
import { cn } from "@/lib/utils";

const inputClassName = cn(
  "signup-campaign-control h-15 rounded-xl border-neutral-200 bg-white pl-13 pr-4 text-[0.98rem] text-[#15192c] shadow-none",
  "placeholder:text-[#8a90a8] focus-visible:border-[#5b3ff0] focus-visible:ring-4 focus-visible:ring-[#5b3ff0]/10",
);

export default function LoginCampaign() {
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
  } = useAuthForm("login");

  return (
    <div data-testid="login-campaign-auth" className="signup-campaign-layout login-campaign-layout">
      <section className="signup-campaign-form-column" aria-labelledby="login-campaign-title">
        <div className="signup-campaign-copy login-campaign-copy">
          <h1 id="login-campaign-title">
            Welcome back<span className="signup-campaign-period">.</span>
          </h1>
          <p>Sign in to pick up where you left off.</p>
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
              <Label htmlFor="login-email" className="sr-only">Email address</Label>
              <Mail className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-[#737a96]" aria-hidden />
              <Input id="login-email" type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required placeholder="Email address" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClassName} />
            </div>
            <div className="relative">
              <Label htmlFor="login-password" className="sr-only">Password</Label>
              <Lock className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-[#737a96]" aria-hidden />
              <Input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} className={cn(inputClassName, "pr-13")} />
              <button type="button" onClick={() => setShowPassword((current) => !current)} className="tap-target absolute top-1/2 right-4 -translate-y-1/2 rounded-md p-1 text-[#737a96] transition-colors hover:text-[#33218e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b3ff0]/35" aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
              </button>
            </div>

            <div className="login-campaign-forgot"><Link href="/forgot-password">Forgot password?</Link></div>
            <Captcha onTokenChange={setCaptchaToken} resetKey={captchaResetKey} />
            {error ? <p role="alert" className="signup-campaign-error">{error}</p> : null}

            <Button type="submit" disabled={loading} aria-busy={loading || undefined} className="signup-campaign-submit">
              {loading ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
              <span>Sign in</span>
              {!loading ? <ArrowRight className="size-5" aria-hidden /> : null}
            </Button>
          </form>

          <p className="signup-campaign-login">New to LeadReacher? <Link href="/signup">Start your first campaign</Link></p>
        </div>
      </section>

    </div>
  );
}
