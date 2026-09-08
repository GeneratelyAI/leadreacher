"use client";

import type { CSSProperties, FormEvent } from "react";
import { BrowserBar } from "@/components/landing/hero/BrowserBar";
import { Button } from "@/components/ui/Button";
import { ArrowRight, Lock } from "@/components/ui/icons";
import ShimmerText from "@/components/ui/shimmer-text";
import { MobileWebsiteEntry } from "../MobileWebsiteEntry";
import type { WebsiteScrapeStatus } from "../../public/website-status";

type WebsiteGateProps = {
  status: WebsiteScrapeStatus;
  websiteInput: string;
  setWebsiteInput: (value: string) => void;
  setError: (value: string | null) => void;
  setMaterializeWebsiteIcon: (value: boolean) => void;
  submitWebsite: (event: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  submittingWebsite: boolean;
  error: string | null;
  message: string | null;
  materializeWebsiteIcon: boolean;
};

export function WebsiteGate({ status, websiteInput, setWebsiteInput, setError, setMaterializeWebsiteIcon, submitWebsite, loading, submittingWebsite, error, message, materializeWebsiteIcon }: WebsiteGateProps) {
  return (
          <section className="discovery-website-gate" aria-labelledby="discovery-website-title">
            <MobileWebsiteEntry value={websiteInput} onChange={(value) => { setWebsiteInput(value); setError(null); }} onSubmit={submitWebsite} disabled={loading || submittingWebsite} error={error ?? (status.status === "failed" ? message : null)} />
            <div className="signup-campaign-form-column">
              <div className="signup-campaign-copy login-campaign-copy">
                <h1 id="discovery-website-title">
                  {status.status === "failed" ? (
                    <>Let&apos;s try that again<span className="signup-campaign-period">.</span></>
                  ) : (
                    <>What&apos;s your <ShimmerText
                      className="hero-business-shimmer"
                      style={{
                        "--lr-shimmer-base": "#4f46e5",
                        "--lr-shimmer-core": "#58a6ff",
                        "--lr-shimmer-edge": "rgba(125, 183, 255, 0.7)",
                      } as CSSProperties}
                    >website</ShimmerText>?</>
                  )}
                </h1>
                <p>We use it to build your first outreach audience.</p>
              </div>

              <BrowserBar
                id="prospect-website"
                value={websiteInput}
                onValueChange={(value) => {
                  setWebsiteInput(value);
                  setError(null);
                  setMaterializeWebsiteIcon(false);
                }}
                onSubmit={submitWebsite}
                formClassName="discovery-hero-browser-bar"
                errorMessage={error ?? (status.status === "failed" ? message : null)}
                disabled={loading || submittingWebsite}
                showSubmit={false}
                errorPosition="flow"
                materializeIcon={materializeWebsiteIcon}
                concealValueWhileDisabled={false}
              >
                <Button type="submit" disabled={loading || submittingWebsite} className="signup-campaign-submit">
                  {loading || submittingWebsite ? "Analyzing your website..." : "Analyze website"}
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </BrowserBar>

              <p className="discovery-website-security">
                <Lock className="size-4" aria-hidden />
                Your information is secure and private
              </p>
            </div>
          </section>
  );
}
