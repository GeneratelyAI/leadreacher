"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CLAY_DISCOVERY_ANSWERS,
  CLAY_DISCOVERY_AUTORUN,
  isClayDiscoveryTestMode,
} from "@/lib/constants/discovery-clay-script";
import { containsWebsiteUrl, parseWebsiteLink, type WebsiteLinkInfo } from "@/lib/discovery-website";
import { apiFetch } from "@/lib/api";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  hint?: string;
  timestamp: Date;
};

export type DiscoverySummary = {
  businessModel: string;
  industry: string;
  strengths: string;
  idealCustomer: string;
  suggestedChannels: string[];
  nextStep: string;
  websiteEnriched: boolean;
  websiteImageUrl: string | null;
};

export const EMPTY_DISCOVERY_SUMMARY: DiscoverySummary = {
  businessModel: "",
  industry: "",
  strengths: "",
  idealCustomer: "",
  suggestedChannels: [],
  nextStep: "",
  websiteEnriched: false,
  websiteImageUrl: null,
};

export const QUESTIONS = [
  {
    title: "Tell us about your business.",
    hint: "What's the name of your business, and what products or services do you provide?",
  },
  {
    title: "What sets you apart?",
    hint: "Describe any unique strengths or differentiators.",
  },
  {
    title: "Who is your ideal customer?",
    hint: "Job title, company size, location.",
  },
  {
    title: "What's your main outreach goal?",
    hint: "Book meetings, grow pipeline, partnerships.",
  },
  {
    title: "Got an online presence?",
    hint: "Share any link — website, Instagram, Facebook page, LinkedIn, or TikTok.",
  },
] as const;

const TYPING_DELAY_MS = 1300;
export const FIELD_REVEAL_DELAY_MS = 580;

export const WEBSITE_ANALYSIS_MIN_MS = 7500;
export const WEBSITE_PULLING_PHASE_MS = 3000;
export const WEBSITE_COMPLETE_MESSAGE =
  "We have everything we need to continue. Click the button below.";
export const CONTINUE_BAR_REVEAL_DELAY_MS = 680;
export const NEXT_STEP_PILL_DELAY_MS = 420;

export type WebsiteAnalysisPhase = "scanning" | "pulling";

export const DISCOVERY_INTRO_HOLD_MS = 2800;
export const DISCOVERY_INTRO_TRANSITION_MS = 900;

function questionToAssistantMessage(
  question: (typeof QUESTIONS)[number],
): ChatMessage {
  return {
    role: "assistant",
    content: question.title,
    hint: question.hint,
    timestamp: new Date(),
  };
}

function toApiMessages(messages: ChatMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.hint
      ? `${message.content} ${message.hint}`
      : message.content,
  }));
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchDiscoverySummary(
  messages: ChatMessage[],
): Promise<DiscoverySummary | null> {
  try {
    return await apiFetch<DiscoverySummary>("/discovery/summary", {
      method: "POST",
      body: JSON.stringify({
        messages: toApiMessages(messages),
      }),
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[discovery] summary fetch failed", error);
    }
    return null;
  }
}

function mergeDiscoverySummary(
  previous: DiscoverySummary,
  incoming: DiscoverySummary,
): DiscoverySummary {
  return {
    businessModel: previous.businessModel || incoming.businessModel,
    industry: previous.industry || incoming.industry,
    strengths: previous.strengths || incoming.strengths,
    idealCustomer: previous.idealCustomer || incoming.idealCustomer,
    suggestedChannels:
      previous.suggestedChannels.length > 0
        ? previous.suggestedChannels
        : incoming.suggestedChannels,
    nextStep: previous.nextStep || incoming.nextStep,
    websiteEnriched: previous.websiteEnriched || incoming.websiteEnriched,
    websiteImageUrl: previous.websiteImageUrl || incoming.websiteImageUrl,
  };
}

export function useDiscovery(options?: { introComplete?: boolean }) {
  const introComplete = options?.introComplete ?? true;
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    questionToAssistantMessage(QUESTIONS[0]),
  ]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [summary, setSummary] = useState<DiscoverySummary>(
    EMPTY_DISCOVERY_SUMMARY,
  );
  const [isComplete, setIsComplete] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isAnalyzingWebsite, setIsAnalyzingWebsite] = useState(false);
  const [websiteAnalysisPhase, setWebsiteAnalysisPhase] =
    useState<WebsiteAnalysisPhase | null>(null);
  const [analyzingWebsite, setAnalyzingWebsite] =
    useState<WebsiteLinkInfo | null>(null);
  const [websitePreviewImageUrl, setWebsitePreviewImageUrl] = useState<
    string | null
  >(null);

  const messagesRef = useRef(messages);
  const questionIndexRef = useRef(currentQuestionIndex);
  const summaryRef = useRef(summary);
  const isTypingRef = useRef(isTyping);
  const isAnalyzingWebsiteRef = useRef(isAnalyzingWebsite);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    questionIndexRef.current = currentQuestionIndex;
  }, [currentQuestionIndex]);

  useEffect(() => {
    summaryRef.current = summary;
  }, [summary]);

  useEffect(() => {
    isTypingRef.current = isTyping;
  }, [isTyping]);

  useEffect(() => {
    isAnalyzingWebsiteRef.current = isAnalyzingWebsite;
  }, [isAnalyzingWebsite]);

  const sendMessage = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isTypingRef.current || isAnalyzingWebsiteRef.current) {
      return null;
    }

    const userMessage: ChatMessage = {
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    const answeredIndex = questionIndexRef.current;
    const isLastQuestion = answeredIndex === QUESTIONS.length - 1;
    const isSubmittingWebsiteUrl =
      answeredIndex === 4 && containsWebsiteUrl(trimmed);
    let nextMessages = [...messagesRef.current, userMessage];

    messagesRef.current = nextMessages;
    setMessages(nextMessages);

    const summaryPromise = fetchDiscoverySummary(nextMessages);

    if (isSubmittingWebsiteUrl) {
      isAnalyzingWebsiteRef.current = true;
      setIsAnalyzingWebsite(true);
      setWebsiteAnalysisPhase("scanning");
      setAnalyzingWebsite(parseWebsiteLink(trimmed));
      setWebsitePreviewImageUrl(null);

      const analysisStartedAt = Date.now();
      let pullingTimer: number | undefined;

      void summaryPromise.then((summaryResult) => {
        if (summaryResult?.websiteImageUrl) {
          setWebsitePreviewImageUrl(summaryResult.websiteImageUrl);
        }
      });

      try {
        await delay(TYPING_DELAY_MS);

        pullingTimer = window.setTimeout(() => {
          setWebsiteAnalysisPhase("pulling");
        }, WEBSITE_PULLING_PHASE_MS);

        const [summaryResult] = await Promise.all([
          summaryPromise,
          delay(
            Math.max(0, WEBSITE_ANALYSIS_MIN_MS - (Date.now() - analysisStartedAt)),
          ),
        ]);

        let nextSummary = summaryRef.current;
        if (summaryResult) {
          nextSummary = mergeDiscoverySummary(summaryRef.current, summaryResult);
          summaryRef.current = nextSummary;
          setSummary(nextSummary);
        }

        const completionMessage: ChatMessage = {
          role: "assistant",
          content: WEBSITE_COMPLETE_MESSAGE,
          timestamp: new Date(),
        };
        nextMessages = [...nextMessages, completionMessage];
        messagesRef.current = nextMessages;
        setMessages(nextMessages);

        isAnalyzingWebsiteRef.current = false;
        setIsAnalyzingWebsite(false);
        setWebsiteAnalysisPhase(null);
        setAnalyzingWebsite(null);
        setWebsitePreviewImageUrl(null);

        await delay(CONTINUE_BAR_REVEAL_DELAY_MS);
        setIsComplete(true);

        return { messages: nextMessages, summary: nextSummary };
      } finally {
        if (pullingTimer !== undefined) {
          window.clearTimeout(pullingTimer);
        }
        isAnalyzingWebsiteRef.current = false;
        setIsAnalyzingWebsite(false);
        setWebsiteAnalysisPhase(null);
        setAnalyzingWebsite(null);
        setWebsitePreviewImageUrl(null);
      }
    }

    setIsTyping(true);
    isTypingRef.current = true;

    try {
      await delay(TYPING_DELAY_MS);

      if (!isLastQuestion) {
        const nextQuestion = QUESTIONS[answeredIndex + 1];
        const assistantMessage = questionToAssistantMessage(nextQuestion);
        nextMessages = [...nextMessages, assistantMessage];
        messagesRef.current = nextMessages;
        setMessages(nextMessages);
        questionIndexRef.current = answeredIndex + 1;
        setCurrentQuestionIndex(answeredIndex + 1);
      }
    } finally {
      setIsTyping(false);
      isTypingRef.current = false;
    }

    try {
      const summaryResult = await summaryPromise;
      let nextSummary = summaryRef.current;

      if (summaryResult) {
        nextSummary = mergeDiscoverySummary(summaryRef.current, summaryResult);
        summaryRef.current = nextSummary;
        setSummary(nextSummary);
      }

      if (isLastQuestion) {
        setIsComplete(true);
      }

      return { messages: nextMessages, summary: nextSummary };
    } catch {
      return { messages: nextMessages, summary: summaryRef.current };
    }
  }, []);

  const sendMessageRef = useRef(sendMessage);
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  useEffect(() => {
    if (!introComplete) return;
    if (typeof window === "undefined") return;
    if (!isClayDiscoveryTestMode(window.location.search)) return;

    let cancelled = false;
    let answerIndex = 0;
    let betweenTimer: number | undefined;

    const submitNext = async () => {
      if (cancelled || answerIndex >= CLAY_DISCOVERY_ANSWERS.length) {
        return;
      }

      await sendMessageRef.current(CLAY_DISCOVERY_ANSWERS[answerIndex]!);
      answerIndex += 1;

      if (!cancelled && answerIndex < CLAY_DISCOVERY_ANSWERS.length) {
        betweenTimer = window.setTimeout(
          submitNext,
          CLAY_DISCOVERY_AUTORUN.betweenAnswersMs,
        );
      }
    };

    const timer = window.setTimeout(
      submitNext,
      CLAY_DISCOVERY_AUTORUN.initialDelayMs,
    );

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (betweenTimer !== undefined) {
        window.clearTimeout(betweenTimer);
      }
    };
  }, [introComplete]);

  const complete = useCallback(
    async (overrides?: {
      messages?: ChatMessage[];
      summary?: DiscoverySummary;
    }) => {
      const result = await apiFetch<{ strategyId: string }>(
        "/discovery/complete",
        {
          method: "POST",
          body: JSON.stringify({
            summary: overrides?.summary ?? summaryRef.current,
            messages: toApiMessages(
              overrides?.messages ?? messagesRef.current,
            ),
          }),
        },
      );

      window.localStorage.setItem("lr_strategy_id", result.strategyId);
      return result;
    },
    [],
  );

  const skipAndComplete = useCallback(async () => {
    if (
      isComplete ||
      questionIndexRef.current !== QUESTIONS.length - 1
    ) {
      return { messages: messagesRef.current, summary: summaryRef.current };
    }

    setIsComplete(true);

    const summaryResult = await fetchDiscoverySummary(messagesRef.current);
    if (summaryResult) {
      const merged = mergeDiscoverySummary(summaryRef.current, summaryResult);
      summaryRef.current = merged;
      setSummary(merged);
      return { messages: messagesRef.current, summary: merged };
    }

    return { messages: messagesRef.current, summary: summaryRef.current };
  }, [isComplete]);

  return {
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
  };
}
