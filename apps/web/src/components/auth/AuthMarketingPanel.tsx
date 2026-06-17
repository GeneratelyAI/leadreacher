import {
  ArrowRight,
  CheckCircle2,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Fragment } from "react";
import { BRAND_COLORS } from "@/lib/constants/brand";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "signup";

type AuthMarketingPanelProps = {
  mode: AuthMode;
};

const processSteps = [
  { icon: Sparkles, label: "Generate" },
  { icon: CheckCircle2, label: "Approve" },
  { icon: Send, label: "Launch" },
] as const;

export default function AuthMarketingPanel({ mode }: AuthMarketingPanelProps) {
  const isSignup = mode === "signup";

  return (
    <div
      className={cn(
        "flex flex-col text-left",
        "px-2 sm:px-4",
        "lg:pl-10 lg:pr-4 xl:pl-18 xl:pr-6",
      )}
    >
      <h1
        className={cn(
          "text-2xl leading-tight font-bold tracking-tight text-[#111827]",
          "sm:text-3xl",
          "lg:text-4xl xl:text-[2.75rem] xl:leading-[1.15]",
        )}
      >
        {isSignup ? (
          <>
            <span className="block">Let&apos;s get your first</span>
            <span className="block" style={{ color: BRAND_COLORS.purple }}>
              qualified conversation.
            </span>
          </>
        ) : (
          <>
            <span className="block">Welcome back to your</span>
            <span className="block" style={{ color: BRAND_COLORS.purple }}>
              qualified conversations.
            </span>
          </>
        )}
      </h1>

      <p
        className={cn(
          "mt-3 max-w-md text-sm leading-relaxed text-neutral-500",
          "lg:mt-4 lg:text-base xl:mt-5 xl:max-w-lg xl:text-lg",
        )}
      >
        {isSignup
          ? "Create your account and we'll guide you through the setup in just a few minutes."
          : "Sign in and we'll pick up right where you left off in just a few minutes."}
      </p>

      <div
        className={cn(
          "mt-8 flex items-center gap-3",
          "lg:mt-10 lg:gap-4 xl:mt-12",
        )}
      >
        <div className="h-px max-w-16 flex-1 bg-neutral-300/80" />
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 text-sm leading-none font-normal text-[#5e5870]",
            "lg:gap-2.5 lg:text-base",
          )}
        >
          <ShieldCheck
            className="size-5 shrink-0 lg:size-6"
            style={{ color: BRAND_COLORS.purple }}
            strokeWidth={2}
            aria-hidden
          />
          <span className="whitespace-nowrap">
            You stay in control. We handle the rest.
          </span>
        </div>
        <div className="h-px max-w-16 flex-1 bg-neutral-300/80" />
      </div>

      <div
        className={cn(
          "mt-8 flex items-center gap-3 text-sm leading-none font-normal text-[#5e5870]",
          "sm:gap-4 lg:mt-10 lg:gap-5 lg:text-base xl:mt-12 xl:gap-6",
        )}
      >
        {processSteps.map((step, index) => (
          <Fragment key={step.label}>
            {index > 0 ? (
              <ArrowRight
                className="size-4 shrink-0 text-[#c4b8d8] lg:size-5"
                strokeWidth={1.75}
                aria-hidden
              />
            ) : null}
            <span className="inline-flex items-center gap-2 whitespace-nowrap lg:gap-2.5">
              <span
                className={cn(
                  "inline-flex size-9 items-center justify-center rounded-lg",
                  "bg-[#ede8f7] lg:size-10",
                )}
              >
                <step.icon
                  className="size-4 lg:size-4.5"
                  style={{ color: BRAND_COLORS.purple }}
                  strokeWidth={1.75}
                  aria-hidden
                />
              </span>
              {step.label}
            </span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
