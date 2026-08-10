"use client";

import { useEffect, useState, type CSSProperties, type FormEvent, type Ref } from "react";
import { ArrowRight, Link2, LoaderCircle } from "lucide-react";
import ShimmerText from "@/components/ui/shimmer-text";
import { getWebsiteFaviconUrl } from "@/lib/discovery-website";
import { normalizeLandingWebsiteUrl } from "@/lib/landing-url-analyzer";
import { cn } from "@/lib/utils";

type UrlBarProps = {
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
};

export function UrlBar({
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
}: UrlBarProps) {
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

  return (
    <form ref={formRef} data-fiber-flow-target={formRef ? true : undefined} onSubmit={onSubmit} className={formClassName} style={formStyle} noValidate>
      <div
        ref={barRef}
        data-invalid={errorMessage ? "true" : undefined}
        className="hero-analyzer flex min-h-20 items-center rounded-[22px] border border-transparent p-2 shadow-[0_18px_45px_rgba(66,42,148,0.10)] transition-[box-shadow] duration-300 focus-within:shadow-[0_18px_45px_rgba(66,42,148,0.16),0_0_0_3px_rgba(124,58,237,0.10),0_0_30px_rgba(99,102,241,0.14)] max-sm:flex-col max-sm:items-stretch max-sm:gap-2 max-sm:rounded-2xl"
        style={{
          background: errorMessage
            ? "linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(105deg, #fca5a5, #ef4444, #fca5a5) border-box"
            : "linear-gradient(#ffffff, #ffffff) padding-box, linear-gradient(105deg, rgba(147,51,234,.72), rgba(196,181,253,.82) 24%, rgba(255,255,255,.96) 48%, rgba(165,180,252,.86) 72%, rgba(79,70,229,.76)) border-box",
          backgroundSize: "100% 100%, 220% 100%",
        }}
      >
        <label htmlFor={id} className="sr-only">Company website</label>
        <div className="flex min-w-0 flex-1 items-center">
          <span className="relative ml-4 size-6 shrink-0" aria-hidden>
            <Link2 className={cn("absolute inset-0 size-6 text-[#6b7280] transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none", faviconLoaded && !faviconFailed ? "-rotate-12 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100")} />
            {faviconHost ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={faviconHost}
                src={getWebsiteFaviconUrl(faviconHost)}
                alt=""
                onLoad={() => setFaviconLoaded(true)}
                onError={() => { setFaviconFailed(true); setFaviconLoaded(false); }}
                className={cn("absolute inset-0 size-6 rounded-md object-contain transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none", faviconLoaded && !faviconFailed ? "rotate-0 scale-100 opacity-100" : "rotate-12 scale-50 opacity-0")}
              />
            ) : null}
          </span>
          <div className="relative min-w-0 flex-1">
            <input ref={inputRef} id={id} type="url" inputMode="url" autoComplete="url" value={value} onChange={(event) => onValueChange(event.target.value)} disabled={disabled} placeholder="https://yourwebsite.com" aria-invalid={Boolean(errorMessage)} className={cn("relative z-0 h-14 min-w-0 w-full bg-transparent px-4 text-base font-medium outline-none placeholder:text-[#8b91a3] disabled:opacity-70 sm:text-lg", disabled && "text-transparent caret-transparent")} />
          </div>
        </div>
        <button type="submit" disabled={disabled} className="inline-flex h-14 shrink-0 items-center justify-center gap-3 border-l border-[#e6e4f1] px-5 text-lg font-semibold text-[#4e28df] transition-transform duration-200 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#8b7fd4]/45 active:translate-y-px disabled:pointer-events-none disabled:opacity-75 max-sm:w-full max-sm:border-l-0 max-sm:border-t sm:min-w-[180px] sm:pl-6 sm:pr-1.5 sm:text-xl">
          {disabled ? <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden /> : null}
          {disabled ? "Analyzing website" : <ShimmerText duration={3.6} style={{ "--lr-shimmer-base": "#4e28df", "--lr-shimmer-core": "#ffffff", "--lr-shimmer-edge": "rgba(255,255,255,0.75)" } as CSSProperties}>Get Started</ShimmerText>}
          {!disabled ? <ArrowRight className="size-6" aria-hidden /> : null}
        </button>
      </div>
    </form>
  );
}
