"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
  type Ref,
} from "react";
import { ArrowRight, Link2, LoaderCircle } from "@/components/ui/icons";
import ShimmerText from "@/components/ui/shimmer-text";
import { getWebsiteFaviconUrl } from "@/lib/discovery-website";
import { normalizeLandingWebsiteUrl } from "@/lib/landing-url-analyzer";
import { cn } from "@/lib/utils";

type BrowserBarProps = {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  formRef?: Ref<HTMLFormElement>;
  barRef?: Ref<HTMLDivElement>;
  inputRef?: Ref<HTMLInputElement>;
  formClassName?: string;
  formStyle?: CSSProperties;
  errorMessage?: string | null;
  disabled?: boolean;
  spotlight?: boolean;
};

export function BrowserBar({
  id,
  value,
  onValueChange,
  onSubmit,
  formRef,
  barRef,
  inputRef,
  formClassName,
  formStyle,
  errorMessage,
  disabled = false,
  spotlight = false,
}: BrowserBarProps) {
  const [faviconHost, setFaviconHost] = useState<string | null>(null);
  const [faviconLoaded, setFaviconLoaded] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const normalizedUrl = normalizeLandingWebsiteUrl(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFaviconHost(normalizedUrl);
      setFaviconLoaded(false);
      setFaviconFailed(false);
    }, normalizedUrl ? 220 : 0);
    return () => window.clearTimeout(timer);
  }, [normalizedUrl]);

  function updateSpotlight(event: MouseEvent<HTMLDivElement>) {
    if (!spotlight) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spotlight-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--spotlight-y", `${event.clientY - bounds.top}px`);
  }

  return (
    <form ref={formRef} data-fiber-flow-target={formRef ? true : undefined} onSubmit={onSubmit} className={cn("relative", formClassName)} style={formStyle} noValidate>
      <div
        ref={barRef}
        data-invalid={errorMessage ? "true" : undefined}
        onMouseMove={updateSpotlight}
        className="hero-analyzer group relative isolate flex min-h-18 items-center overflow-hidden rounded-[22px] border border-transparent p-1.5 shadow-[0_18px_45px_rgba(66,42,148,0.10)] transition-[box-shadow] duration-300 focus-within:shadow-[0_18px_45px_rgba(66,42,148,0.16),0_0_0_3px_rgba(124,58,237,0.10),0_0_30px_rgba(99,102,241,0.14)] sm:min-h-20 sm:p-2"
        style={{
          backgroundImage: errorMessage
            ? "linear-gradient(#ffffff, #ffffff), linear-gradient(105deg, #fca5a5, #ef4444, #fca5a5)"
            : "linear-gradient(#ffffff, #ffffff), linear-gradient(105deg, rgba(147,51,234,.72), rgba(196,181,253,.82) 24%, rgba(255,255,255,.96) 48%, rgba(165,180,252,.86) 72%, rgba(79,70,229,.76))",
          backgroundOrigin: "border-box",
          backgroundClip: "padding-box, border-box",
          backgroundSize: "100% 100%, 220% 100%",
        }}
      >
        {spotlight ? (
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-20 z-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 [background:radial-gradient(260px_circle_at_var(--spotlight-x,_50%)_var(--spotlight-y,_50%),rgba(111,76,255,.16),transparent_70%)]"
          />
        ) : null}
        <div className="relative z-10 flex min-w-0 flex-1 items-center">
        <label htmlFor={id} className="sr-only">Company website</label>
          <span className="relative ml-2 size-5 shrink-0 sm:ml-4 sm:size-6" aria-hidden>
            <Link2 className={cn("absolute inset-0 size-5 text-[#6b7280] transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none sm:size-6", faviconLoaded && !faviconFailed ? "-rotate-12 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100")} />
            {faviconHost ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={faviconHost}
                src={getWebsiteFaviconUrl(faviconHost)}
                alt=""
                onLoad={() => setFaviconLoaded(true)}
                onError={() => { setFaviconFailed(true); setFaviconLoaded(false); }}
                className={cn("absolute inset-0 size-5 rounded-md object-contain transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none sm:size-6", faviconLoaded && !faviconFailed ? "rotate-0 scale-100 opacity-100" : "rotate-12 scale-50 opacity-0")}
              />
            ) : null}
          </span>
          <div className="relative min-w-0 flex-1">
            <input ref={inputRef} id={id} type="url" inputMode="url" autoComplete="url" value={value} onChange={(event) => onValueChange(event.target.value)} disabled={disabled} placeholder="https://yourwebsite.com" aria-invalid={Boolean(errorMessage)} aria-describedby={errorMessage ? `${id}-error` : undefined} className={cn("relative z-0 h-14 min-w-0 w-full bg-transparent px-2 text-base font-medium outline-none placeholder:text-[#8b91a3] disabled:opacity-70 sm:px-4 sm:text-lg", disabled && "text-transparent caret-transparent")} />
          </div>
        </div>
        <button type="submit" disabled={disabled} className="relative z-10 inline-flex h-14 min-w-[6.75rem] shrink-0 items-center justify-center gap-1 border-l border-[#e6e4f1] px-0 text-sm font-semibold text-[#4e28df] transition-transform duration-200 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#8b7fd4]/45 active:translate-y-px disabled:pointer-events-none disabled:opacity-75 sm:min-w-[180px] sm:gap-3 sm:pl-6 sm:pr-1.5 sm:text-xl">
          {disabled ? <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
          {disabled ? "Analyzing website" : <ShimmerText duration={3.6} style={{ "--lr-shimmer-base": "#4e28df", "--lr-shimmer-core": "#ffffff", "--lr-shimmer-edge": "rgba(255,255,255,0.75)" } as CSSProperties}>Get Started</ShimmerText>}
          {!disabled ? <ArrowRight className="size-5 sm:size-6" aria-hidden /> : null}
        </button>
      </div>
      {errorMessage ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="absolute left-1/2 top-full mt-2 w-full -translate-x-1/2 text-center text-sm font-medium text-[#dc2626]"
        >
          {errorMessage}
        </p>
      ) : null}
    </form>
  );
}
