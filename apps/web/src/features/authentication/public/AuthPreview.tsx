"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Layout from "./Layout";
import { SignupCampaignView } from "./SignupCampaign";
import { LoginCampaignView } from "./LoginCampaign";
import type { AuthCampaignFormState } from "../components/auth-campaign-types";
import type { PillData } from "@/features/onboarding/public/pill";
import { validateNewPassword } from "@/features/authentication/public/password-policy";

/** Preview uses the production form views, but never mounts authentication hooks. */
export function AuthPreview({
  mode,
  campaign,
  onComplete,
}: {
  mode: "signup" | "login";
  campaign?: PillData;
  onComplete?: () => void;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("alex@acme.example");
  const [password, setPassword] = useState("Campaign2026!");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = () => {
    if (onComplete) onComplete();
    else router.push("/onboarding-preview?screen=03");
  };
  const form: AuthCampaignFormState = {
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    error,
    loading: false,
    setCaptchaToken: () => undefined,
    captchaResetKey: 0,
    handleEmailSubmit: async (event) => {
      event.preventDefault();
      const passwordError =
        mode === "signup" ? validateNewPassword(password) : null;
      setError(passwordError);
      if (!passwordError) complete();
    },
    handleOAuth: async () => complete(),
  };

  return (
    <Layout campaign>
      {mode === "signup" ? (
        <SignupCampaignView
          form={form}
          campaign={
            campaign ?? {
              fields: [],
              status: "learning",
              statusLabel: "Building your campaign",
            }
          }
          preview
        />
      ) : (
        <LoginCampaignView form={form} campaign={campaign} preview />
      )}
    </Layout>
  );
}
