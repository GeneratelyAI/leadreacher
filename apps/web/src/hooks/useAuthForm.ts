"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { bootstrapOrganization, clearAccessTokenCache } from "@/lib/api";
import { defaultOrgNameFromEmail } from "@/lib/auth/org-name";
import { createClient } from "@/lib/supabase/client";
import { useWebsiteScrapeStatus } from "@/hooks/useWebsiteScrapeStatus";
import { promoteAnonymousDiscoveryCache } from "@/lib/discovery-scrape-cache";
import { postLoginRedirectPath } from "@/lib/auth/post-login-redirect";
import { authErrorMessage } from "@/lib/auth/auth-errors";
import { validateNewPassword } from "@/lib/auth/password-policy";
import { isCaptchaEnabled } from "@/components/auth/AuthCaptcha";

type AuthMode = "login" | "signup";
type AccountType = "individual" | "company";
type AuthFactor = { status: string };

type DemoAuthResult = {
  fullName: string;
  email: string;
};

export function useAuthForm(
  mode: AuthMode,
  options: { demo?: boolean; onDemoComplete?: (result: DemoAuthResult) => void } = {},
) {
  const router = useRouter();
  const { waitForReadyToNavigate } = useWebsiteScrapeStatus({
    autoStart: false,
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("individual");
  const [companyName, setCompanyName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const isSignup = mode === "signup";

  async function ensureOrganizationBootstrapped(userEmail: string) {
    const anonScrapeId = window.localStorage.getItem("lr_anon_scrape_id")?.trim();
    const orgName =
      isSignup && accountType === "company" && companyName.trim()
        ? companyName.trim()
        : defaultOrgNameFromEmail(userEmail);
    const bootstrap = await bootstrapOrganization(
      orgName,
      anonScrapeId || undefined,
      isSignup ? accountType : undefined,
    );
    promoteAnonymousDiscoveryCache(
      bootstrap.orgId,
      anonScrapeId || null,
      bootstrap.scrapeStatus,
    );
    window.localStorage.removeItem("lr_anon_scrape_id");
    window.localStorage.removeItem("lr_website_url");
    return bootstrap;
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (isSignup && accountType === "company" && !companyName.trim()) {
      setError("Enter your company name to continue.");
      return;
    }

    if (isSignup) {
      const passwordError = validateNewPassword(password);
      if (passwordError) {
        setError(passwordError);
        return;
      }
    }

    if (!options.demo && isCaptchaEnabled && !captchaToken) {
      setError("Complete the security verification to continue.");
      return;
    }

    setLoading(true);

    if (options.demo) {
      options.onDemoComplete?.({ fullName: fullName.trim(), email: email.trim() });
      setLoading(false);
      return;
    }

    const supabase = createClient();

    try {
      if (isSignup) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            ...(fullName ? { data: { full_name: fullName.trim() } } : {}),
            ...(captchaToken ? { captchaToken } : {}),
          },
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
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: captchaToken ? { captchaToken } : undefined,
        });
        if (signInError) {
          throw signInError;
        }
      }

      clearAccessTokenCache();

      const [{ data: assurance }, { data: factors }] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ]);
      const hasVerifiedFactor = (factors?.all as AuthFactor[] | undefined)?.some(
        (factor: AuthFactor) => factor.status === "verified",
      );
      if (hasVerifiedFactor && assurance?.currentLevel !== "aal2") {
        router.replace("/verify-mfa?next=/dashboard");
        router.refresh();
        return;
      }

      await waitForReadyToNavigate(5000).catch((caught) => {
        if (process.env.NODE_ENV === "development") {
          console.error("[auth] discovery scrape wait failed", caught);
        }
      });

      const bootstrap = await ensureOrganizationBootstrapped(email);

      router.push(postLoginRedirectPath(bootstrap.onboardedAt));
      router.refresh();
    } catch (caught) {
      setCaptchaToken(null);
      setCaptchaResetKey((current) => current + 1);
      setError(authErrorMessage(caught, isSignup ? "sign-up" : "sign-in"));
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "azure") {
    setError(null);
    if (options.demo) {
      options.onDemoComplete?.({
        fullName: provider === "google" ? "Google Demo User" : "Microsoft Demo User",
        email: `${provider}@demo.leadreacher.local`,
      });
      return;
    }
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/onboarding")}`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });

    if (oauthError) {
      setError(oauthError.message);
    }
  }

  return {
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
    captchaToken,
    setCaptchaToken,
    captchaResetKey,
    isSignup,
    handleEmailSubmit,
    handleOAuth,
  };
}
