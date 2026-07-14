"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { bootstrapOrganization } from "@/lib/api";
import { defaultOrgNameFromEmail } from "@/lib/auth/org-name";
import { createClient } from "@/lib/supabase/client";
import { useWebsiteScrapeStatus } from "@/hooks/useWebsiteScrapeStatus";
import { promoteAnonymousDiscoveryCache } from "@/lib/discovery-scrape-cache";

type AuthMode = "login" | "signup";

export function useAuthForm(mode: AuthMode) {
  const router = useRouter();
  const { waitForReadyToNavigate } = useWebsiteScrapeStatus({
    autoStart: false,
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function ensureOrganizationBootstrapped(userEmail: string) {
    const anonScrapeId = window.localStorage.getItem("lr_anon_scrape_id")?.trim();
    const bootstrap = await bootstrapOrganization(
      defaultOrgNameFromEmail(userEmail),
      anonScrapeId || undefined,
    );
    promoteAnonymousDiscoveryCache(
      bootstrap.orgId,
      anonScrapeId || null,
      bootstrap.scrapeStatus,
    );
    window.localStorage.removeItem("lr_anon_scrape_id");
    window.localStorage.removeItem("lr_website_url");
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    try {
      if (isSignup) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: fullName
            ? { data: { full_name: fullName.trim() } }
            : undefined,
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
        });
        if (signInError) {
          throw signInError;
        }
      }

      await waitForReadyToNavigate(5000).catch((caught) => {
        if (process.env.NODE_ENV === "development") {
          console.error("[auth] discovery scrape wait failed", caught);
        }
      });

      await ensureOrganizationBootstrapped(email);

      router.push("/onboarding?step=discovery");
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
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/onboarding?step=discovery")}`;

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
    showPassword,
    setShowPassword,
    error,
    loading,
    isSignup,
    handleEmailSubmit,
    handleOAuth,
  };
}
