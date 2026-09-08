"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { applyStoredTheme } from "@/hooks/useThemeMode";
import { ApiError, apiFetch, bootstrapCurrentOrganization } from "@/lib/api";
import { getChannelRecommendations } from "../state/channel-recommendations";
import { getAudienceAnalysis, getStrategyBrief, selectedChannelsFromStrategy, isStaleAudienceRun, strategyErrorMessage, type ChannelKey, type StrategyResponse } from "../state/strategy-model";
import { onboardingHref, navigateOnboarding, strategyHref, type StrategySubstepParam } from "../public/navigation";

export function useStrategyScene(substep: StrategySubstepParam) {
  useLayoutEffect(() => {
    applyStoredTheme();
  }, []);

  const [strategy, setStrategy] = useState<StrategyResponse | null>(null);
  const [isLoadingStrategy, setIsLoadingStrategy] = useState(
    substep === "targeting" || substep === "channels",
  );
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const [strategyErrorInProgress, setStrategyErrorInProgress] = useState(false);
  const [selectedChannels, setSelectedChannels] = useState<ChannelKey[]>([]);
  const [isSavingChannels, setIsSavingChannels] = useState(false);
  const [channelSaveError, setChannelSaveError] = useState<string | null>(null);
  const channelsInitializedRef = useRef(false);
  const strategyRunRef = useRef<AbortController | null>(null);
  const strategyWarmupRef = useRef<AbortController | null>(null);

  const analysis = useMemo(() => getAudienceAnalysis(strategy), [strategy]);
  const strategyBrief = useMemo(() => getStrategyBrief(strategy), [strategy]);
  const recommendations = useMemo(() => getChannelRecommendations(strategy?.channels), [strategy]);

  useEffect(() => {
    if (substep !== "channels" || channelsInitializedRef.current || !strategy) return;
    const persisted = selectedChannelsFromStrategy(strategy);
    const defaults = persisted.length > 0
      ? persisted
      : recommendations.slice(0, 2).map((item) => item.channel);
    setSelectedChannels([...new Set<ChannelKey>(["linkedin", ...defaults])]);
    channelsInitializedRef.current = true;
  }, [recommendations, strategy, substep]);

  const pollForStrategy = useCallback(async (orgId: string, signal: AbortSignal) => {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      await new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, 2000);
        signal.addEventListener("abort", () => {
          window.clearTimeout(timer);
          resolve();
        }, { once: true });
      });
      if (signal.aborted) return null;
      const current = await apiFetch<StrategyResponse>(`/strategy/${orgId}`, { signal });
      if (signal.aborted) return null;
      setStrategy(current);
      const currentAnalysis = getAudienceAnalysis(current);
      if (currentAnalysis?.status === "completed") return current;
      if (currentAnalysis?.status === "failed") {
        throw new Error(currentAnalysis.error ?? "Audience analysis failed.");
      }
    }

    throw new Error(
      "Audience analysis is taking longer than expected. You can safely retry it.",
    );
  }, []);

  const loadStrategy = useCallback(async (
    forceGenerate: boolean,
    allowGenerate = true,
    signal: AbortSignal,
  ) => {
    setIsLoadingStrategy(true);
    setStrategyError(null);
    setStrategyErrorInProgress(false);
    try {
      const { orgId } = await bootstrapCurrentOrganization();
      if (signal.aborted) return;
      let current: StrategyResponse | null = null;

      if (!forceGenerate) {
        try {
          current = await apiFetch<StrategyResponse>(`/strategy/${orgId}`, { signal });
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 404) {
            throw error;
          }
        }
      }

      const currentAnalysis = getAudienceAnalysis(current);
      if (currentAnalysis?.status === "completed") {
        setStrategy(current);
        return;
      }
      if (currentAnalysis?.status === "running" && !isStaleAudienceRun(currentAnalysis)) {
        await pollForStrategy(orgId, signal);
        return;
      }
      // A persisted failure belongs to the previous attempt. Entering the
      // targeting step starts a clean run instead of flashing stale failure UI.
      if (!allowGenerate && !forceGenerate) {
        setStrategy(current);
        setStrategyError("No completed audience analysis is available yet.");
        return;
      }

      const generated = await apiFetch<StrategyResponse>("/strategy/generate", {
        method: "POST",
        signal,
        body: JSON.stringify(forceGenerate ? { force: true } : {}),
      });
      if (signal.aborted) return;
      const generatedAnalysis = getAudienceAnalysis(generated);
      setStrategy(generated);
      if (generatedAnalysis?.status === "running") {
        await pollForStrategy(orgId, signal);
        return;
      }
      if (generatedAnalysis?.status === "failed") {
        setStrategyError(strategyErrorMessage(generatedAnalysis.error));
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setStrategyErrorInProgress(true);
        try {
          const { orgId } = await bootstrapCurrentOrganization();
          if (signal.aborted) return;
          await pollForStrategy(orgId, signal);
          setStrategyErrorInProgress(false);
          return;
        } catch (pollError) {
          if (signal.aborted) return;
          setStrategyError(strategyErrorMessage(pollError));
          return;
        }
      }
      if (signal.aborted) return;
      setStrategyError(strategyErrorMessage(error));
    } finally {
      if (!signal.aborted) setIsLoadingStrategy(false);
    }
  }, [pollForStrategy]);

  const startStrategyRun = useCallback((forceGenerate: boolean, allowGenerate = true) => {
    strategyRunRef.current?.abort();
    const controller = new AbortController();
    strategyRunRef.current = controller;
    void loadStrategy(forceGenerate, allowGenerate, controller.signal);
  }, [loadStrategy]);

  const warmStrategy = useCallback(async (signal: AbortSignal) => {
    try {
      const { orgId } = await bootstrapCurrentOrganization();
      if (signal.aborted) return;
      const current = await apiFetch<StrategyResponse>(`/strategy/${orgId}`, { signal });
      if (signal.aborted) return;
      setStrategy(current);

      const currentAnalysis = getAudienceAnalysis(current);
      if (
        currentAnalysis?.status === "completed" ||
        (currentAnalysis?.status === "running" && !isStaleAudienceRun(currentAnalysis)) ||
        currentAnalysis?.status === "failed"
      ) {
        return;
      }

      const generated = await apiFetch<StrategyResponse>("/strategy/generate", {
        method: "POST",
        signal,
        body: JSON.stringify({}),
      });
      if (!signal.aborted) setStrategy(generated);
    } catch (error) {
      // Discovery can be incomplete on a direct URL. The targeting screen
      // owns customer-facing failures; this pre-warm must stay invisible.
      if (signal.aborted || (error instanceof ApiError && (error.status === 404 || error.status === 409))) {
        return;
      }
      console.warn("Unable to pre-warm strategy generation", error);
    }
  }, []);

  useEffect(() => {
    if (substep !== "how-it-works") return;

    const controller = new AbortController();
    strategyWarmupRef.current?.abort();
    strategyWarmupRef.current = controller;
    void warmStrategy(controller.signal);

    return () => {
      controller.abort();
      if (strategyWarmupRef.current === controller) {
        strategyWarmupRef.current = null;
      }
    };
  }, [substep, warmStrategy]);

  useEffect(() => {
    if (substep !== "targeting" && substep !== "channels") {
      return;
    }

    const controller = new AbortController();
    strategyRunRef.current?.abort();
    strategyRunRef.current = controller;
    void loadStrategy(false, substep === "targeting", controller.signal);

    return () => {
      controller.abort();
      if (strategyRunRef.current === controller) {
        strategyRunRef.current = null;
      }
    };
  }, [loadStrategy, substep]);

  function handleBack() {
    if (substep === "how-it-works") {
      navigateOnboarding(onboardingHref("discovery"));
      return;
    }
    if (substep === "targeting") {
      navigateOnboarding(onboardingHref("campaign-content"));
      return;
    }
    navigateOnboarding(strategyHref("targeting"));
  }

  async function handleContinue() {
    if (substep === "how-it-works") {
      navigateOnboarding(onboardingHref("campaign-content"));
      return;
    }
    if (substep === "targeting") {
      navigateOnboarding(strategyHref("channels"));
      return;
    }
    if (!strategy || selectedChannels.length === 0 || isSavingChannels) return;
    setIsSavingChannels(true);
    setChannelSaveError(null);
    try {
      const updated = await apiFetch<StrategyResponse>(`/strategy/${strategy.orgId}/channels`, {
        method: "PATCH",
        body: JSON.stringify({ channels: selectedChannels }),
      });
      setStrategy(updated);
      navigateOnboarding(onboardingHref("campaign-content"));
    } catch (saveError) {
      setChannelSaveError(strategyErrorMessage(saveError));
    } finally {
      setIsSavingChannels(false);
    }
  }

  function handleRetry() {
    startStrategyRun(true);
  }

  const canContinue =
    substep === "how-it-works" ||
    (substep === "channels" && selectedChannels.length > 0 && !strategyError && !isSavingChannels) ||
    Boolean(analysis?.status === "completed" && recommendations.length > 0);

  return { analysis, strategyBrief, isLoadingStrategy, strategyError, strategyErrorInProgress, handleRetry, recommendations, selectedChannels, setSelectedChannels, channelSaveError, canContinue, isSavingChannels, handleBack, handleContinue };
}
