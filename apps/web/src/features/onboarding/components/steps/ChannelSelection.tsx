"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ArrowLeft, ArrowRight } from "@/components/ui/icons";
import { toast } from "@/components/ui/sonner";
import { ChannelLogo } from "@/platform/branding/ChannelLogo";
import { apiFetch, bootstrapCurrentOrganization } from "@/lib/api";
import { getChannelRecommendations } from "../../state/channel-recommendations";
import { selectedChannelsFromStrategy, type ChannelKey, type StrategyResponse } from "../../state/strategy-model";
import { beginOnboardingNavigation, navigateOnboarding, onboardingHref, restoreOnboardingNavigation } from "../../public/navigation";
import { useCampaignPillDraft } from "../../state/campaign-context";
import { ChannelList } from "../ChannelList";
import styles from "../continuation/Continuation.module.css";

const CHANNELS: Array<{ id: ChannelKey; label: string; description: string }> = [
  { id: "linkedin", label: "LinkedIn", description: "Reach decision-makers where they already network." },
  { id: "gmail", label: "Gmail", description: "Follow up with relevant, personal messages through Gmail." },
  { id: "outlook", label: "Outlook", description: "Follow up with relevant, personal messages through Outlook." },
  { id: "whatsapp", label: "WhatsApp", description: "Add direct follow-up when your audience opts in." },
  { id: "instagram", label: "Instagram", description: "Continue conversations through Instagram." },
  { id: "facebook", label: "Facebook", description: "Reach prospects through Messenger." },
];

export default function ChannelSelection() {
  const [selected, setSelected] = useState<ChannelKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const orgId = useRef<string | null>(null);
  const { setDraft } = useCampaignPillDraft();
  const applySelection = useCallback((next: ChannelKey[]) => {
    setSelected(next);
    setDraft({
      sectionId: "channels",
      summary: next.map((id) => CHANNELS.find((item) => item.id === id)?.label ?? id).join(" · ") || "No channels selected",
    });
  }, [setDraft]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const organization = await bootstrapCurrentOrganization();
        orgId.current = organization.orgId;
        const saved = await apiFetch<StrategyResponse>(`/strategy/${organization.orgId}`);
        if (cancelled) return;
        const persisted = selectedChannelsFromStrategy(saved);
        const recommendations = getChannelRecommendations(saved.channels).slice(0, 2).map((item) => item.channel);
        applySelection(persisted.length ? persisted : recommendations.length ? recommendations.map((channel) => channel === "email" ? "gmail" : channel) : ["linkedin", "gmail"]);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load campaign channels.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [applySelection]);

  useEffect(() => {
    const reminderId = "onboarding-channel-connection-reminder";
    const desktop = window.matchMedia("(min-width: 63.0625rem)");
    const dismissOnMobile = () => { if (!desktop.matches) toast.dismiss(reminderId); };
    desktop.addEventListener("change", dismissOnMobile);
    const timer = window.setTimeout(() => {
      if (!desktop.matches) return;
      toast.info("You will connect your accounts after checkout.", {
        id: reminderId,
        duration: 5_000,
      });
    }, 1_000);
    return () => {
      window.clearTimeout(timer);
      desktop.removeEventListener("change", dismissOnMobile);
      toast.dismiss(reminderId);
    };
  }, []);

  async function continueToCheckout() {
    if (!selected.length || saving) return;
    if (!beginOnboardingNavigation(onboardingHref("checkout"))) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/strategy/${orgId.current ?? "onboarding-preview-org"}/channels`, { method: "PATCH", body: JSON.stringify({ channels: selected }) });
      navigateOnboarding(onboardingHref("checkout"));
    } catch (cause) {
      restoreOnboardingNavigation();
      setError(cause instanceof Error ? cause.message : "Unable to save campaign channels.");
    } finally {
      setSaving(false);
    }
  }

  function toggleChannel(channelId: ChannelKey) {
    const next = selected.includes(channelId)
      ? selected.filter((item) => item !== channelId)
      : [...selected, channelId];
    applySelection(next);
  }

  return (
    <section className={styles.page} aria-labelledby="channel-selection-title">
      <main className={`continuation-main ${styles.main}`}>
        <header className={styles.heading}>
          <h1 id="channel-selection-title">Choose your channels<span className="signup-campaign-period">.</span></h1>
          <p>Choose where your outreach happens.</p>
        </header>
        <div className="onboarding-scene-task-scroll" role="region" aria-label="Channel selection content" tabIndex={0}>
        <ChannelList busy={loading} footer={<span>{selected.length} channels selected</span>} rows={CHANNELS.map((channel) => ({
          id: channel.id, name: channel.label, description: channel.description,
          icon: <ChannelLogo name={channel.id === "whatsapp" ? "whatsapp-mark" : channel.id === "email" ? "gmail" : channel.id} />,
          selection: {
            checked: selected.includes(channel.id),
            disabled: loading || saving,
            onChange: () => toggleChannel(channel.id),
          },
        }))} />
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </div>
      </main>
      <div className="onboarding-campaign-action-row">
        <Button type="button" variant="secondary" className="campaign-content-back" onClick={() => navigateOnboarding(onboardingHref("cta"))}><ArrowLeft aria-hidden />Back</Button>
        <Button type="button" className="onboarding-campaign-next" disabled={loading || saving || selected.length === 0} onClick={() => void continueToCheckout()}>{saving ? "Saving..." : "Continue to checkout"}<ArrowRight aria-hidden /></Button>
      </div>
    </section>
  );
}
