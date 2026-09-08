"use client";

import type { StrategySubstepParam } from "../../public/navigation";
import { useStrategyScene } from "../../hooks/useStrategyScene";
import { ShellActions } from "../strategy/Chrome";
import { TargetingScreen } from "../strategy/Targeting";
import { ChannelsScreen } from "../strategy/Channels";

export default function Strategy({
  substep = "how-it-works",
}: {
  substep?: StrategySubstepParam;
}) {
  const { analysis, strategyBrief, isLoadingStrategy, strategyError, strategyErrorInProgress, handleRetry, recommendations, selectedChannels, setSelectedChannels, channelSaveError, canContinue, isSavingChannels, handleBack, handleContinue } = useStrategyScene(substep);

  let activeSubstepContent: React.ReactNode;
  if (substep === "targeting") {
    activeSubstepContent = (
      <TargetingScreen
        analysis={analysis}
        strategyBrief={strategyBrief}
        isLoading={isLoadingStrategy}
        error={strategyError}
        errorInProgress={strategyErrorInProgress}
        onRetry={handleRetry}
      />
    );
  } else {
    activeSubstepContent = (
      <ChannelsScreen
        recommendations={recommendations}
        selectedChannels={selectedChannels}
        onToggle={(channel) => {
          if (channel === "linkedin") return;
          setSelectedChannels((current) => current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]);
        }}
        isLoading={isLoadingStrategy}
        error={strategyError ?? channelSaveError}
      />
    );
  }

  return (
    <div className="onboarding-page relative flex min-h-dvh w-full flex-col">

      <div className="flex min-h-0 flex-1 flex-col">
        {activeSubstepContent}
      </div>

      <ShellActions
        className={substep === "channels" ? "strategy-channels-actions" : undefined}
        canContinue={canContinue}
        continueLabel={substep === "channels" ? (isSavingChannels ? "Saving channels..." : `Continue with ${selectedChannels.length} ${selectedChannels.length === 1 ? "channel" : "channels"}`) : "Continue to next step"}
        onBack={handleBack}
        onContinue={() => void handleContinue()}
      />
    </div>
  );
}
