"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUp,
  Briefcase,
  Building2,
  ChevronRight,
  Compass,
  Lock,
  LogOut,
  Moon,
  Sparkles,
  Sun,
  Check,
  TrendingUp,
  User,
  Globe,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { QUESTIONS, DISCOVERY_INTRO_HOLD_MS, DISCOVERY_INTRO_TRANSITION_MS, useDiscovery, WEBSITE_COMPLETE_MESSAGE, type DiscoverySummary, type WebsiteAnalysisPhase } from "@/hooks/useDiscovery";
import { applyStoredTheme, useThemeMode } from "@/hooks/useThemeMode";
import { useCampaignReveal, getCampaignFieldText, type CampaignFieldKey } from "@/hooks/useCampaignReveal";
import { useAnimatedHeight, useTypewriterText } from "@/hooks/useTypewriterText";
import { getWebsiteFaviconUrl, parseWebsiteLink, type WebsiteLinkInfo } from "@/lib/discovery-website";
import { ASSETS, BRAND_COLORS } from "@/lib/constants/brand";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const SUMMARY_ITEMS = [
  {
    key: "businessModel" as const,
    title: "Business model",
    icon: Briefcase,
  },
  {
    key: "industry" as const,
    title: "Industry",
    icon: Building2,
  },
  {
    key: "strengths" as const,
    title: "Strengths",
    icon: TrendingUp,
  },
  {
    key: "idealCustomer" as const,
    title: "Ideal customer",
    icon: User,
  },
  {
    key: "nextStep" as const,
    title: "Next step",
    icon: Compass,
  },
] as const;

type SummaryFieldKey = (typeof SUMMARY_ITEMS)[number]["key"];

const DISCOVERY_SIDEBAR_STEPS = [
  { id: "industry", label: "Industry identified" },
  { id: "positioning", label: "Market positioning identified" },
  { id: "icp", label: "Building ideal customer profile" },
  { id: "channels", label: "Determining best channels" },
  { id: "strategy", label: "Generating campaign strategy" },
] as const;

type DiscoverySidebarStepState = "completed" | "active" | "pending";

function getDiscoverySidebarStepState(
  stepIndex: number,
  currentQuestionIndex: number,
  isComplete: boolean,
): DiscoverySidebarStepState {
  if (isComplete || stepIndex < currentQuestionIndex) {
    return "completed";
  }

  if (stepIndex === currentQuestionIndex) {
    return "active";
  }

  return "pending";
}

function getDiscoverySidebarConnectorState(
  stepIndex: number,
  currentQuestionIndex: number,
  isComplete: boolean,
): DiscoverySidebarStepState {
  if (isComplete || stepIndex < currentQuestionIndex) {
    return "completed";
  }

  if (stepIndex === currentQuestionIndex) {
    return "active";
  }

  return "pending";
}

function DiscoverySidebarStepIcon({ state }: { state: DiscoverySidebarStepState }) {
  if (state === "completed") {
    return (
      <span className="discovery-sidebar__step-icon discovery-sidebar__step-icon--completed inline-flex size-5.5 items-center justify-center rounded-full">
        <Check className="size-3 stroke-[2.5]" aria-hidden />
      </span>
    );
  }

  if (state === "active") {
    return (
      <span className="discovery-sidebar__step-icon discovery-sidebar__step-icon--active inline-flex size-5.5 items-center justify-center rounded-full">
        <span className="discovery-sidebar__step-icon-dot size-2 rounded-full" aria-hidden />
      </span>
    );
  }

  return (
    <span
      className="discovery-sidebar__step-icon discovery-sidebar__step-icon--pending inline-flex size-5.5 rounded-full"
      aria-hidden
    />
  );
}

function DiscoveryEtaCard({
  currentQuestionIndex,
  isComplete,
  showsQuestionProgress,
  chromeClassName,
  style,
}: {
  currentQuestionIndex: number;
  isComplete: boolean;
  showsQuestionProgress: boolean;
  chromeClassName: string;
  style?: CSSProperties;
}) {
  const estimatedMinutes = isComplete
    ? 0
    : Math.max(1, QUESTIONS.length - currentQuestionIndex - 1);

  return (
    <div
      className={`discovery-sidebar__eta fixed left-6 z-30 hidden items-center gap-3 rounded-2xl px-3.5 py-3 lg:flex ${
        showsQuestionProgress ? "discovery-sidebar__eta--with-progress" : ""
      } ${chromeClassName}`}
      style={style}
      aria-live="polite"
    >
      <span className="discovery-sidebar__eta-icon inline-flex size-9 shrink-0 items-center justify-center rounded-xl">
        <Sparkles className="size-4 text-[#5326b7]" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="discovery-sidebar__eta-label text-xs text-neutral-500">
          Estimated time remaining
        </p>
        <p className="discovery-sidebar__eta-value text-sm font-bold text-neutral-900">
          {estimatedMinutes === 0 ? "Ready" : `${estimatedMinutes} min`}
        </p>
      </div>
    </div>
  );
}

function DiscoveryProgressSidebar({
  currentQuestionIndex,
  isComplete,
  chromeClassName,
  style,
}: {
  currentQuestionIndex: number;
  isComplete: boolean;
  chromeClassName: string;
  style?: CSSProperties;
}) {
  return (
    <aside
      className={`discovery-sidebar fixed top-22 bottom-28 left-6 z-30 hidden w-[min(280px,26vw)] flex-col lg:flex ${chromeClassName}`}
      style={style}
      aria-label="Outreach blueprint progress"
    >
      <div className="discovery-sidebar__header shrink-0">
        <h2 className="discovery-sidebar__headline text-[1.75rem] leading-[1.12] font-bold tracking-tight text-neutral-900 xl:text-[2rem]">
          Lead generation,{" "}
          <span className="discovery-sidebar__headline-accent">
            reimagined.
          </span>
        </h2>
        <p className="discovery-sidebar__subtitle mt-2 text-sm leading-relaxed text-neutral-500">
          We&apos;re building your outreach blueprint in real time.
        </p>
      </div>

      <div className="discovery-sidebar__steps-wrap flex min-h-0 flex-1 items-center justify-center">
        <ol className="discovery-sidebar__steps">
          {DISCOVERY_SIDEBAR_STEPS.map((step, index) => {
            const state = getDiscoverySidebarStepState(
              index,
              currentQuestionIndex,
              isComplete,
            );
            const connectorState = getDiscoverySidebarConnectorState(
              index,
              currentQuestionIndex,
              isComplete,
            );
            const isLast = index === DISCOVERY_SIDEBAR_STEPS.length - 1;

            return (
              <li key={step.id} className="discovery-sidebar__step">
                <div className="discovery-sidebar__step-track">
                  <DiscoverySidebarStepIcon state={state} />
                  {!isLast ? (
                    <span
                      className={cn(
                        "discovery-sidebar__connector",
                        connectorState === "completed" &&
                          "discovery-sidebar__connector--completed",
                        connectorState === "active" &&
                          "discovery-sidebar__connector--active",
                        connectorState === "pending" &&
                          "discovery-sidebar__connector--pending",
                      )}
                      aria-hidden
                    />
                  ) : null}
                </div>
                <p
                  className={cn(
                    "discovery-sidebar__step-label",
                    state === "active" && "discovery-sidebar__step-label--active",
                    state === "completed" &&
                      "discovery-sidebar__step-label--completed",
                    state === "pending" && "discovery-sidebar__step-label--pending",
                  )}
                >
                  {step.label}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}

type IntroPhase = "visible" | "exiting" | "done";

function WebsiteLinkChip({
  href,
  label,
  hostname,
}: {
  href: string;
  label: string;
  hostname: string;
}) {
  const [iconError, setIconError] = useState(false);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="discovery-website-link inline-flex max-w-full items-center gap-2.5 rounded-2xl border border-[#5326b7]/18 bg-white px-3.5 py-2.5 shadow-[0_2px_12px_rgba(83,38,183,0.08)] transition-colors hover:border-[#5326b7]/30 hover:bg-[#faf8ff]"
    >
      <span className="inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#f4f4f4]">
        {!iconError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={getWebsiteFaviconUrl(hostname)}
            alt=""
            width={20}
            height={20}
            className="size-5 object-contain"
            onError={() => setIconError(true)}
          />
        ) : (
          <Globe
            className="size-4 text-neutral-500"
            aria-hidden
          />
        )}
      </span>
      <span className="truncate text-[15px] font-medium text-[#5326b7]">
        {label}
      </span>
    </a>
  );
}

function DiscoveryLogo({ className = "h-6 w-auto" }: { className?: string }) {
  const { isDark } = useThemeMode();
  const transitionClass = "transition-opacity duration-200 ease-in-out";

  return (
    <span className="discovery-logo relative inline-block shrink-0 leading-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ASSETS.logoColored}
        alt={isDark ? undefined : "leadreacher"}
        aria-hidden={isDark}
        className={cn(className, transitionClass, isDark ? "opacity-0" : "opacity-100")}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ASSETS.logoWhite}
        alt={isDark ? "leadreacher" : undefined}
        aria-hidden={!isDark}
        className={cn(
          className,
          "absolute top-0 left-0",
          transitionClass,
          isDark ? "opacity-100" : "opacity-0",
        )}
      />
    </span>
  );
}

function UserMessage({
  content,
  timestamp,
  userInitials,
}: {
  content: string;
  timestamp: Date;
  userInitials: string;
}) {
  const website = useMemo(() => parseWebsiteLink(content), [content]);
  const isWebsiteOnly =
    website !== null &&
    (content.trim() === website.label ||
      content.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "") ===
        website.label);

  return (
    <div className="flex w-full justify-end">
      <div className="flex w-full max-w-[85%] flex-col items-end">
        <div className="mb-2 flex items-center gap-2">
          <time
            dateTime={timestamp.toISOString()}
            className="discovery-meta-time text-xs text-neutral-400"
          >
            {formatMessageTime(timestamp)}
          </time>
          <UserAvatar initials={userInitials} />
        </div>
        {isWebsiteOnly && website ? (
          <WebsiteLinkChip {...website} />
        ) : (
          <div className="discovery-message-bubble discovery-message-bubble--user w-full">
            <p className="discovery-user-text text-[15px] leading-7 text-neutral-900">{content}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatMessageTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function AssistantAvatar() {
  return (
    <span
      className="discovery-assistant-avatar inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f3effa] shadow-sm ring-1 ring-[#5326b7]/10"
      aria-hidden
    >
      <span className="discovery-assistant-avatar__plane size-9 shrink-0" />
    </span>
  );
}

function UserAvatar({ initials }: { initials: string }) {
  return (
    <span
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm"
      style={{ backgroundColor: BRAND_COLORS.purple }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

function MessageMeta({
  name,
  timestamp,
  align,
}: {
  name: string;
  timestamp: Date;
  align: "left" | "right";
}) {
  return (
    <div
      className={`mb-2 flex items-center gap-2 ${
        align === "right" ? "flex-row-reverse" : ""
      }`}
    >
      <span
        className={`text-sm font-semibold ${
          align === "left" ? "discovery-ai-label" : "sr-only"
        }`}
      >
        {name}
      </span>
      <time
        dateTime={timestamp.toISOString()}
        className="discovery-meta-time text-xs text-neutral-400"
      >
        {formatMessageTime(timestamp)}
      </time>
      {align === "right" ? (
        <span className="sr-only">{name}</span>
      ) : null}
    </div>
  );
}

function DiscoveryIntroSplash({ phase }: { phase: IntroPhase }) {
  if (phase === "done") {
    return null;
  }

  return (
    <div
      className={`discovery-intro ${
        phase === "exiting" ? "discovery-intro--exiting" : "discovery-intro--visible"
      }`}
      style={
        {
          "--discovery-intro-transition": `${DISCOVERY_INTRO_TRANSITION_MS}ms`,
        } as CSSProperties
      }
      aria-hidden={phase === "exiting"}
    >
      <div className="mx-auto max-w-3xl px-5 text-center">
        <h1 className="discovery-intro__headline text-balance text-4xl font-bold leading-[1.12] tracking-tight text-neutral-950 sm:text-5xl sm:leading-[1.1] md:text-[3.25rem]">
          Let&apos;s build your{" "}
          <span className="discovery-intro-gradient">outreach engine.</span>
        </h1>
        <p className="discovery-intro__subhead mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-neutral-500 sm:mt-6 sm:text-lg sm:leading-relaxed">
          Chat with our AI to understand your business so we can create a
          personalized strategy that works.
        </p>
      </div>
    </div>
  );
}

function hasSummaryContent(
  summary: DiscoverySummary,
  key: SummaryFieldKey,
): boolean {
  return summary[key].trim().length > 0;
}

function countPopulatedSummaryFields(summary: DiscoverySummary): number {
  return SUMMARY_ITEMS.filter((item) => hasSummaryContent(summary, item.key))
    .length;
}

function CampaignCardSkeleton({ exiting = false }: { exiting?: boolean }) {
  return (
    <div
      className={`discovery-campaign-skeleton ${
        exiting ? "discovery-campaign-skeleton--exit" : ""
      }`}
      aria-hidden
    >
      <div className="discovery-campaign-skeleton__line" />
    </div>
  );
}

function CampaignAnimatedBody({
  phase,
  watchKey,
  children,
}: {
  phase: "skeleton" | "revealing" | "done";
  watchKey?: unknown;
  children: ReactNode;
}) {
  const { innerRef, height } = useAnimatedHeight<HTMLDivElement>(watchKey);

  return (
    <div
      className="discovery-campaign-card__expand overflow-hidden"
      style={{
        height: height > 0 ? `${height}px` : undefined,
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

function DiscoveryCampaignTextField({
  targetText,
  speedMs,
  phase,
  textVariant,
  onComplete,
}: {
  targetText: string;
  speedMs: number;
  phase: "skeleton" | "revealing" | "done";
  textVariant: "default" | "idealCustomer" | "nextStep";
  onComplete: () => void;
}) {
  const isDone = phase === "done";
  const isRevealing = phase === "revealing";
  const [contentVisible, setContentVisible] = useState(isDone);

  useEffect(() => {
    if (isDone) {
      setContentVisible(true);
      return;
    }

    if (!isRevealing) {
      setContentVisible(false);
      return;
    }

    const timer = window.setTimeout(() => setContentVisible(true), 280);
    return () => window.clearTimeout(timer);
  }, [isDone, isRevealing]);

  const { text } = useTypewriterText(targetText, speedMs, {
    enabled: isRevealing && contentVisible,
    showImmediately: isDone,
    onComplete,
  });

  return (
    <CampaignAnimatedBody phase={phase} watchKey={`${phase}-${text}`}>
      {phase === "skeleton" || (isRevealing && !contentVisible) ? (
        <CampaignCardSkeleton exiting={isRevealing} />
      ) : (
        <p
          className={`discovery-campaign-card__value discovery-campaign-value apple-glass-panel__value text-neutral-700 ${
            textVariant === "nextStep"
              ? "text-[11px] leading-4"
              : "text-xs leading-relaxed"
          }`}
        >
          {text || "\u00a0"}
        </p>
      )}
    </CampaignAnimatedBody>
  );
}

function DiscoveryCampaignCard({
  item,
  summary,
  phase,
  onComplete,
  websiteEnriched,
}: {
  item: (typeof SUMMARY_ITEMS)[number];
  summary: DiscoverySummary;
  phase: "skeleton" | "revealing" | "done";
  onComplete: () => void;
  websiteEnriched: boolean;
}) {
  const Icon = item.icon;
  const showAnalyzedBadge =
    item.key === "nextStep" &&
    websiteEnriched &&
    (phase === "revealing" || phase === "done");
  const showAnalyzingLabel = phase === "skeleton";

  return (
    <div className="discovery-campaign-card apple-glass-panel__row flex items-start gap-3 border-b border-white/20 px-4 py-3.5 last:border-b-0">
      <span className="apple-glass-panel__chip inline-flex size-8 shrink-0 items-center justify-center rounded-xl">
        <Icon
          className="discovery-campaign-card__icon size-4"
          aria-hidden
        />
      </span>
      <div className="min-w-0 flex-1">
        <p className="discovery-campaign-title flex items-center gap-2 text-sm font-semibold tracking-tight text-neutral-900">
          <span>{item.title}</span>
          {showAnalyzedBadge ? (
            <span className="text-[10px] font-medium text-emerald-600">
              Analyzed ✓
            </span>
          ) : null}
        </p>
        {showAnalyzingLabel ? (
          <p className="discovery-campaign-status discovery-campaign-card__status mt-0.5 text-[11px] font-medium text-neutral-400">
            Analyzing...
          </p>
        ) : null}
        <div className={showAnalyzingLabel ? "mt-2" : "mt-1.5"}>
          <DiscoveryCampaignTextField
            targetText={getCampaignFieldText(summary, item.key)}
            speedMs={item.key === "nextStep" ? 45 : 30}
            phase={phase}
            textVariant={
              item.key === "nextStep"
                ? "nextStep"
                : item.key === "idealCustomer"
                  ? "idealCustomer"
                  : "default"
            }
            onComplete={onComplete}
          />
        </div>
      </div>
    </div>
  );
}

function DiscoveryCampaignSummaryRows({
  summary,
}: {
  summary: DiscoverySummary;
}) {
  const { getPhase, completeField, websiteEnriched } = useCampaignReveal(summary);

  return (
    <div className="discovery-campaign-panel__rows">
      {SUMMARY_ITEMS.map((item) => (
        <DiscoveryCampaignCard
          key={item.key}
          item={item}
          summary={summary}
          phase={getPhase(item.key as CampaignFieldKey)}
          onComplete={() => completeField(item.key as CampaignFieldKey)}
          websiteEnriched={websiteEnriched}
        />
      ))}
    </div>
  );
}

function capitalizeFirstWord(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function hintToBullets(hint: string): string[] {
  return hint
    .split(",")
    .map((part) => capitalizeFirstWord(part.trim().replace(/\.$/, "")))
    .filter((part) => part.length > 0);
}

function AssistantMessage({
  content,
  hint,
  messageKey,
  timestamp,
  animate = true,
  isCompletion = false,
}: {
  content: string;
  hint?: string;
  messageKey: string;
  timestamp: Date;
  animate?: boolean;
  isCompletion?: boolean;
}) {
  const bullets = useMemo(() => (hint ? hintToBullets(hint) : []), [hint]);
  const [titleVisible, setTitleVisible] = useState(!animate || isCompletion);
  const [visibleBulletCount, setVisibleBulletCount] = useState(
    animate && !isCompletion ? 0 : bullets.length,
  );

  useEffect(() => {
    if (!animate || isCompletion) {
      setTitleVisible(true);
      setVisibleBulletCount(bullets.length);
      return;
    }

    setTitleVisible(false);
    setVisibleBulletCount(0);

    const titleTimer = window.setTimeout(() => setTitleVisible(true), 180);
    const bulletTimers = bullets.map((_, index) =>
      window.setTimeout(() => setVisibleBulletCount(index + 1), 520 + index * 420),
    );

    return () => {
      window.clearTimeout(titleTimer);
      bulletTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [animate, isCompletion, messageKey, bullets.length]);

  return (
    <div className="flex w-full items-start gap-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1">
        <MessageMeta
          name="Leadreacher AI"
          timestamp={timestamp}
          align="left"
        />
        <div className="discovery-message-bubble discovery-message-bubble--assistant">
          <p
            className={
              isCompletion
                ? "discovery-assistant-completion discovery-completion-message-in text-[15px] leading-7 font-medium text-neutral-700"
                : `discovery-assistant-title text-[15px] leading-7 font-semibold text-neutral-900 transition-opacity duration-300 ${
                    titleVisible ? "opacity-100" : "opacity-0"
                  }`
            }
          >
            {content}
          </p>
          {bullets.length > 0 ? (
            <ul className="mt-2.5 space-y-2">
              {bullets.slice(0, visibleBulletCount).map((bullet, bulletIndex) => (
                <li
                  key={`${bulletIndex}-${bullet}`}
                  className="discovery-assistant-bullet animate-discovery-summary-in flex gap-2.5 text-[15px] leading-7 text-neutral-500"
                >
                  <span
                    className="flex h-7 w-3 shrink-0 items-center justify-center"
                    aria-hidden
                  >
                    <span className="size-1.5 rounded-full bg-neutral-400" />
                  </span>
                  <span className="min-w-0">{bullet}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function WebsitePreviewThumbnail({
  website,
  previewImageUrl,
  isScanning,
}: {
  website: WebsiteLinkInfo;
  previewImageUrl: string | null;
  isScanning: boolean;
}) {
  const [imageError, setImageError] = useState(false);
  const usePreviewImage = Boolean(previewImageUrl) && !imageError;

  return (
    <div className="discovery-website-preview">
      <div
        className={`discovery-website-preview__frame ${
          isScanning ? "discovery-website-preview__frame--scanning" : ""
        }`}
      >
        {usePreviewImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewImageUrl!}
            alt=""
            className="discovery-website-preview__image"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="discovery-website-preview__fallback">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getWebsiteFaviconUrl(website.hostname)}
              alt=""
              className="discovery-website-preview__favicon"
            />
          </div>
        )}
        {isScanning ? (
          <span className="discovery-website-preview__scan" aria-hidden />
        ) : null}
      </div>
      <p className="discovery-website-preview__label">{website.label}</p>
    </div>
  );
}

function WebsiteAnalyzingMessage({
  phase,
  website,
  previewImageUrl,
}: {
  phase: WebsiteAnalysisPhase;
  website: WebsiteLinkInfo;
  previewImageUrl: string | null;
}) {
  const message =
    phase === "scanning"
      ? "Analyzing your website..."
      : "Analyzing and pulling information from your site...";

  return (
    <div className="flex w-full items-start gap-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1">
        <MessageMeta
          name="Leadreacher AI"
          timestamp={new Date()}
          align="left"
        />
        <div
          className="discovery-message-bubble discovery-message-bubble--assistant"
          aria-live="polite"
        >
          <WebsitePreviewThumbnail
            website={website}
            previewImageUrl={previewImageUrl}
            isScanning={phase === "scanning"}
          />
          <p className="discovery-analyze-text-shimmer mt-3 text-[15px] leading-7 italic">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex w-full items-start gap-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1">
        <MessageMeta
          name="Leadreacher AI"
          timestamp={new Date()}
          align="left"
        />
        <div
          className="discovery-message-bubble discovery-message-bubble--assistant inline-flex items-center gap-1.5 py-4"
          aria-label="Leadreacher AI is typing"
        >
          <span className="discovery-typing-dot size-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:0ms]" />
          <span className="discovery-typing-dot size-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:180ms]" />
          <span className="discovery-typing-dot size-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:360ms]" />
        </div>
      </div>
    </div>
  );
}

function DiscoveryThemeToggleButton() {
  const { isDark, toggle } = useThemeMode();

  return (
    <button
      type="button"
      onClick={(event) => toggle(event.currentTarget)}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="discovery-top-chrome__toggle inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-neutral-200/80 bg-white/85 text-neutral-600 shadow-sm backdrop-blur-md transition-colors hover:bg-white"
    >
      {isDark ? (
        <Sun className="size-4" aria-hidden />
      ) : (
        <Moon className="size-4" aria-hidden />
      )}
    </button>
  );
}

function DiscoveryAccountMenu({
  userInitials,
  menuPlacement,
}: {
  userInitials: string;
  menuPlacement: "push" | "overlay";
}) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      setMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setMenuOpen(false);
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  const userButton = (
    <button
      type="button"
      onClick={() => setMenuOpen((open) => !open)}
      aria-expanded={menuOpen}
      aria-haspopup="menu"
      aria-label="Account menu"
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white shadow-sm ring-2 transition-colors",
        menuOpen
          ? "ring-[#5326b7]/35 dark:ring-[#c4b5f0]/35"
          : "ring-transparent",
      )}
      style={{ backgroundColor: BRAND_COLORS.purple }}
    >
      {userInitials}
    </button>
  );

  const menuPanel = (
    <div
      role="menu"
      aria-label="Account"
      className={cn(
        "discovery-mobile-campaign-pill discovery-account-menu rounded-full px-3 py-2",
        menuOpen ? "discovery-account-menu--open" : "discovery-account-menu--closed",
      )}
    >
      <button
        type="button"
        role="menuitem"
        disabled={loggingOut}
        onClick={() => void handleLogout()}
        className="discovery-account-menu__item discovery-campaign-title flex w-full items-center gap-2.5 text-sm font-semibold text-neutral-900"
      >
        <LogOut className="size-4 shrink-0" aria-hidden />
        <span>{loggingOut ? "Logging out..." : "Log out"}</span>
      </button>
    </div>
  );

  if (menuPlacement === "overlay") {
    return (
      <div ref={menuRef} className="relative shrink-0">
        {userButton}
        <div
          className={cn(
            "absolute top-[calc(100%+0.5rem)] right-0 z-50 w-[min(220px,70vw)]",
            !menuOpen && "pointer-events-none",
          )}
        >
          {menuPanel}
        </div>
      </div>
    );
  }

  return (
    <div ref={menuRef} className="flex w-full flex-col items-end gap-3">
      <div className="discovery-top-chrome flex shrink-0 items-center gap-2 self-end">
        <DiscoveryThemeToggleButton />
        {userButton}
      </div>
      <div
        className={cn(
          "grid w-[min(220px,70vw)] transition-[grid-template-rows] duration-200 ease-out",
          menuOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">{menuPanel}</div>
      </div>
    </div>
  );
}

function DiscoveryRightRail({
  userInitials,
  summary,
  panelGlowActive,
  chromeClassName,
  style,
}: {
  userInitials: string;
  summary: DiscoverySummary;
  panelGlowActive: boolean;
  chromeClassName: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        "fixed top-5 right-6 z-40 hidden w-[min(320px,32vw)] flex-col items-end gap-3 lg:flex discovery-right-rail",
        chromeClassName,
      )}
      style={style}
    >
      <DiscoveryAccountMenu
        userInitials={userInitials}
        menuPlacement="push"
      />
      <DiscoveryCampaignPanel
        summary={summary}
        panelGlowActive={panelGlowActive}
      />
    </div>
  );
}

function DiscoveryMobileTopBar({
  chromeClassName,
  populatedCount,
  badgePulse,
  onCampaignPress,
  userInitials,
}: {
  chromeClassName: string;
  populatedCount: number;
  badgePulse: boolean;
  onCampaignPress: () => void;
  userInitials: string;
}) {
  return (
    <>
      <div
        className={`discovery-mobile-top-blur lg:hidden ${chromeClassName}`}
        aria-hidden
      />
      <header
        className={`fixed inset-x-0 top-0 z-40 bg-transparent px-4 py-3 lg:hidden ${chromeClassName}`}
      >
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2">
          <div className="min-w-0 flex-1">
            <DiscoveryMobileCampaignPill
              populatedCount={populatedCount}
              badgePulse={badgePulse}
              onOpen={onCampaignPress}
              className="w-full"
            />
          </div>
          <DiscoveryThemeToggleButton />
          <DiscoveryAccountMenu
            userInitials={userInitials}
            menuPlacement="overlay"
          />
        </div>
      </header>
    </>
  );
}

function DiscoveryMobileCampaignPill({
  populatedCount,
  badgePulse,
  onOpen,
  className = "",
}: {
  populatedCount: number;
  badgePulse: boolean;
  onOpen: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`discovery-mobile-campaign-pill flex items-center gap-2.5 rounded-full px-3 py-2 ${className}`}
      aria-label="Open your campaign"
    >
      <span
        className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
        style={{ backgroundColor: BRAND_COLORS.purple }}
      >
        <Sparkles className="size-4" aria-hidden />
        {populatedCount > 0 ? (
          <span
            className={`absolute -top-1 -right-1 inline-flex min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white/80 ${
              badgePulse ? "discovery-mobile-badge-pulse" : ""
            }`}
          >
            {populatedCount}
          </span>
        ) : null}
      </span>
      <span className="discovery-campaign-title min-w-0 flex-1 truncate text-left text-sm font-semibold text-neutral-900">
        Your Campaign
      </span>
      <ChevronRight className="discovery-meta-time size-4 shrink-0 text-neutral-400" aria-hidden />
    </button>
  );
}

const MOBILE_SHEET_ANIMATION_MS = 300;

function DiscoveryMobileCampaignSheet({
  isOpen,
  onClose,
  summary,
}: {
  isOpen: boolean;
  onClose: () => void;
  summary: DiscoverySummary;
}) {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      setIsExiting(false);
      return;
    }

    if (!isMounted) {
      return;
    }

    setIsExiting(true);
    const timer = window.setTimeout(() => {
      setIsMounted(false);
      setIsExiting(false);
    }, MOBILE_SHEET_ANIMATION_MS);

    return () => window.clearTimeout(timer);
  }, [isOpen, isMounted]);

  if (!isMounted) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
      <button
        type="button"
        className={`discovery-mobile-sheet-backdrop absolute inset-0 bg-black/40 ${
          isExiting ? "discovery-mobile-sheet-backdrop--exiting" : ""
        }`}
        aria-label="Close campaign panel"
        onClick={onClose}
      />
      <div
        className={`discovery-mobile-sheet absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[1.75rem] bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.12)] ${
          isExiting ? "discovery-mobile-sheet--exiting" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Your Campaign"
      >
        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <span className="discovery-mobile-sheet__handle h-1 w-10 rounded-full bg-neutral-200" aria-hidden />
        </div>

        <div className="discovery-mobile-sheet__header flex shrink-0 items-start gap-2.5 border-b border-neutral-100 px-5 pb-4">
          <span
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ backgroundColor: BRAND_COLORS.purple }}
          >
            <Sparkles className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="discovery-campaign-title text-sm font-bold leading-5 tracking-tight text-neutral-900">
              Your Campaign
            </p>
            <p className="discovery-campaign-subtitle text-xs leading-4 text-neutral-500">
              Built from the information you&apos;ve shared.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="discovery-mobile-sheet__close inline-flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <DiscoveryCampaignSummaryRows summary={summary} />
        </div>

        <div className="discovery-mobile-sheet__footer shrink-0 border-t border-neutral-100 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="discovery-footer-note flex items-center justify-center gap-1.5 text-xs text-neutral-400">
            <Lock className="size-3.5" aria-hidden />
            Your information is secure and private
          </p>
        </div>
      </div>
    </div>
  );
}

function DiscoveryCampaignPanel({
  summary,
  panelGlowActive,
}: {
  summary: DiscoverySummary;
  panelGlowActive: boolean;
}) {
  return (
    <div
      className={`apple-glass-panel w-[min(320px,32vw)] ${
        panelGlowActive ? "discovery-panel-glow" : ""
      }`}
      aria-live="polite"
    >
      <div className="flex items-start gap-2.5 border-b border-white/25 px-4 py-3.5">
        <span
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
          style={{ backgroundColor: BRAND_COLORS.purple }}
        >
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="discovery-campaign-title text-sm font-bold leading-5 tracking-tight text-neutral-900">
            Your Campaign
          </p>
          <p className="discovery-campaign-subtitle text-xs leading-4 text-neutral-500/90">
            Built from the information you&apos;ve shared.
          </p>
        </div>
      </div>

      <DiscoveryCampaignSummaryRows summary={summary} />
    </div>
  );
}

function DiscoveryQuestionProgress({
  currentQuestionIndex,
}: {
  currentQuestionIndex: number;
}) {
  const totalQuestions = QUESTIONS.length;
  const questionNumber = currentQuestionIndex + 1;
  const filledSegments = questionNumber;
  const progressPercent =
    Math.round(((questionNumber / totalQuestions) * 100) / 20) * 20;

  return (
    <div
      className="discovery-question-progress mb-3 flex items-center gap-3 sm:gap-4"
      aria-label={`Question ${questionNumber} of ${totalQuestions}, ${progressPercent}% complete`}
    >
      <p className="discovery-question-progress__label shrink-0 text-xs font-medium text-neutral-500 sm:text-sm">
        Question {questionNumber} of {totalQuestions}
      </p>

      <div
        className="discovery-question-progress__track flex min-w-0 flex-1 items-center gap-1.5"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {Array.from({ length: totalQuestions }, (_, index) => (
          <span
            key={index}
            className={cn(
              "discovery-question-progress__segment h-1.5 flex-1 rounded-full",
              index < filledSegments
                ? "discovery-question-progress__segment--filled"
                : "discovery-question-progress__segment--empty",
            )}
          />
        ))}
      </div>

      <p className="discovery-question-progress__percent shrink-0 text-xs font-semibold sm:text-sm">
        {progressPercent}%
      </p>
    </div>
  );
}

export default function DiscoveryClient({
  userInitials,
}: {
  userInitials: string;
}) {
  useLayoutEffect(() => {
    applyStoredTheme();
  }, []);

  const router = useRouter();
  const [introPhase, setIntroPhase] = useState<IntroPhase>("visible");
  const introComplete = introPhase === "done";
  const showChatUi = introPhase !== "visible";
  const [input, setInput] = useState("");
  const [isCompleting, setIsCompleting] = useState(false);
  const {
    messages,
    summary,
    isComplete,
    isTyping,
    isAnalyzingWebsite,
    websiteAnalysisPhase,
    analyzingWebsite,
    websitePreviewImageUrl,
    currentQuestionIndex,
    sendMessage,
    complete,
    skipAndComplete,
  } = useDiscovery({ introComplete });

  useEffect(() => {
    const exitTimer = window.setTimeout(() => {
      setIntroPhase("exiting");
    }, DISCOVERY_INTRO_HOLD_MS);

    const doneTimer = window.setTimeout(() => {
      setIntroPhase("done");
    }, DISCOVERY_INTRO_HOLD_MS + DISCOVERY_INTRO_TRANSITION_MS);

    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(doneTimer);
    };
  }, []);

  const isOnLastQuestion = currentQuestionIndex === QUESTIONS.length - 1;
  const showContinueBar = isComplete;
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);
  const [badgePulse, setBadgePulse] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevPopulatedCountRef = useRef(0);

  const prevWebsiteEnrichedRef = useRef(false);

  const populatedFieldCount = useMemo(
    () => countPopulatedSummaryFields(summary),
    [summary],
  );

  const chromeClassName = !showChatUi
    ? "discovery-chrome--hidden"
    : introComplete
      ? "discovery-chrome--ready"
      : "discovery-chrome--entering";

  const [panelGlowActive, setPanelGlowActive] = useState(false);

  useEffect(() => {
    if (populatedFieldCount <= prevPopulatedCountRef.current) {
      prevPopulatedCountRef.current = populatedFieldCount;
      return;
    }

    setBadgePulse(true);
    const timer = window.setTimeout(() => setBadgePulse(false), 600);
    prevPopulatedCountRef.current = populatedFieldCount;

    return () => window.clearTimeout(timer);
  }, [populatedFieldCount]);

  useEffect(() => {
    if (!isMobileSheetOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileSheetOpen]);

  useEffect(() => {
    if (!prevWebsiteEnrichedRef.current && summary.websiteEnriched) {
      setPanelGlowActive(true);

      const glowTimer = window.setTimeout(() => {
        setPanelGlowActive(false);
      }, 600);

      prevWebsiteEnrichedRef.current = true;

      return () => {
        window.clearTimeout(glowTimer);
      };
    }

    if (summary.websiteEnriched) {
      prevWebsiteEnrichedRef.current = true;
    }
  }, [summary.websiteEnriched]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isTyping, isAnalyzingWebsite, populatedFieldCount, isComplete]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || !introComplete) {
      return;
    }

    const scrollToLatest = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    };

    const observer = new ResizeObserver(scrollToLatest);
    observer.observe(container);

    return () => observer.disconnect();
  }, [introComplete]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = input.trim();
    setInput("");

    if (isOnLastQuestion && !value) {
      await skipAndComplete();
      return;
    }

    if (!value) {
      return;
    }

    await sendMessage(value);
  }

  async function handleFooterContinue() {
    setIsCompleting(true);
    try {
      await complete();
      router.push("/onboarding/campaign-type");
    } finally {
      setIsCompleting(false);
    }
  }

  return (
    <div
      className="discovery-page relative h-dvh w-full bg-white"
      style={
        {
          "--discovery-intro-transition": `${DISCOVERY_INTRO_TRANSITION_MS}ms`,
        } as CSSProperties
      }
    >
      <DiscoveryIntroSplash phase={introPhase} />
      <div
        className="discovery-page__gradient pointer-events-none absolute inset-0 z-0"
        style={{
          background: "radial-gradient(ellipse at 10% 130%, rgba(83, 38, 183, 0.15) 0%, rgba(45, 10, 140, 0.08) 35%, transparent 70%)",
        }}
        aria-hidden
      />
      <div
        className="discovery-page__gradient pointer-events-none absolute inset-0 z-0"
        style={{
          background: "radial-gradient(ellipse at 90% 10%, rgba(63, 38, 183, 0.15) 0%, rgba(45, 10, 140, 0.08) 15%, transparent 70%)",
        }}
        aria-hidden
      />
      <div
        className="discovery-page__gradient pointer-events-none absolute inset-0 z-0"
        style={{
          background: "radial-gradient(ellipse at 90% 20%, rgba(43, 38, 183, 0.20) 0%, rgba(45, 10, 140, 0.08) 15%, transparent 70%)",
        }}
        aria-hidden
      />
      <Link
        href="/"
        aria-label="leadreacher home"
        className={`fixed top-5 left-5 z-30 hidden lg:block ${chromeClassName}`}
        style={{ animationDelay: "80ms" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <DiscoveryLogo />
      </Link>

      <DiscoveryProgressSidebar
        currentQuestionIndex={currentQuestionIndex}
        isComplete={isComplete}
        chromeClassName={chromeClassName}
        style={{ animationDelay: "120ms" }}
      />

      <DiscoveryEtaCard
        currentQuestionIndex={currentQuestionIndex}
        isComplete={isComplete}
        showsQuestionProgress={!isComplete && introComplete}
        chromeClassName={chromeClassName}
        style={{ animationDelay: "180ms" }}
      />

      <DiscoveryMobileTopBar
        chromeClassName={chromeClassName}
        populatedCount={populatedFieldCount}
        badgePulse={badgePulse}
        onCampaignPress={() => setIsMobileSheetOpen(true)}
        userInitials={userInitials}
      />

      <DiscoveryRightRail
        userInitials={userInitials}
        summary={summary}
        panelGlowActive={panelGlowActive}
        chromeClassName={chromeClassName}
        style={{ animationDelay: "140ms" }}
      />

      <DiscoveryMobileCampaignSheet
        isOpen={isMobileSheetOpen}
        onClose={() => setIsMobileSheetOpen(false)}
        summary={summary}
      />

      <section
        className={`flex h-full min-h-0 flex-col ${
          !showChatUi
            ? "discovery-chat-shell"
            : introComplete
              ? "discovery-chat-shell--ready"
              : "discovery-chat-shell--entering"
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain scroll-pb-8 pt-19 lg:pt-16">
          <div
            ref={messagesContainerRef}
            className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 pt-6 pb-12"
          >
            {introComplete
              ? messages.map((message, index) =>
                  message.role === "assistant" ? (
                    <AssistantMessage
                      key={`${message.timestamp.toISOString()}-${index}`}
                      content={message.content}
                      hint={message.hint}
                      messageKey={`${message.timestamp.toISOString()}-${index}`}
                      timestamp={message.timestamp}
                      isCompletion={message.content === WEBSITE_COMPLETE_MESSAGE}
                    />
                  ) : (
                    <UserMessage
                      key={`${message.timestamp.toISOString()}-${index}`}
                      content={message.content}
                      timestamp={message.timestamp}
                      userInitials={userInitials}
                    />
                  ),
                )
              : null}

            {introComplete &&
            isAnalyzingWebsite &&
            websiteAnalysisPhase &&
            analyzingWebsite ? (
              <WebsiteAnalyzingMessage
                phase={websiteAnalysisPhase}
                website={analyzingWebsite}
                previewImageUrl={websitePreviewImageUrl}
              />
            ) : introComplete && isTyping ? (
              <TypingIndicator />
            ) : null}
            <div ref={messagesEndRef} className="h-8 shrink-0" aria-hidden />
          </div>
        </div>

        <div
          className={`shrink-0 px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:pb-6 ${
            !showChatUi ? "pointer-events-none opacity-0" : ""
          }`}
        >
          <div className="relative mx-auto w-full max-w-3xl">
            {!isComplete && introComplete ? (
              <DiscoveryQuestionProgress
                currentQuestionIndex={currentQuestionIndex}
              />
            ) : null}

            <div className="discovery-footer-bar-slot">
              <div
                className={`discovery-input-bar ${
                  showContinueBar
                    ? "discovery-input-bar--exit"
                    : "discovery-input-bar--active"
                }`}
              >
                <form onSubmit={handleSubmit}>
                  <div className="apple-glass-input flex items-center gap-2 px-3 py-2.5">
                    <input
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      placeholder={
                        isAnalyzingWebsite
                          ? "Analyzing and pulling information..."
                          : isOnLastQuestion
                            ? "Website, Instagram, LinkedIn, Facebook... (optional)"
                            : "Type your answer here..."
                      }
                      disabled={
                        isTyping || isAnalyzingWebsite || showContinueBar
                      }
                      className="apple-glass-input__field min-w-0 flex-1 border-0 bg-transparent px-1 text-[15px] text-neutral-900 outline-none placeholder:text-neutral-500/70 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <Button
                      type="submit"
                      disabled={
                        isTyping ||
                        isAnalyzingWebsite ||
                        showContinueBar ||
                        (!isOnLastQuestion && !input.trim())
                      }
                      className="inline-flex size-9 shrink-0 items-center justify-center rounded-full p-0 text-white hover:opacity-90 disabled:opacity-40"
                      style={{ backgroundColor: BRAND_COLORS.purple }}
                      aria-label={
                        isOnLastQuestion && !input.trim()
                          ? "Skip website"
                          : "Send message"
                      }
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </Button>
                  </div>
                </form>
              </div>

              <div
                className={`discovery-continue-slot ${
                  showContinueBar ? "discovery-continue-slot--visible" : ""
                }`}
                aria-hidden={!showContinueBar}
              >
                <Button
                  type="button"
                  disabled={isCompleting || !showContinueBar}
                  onClick={handleFooterContinue}
                  className="discovery-continue-btn flex h-12 w-full items-center justify-center gap-2 rounded-[1.75rem] text-[15px] font-semibold text-white"
                  style={{ backgroundColor: BRAND_COLORS.purple }}
                  tabIndex={showContinueBar ? 0 : -1}
                >
                  <span className="discovery-continue-btn__label">Continue</span>
                  <ArrowRight
                    className="discovery-continue-btn__arrow size-4"
                    aria-hidden
                  />
                </Button>
              </div>
            </div>

            <p className="discovery-footer-note mt-3 flex items-center justify-center gap-1.5 text-xs text-neutral-400">
              <Lock className="size-3.5" aria-hidden />
              Your information is secure and private
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
