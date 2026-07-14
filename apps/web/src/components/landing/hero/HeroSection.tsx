"use client";

import { FormEvent, useState } from "react";
import { Globe } from "lucide-react";
import { useRouter } from "next/navigation";
import { cleanWebsiteDomain } from "@/lib/website-url";
import HeroVideo from "./HeroVideo";

const heroHeadlineShadow =
  "drop-shadow-[0_2px_20px_rgba(255,255,255,0.75)]";
const heroBodyShadow = "drop-shadow-[0_1px_12px_rgba(255,255,255,0.85)]";
const heroTrustShadow = "drop-shadow-[0_1px_8px_rgba(0,0,0,0.25)]";

const TRUST_BADGES = [
  "No spam outreach",
  "Real-time tracking",
  "Cancel anytime",
] as const;

export default function HeroSection() {
  const router = useRouter();
  const [websiteUrl, setWebsiteUrl] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const domain = cleanWebsiteDomain(websiteUrl);
    if (!domain) {
      return;
    }

    window.localStorage.setItem("lr_website_url", domain);
    if (!window.localStorage.getItem("lr_anon_scrape_id")) {
      window.localStorage.setItem("lr_anon_scrape_id", window.crypto.randomUUID());
    }
    router.push("/signup");
  }

  return (
    <section className="relative isolate flex w-full flex-col overflow-hidden pb-0">
      <HeroVideo />
      <div
        className="hero-bottom-fade pointer-events-none absolute inset-x-0 bottom-0 z-5 h-[50%] min-h-80"
        aria-hidden
      />
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-5 pb-10 pt-24 sm:px-8 sm:pb-12 sm:pt-28 md:pt-32">
        <main className="flex w-full flex-col items-center justify-start text-center">
          <div className="relative flex w-full max-w-6xl flex-col items-center justify-center px-2 pb-2 sm:px-4 sm:pb-4">
            <h1 className="w-full max-w-5xl text-balance text-4xl font-bold leading-[1.06] tracking-tight text-neutral-950 sm:max-w-6xl sm:text-5xl sm:leading-[1.05] md:text-6xl lg:text-[4rem] lg:leading-[1.04] xl:text-[4.75rem]">
              <span className={`relative block ${heroHeadlineShadow}`}>
                Customer acquisition.
              </span>
              <span
                className={`relative mt-2 block text-brand-purple sm:mt-3 ${heroHeadlineShadow}`}
              >
                Reimagined.
              </span>
            </h1>
            <p className="relative mt-12 max-w-1xl text-pretty text-base font-bold leading-relaxed text-neutral-950 sm:mt-14 sm:text-lg">
              <span className={heroBodyShadow}>
                100% done-for-you. Focus on running your business.
              </span>
            </p>
          </div>
          <div className="relative mt-4 sm:mt-5">
            <form
              onSubmit={handleSubmit}
              className="flex w-[min(40rem,calc(100vw-2rem))] items-center gap-1 rounded-full border border-white/70 bg-white/90 p-1 shadow-[0_12px_34px_rgba(13,8,84,0.16)] ring-1 ring-brand-purple/10 backdrop-blur-sm"
            >
              <label className="sr-only" htmlFor="landing-website-url">
                Company website
              </label>
              <Globe
                className="ml-4 size-5 shrink-0 text-[#6B5FBF] sm:ml-5 sm:size-6"
                aria-hidden
              />
              <input
                id="landing-website-url"
                value={websiteUrl}
                onChange={(event) => setWebsiteUrl(event.target.value)}
                placeholder="yourcompany.com"
                className="min-w-0 flex-1 bg-transparent px-2 text-base font-medium text-neutral-900 outline-none placeholder:text-neutral-400 sm:text-lg"
              />
              <button
                type="submit"
                className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-[#8B7FD4] px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(83,38,183,0.18)] transition duration-fast ease-brand hover:bg-[#7A6ED0] sm:h-14 sm:px-7 sm:text-base"
              >
                Generate →
              </button>
            </form>
            <ul className="relative mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-white/80 sm:text-[0.8125rem]">
              {TRUST_BADGES.map((badge, index) => (
                <li key={badge} className="flex items-center gap-4">
                  <span className={`flex items-center gap-2 ${heroTrustShadow}`}>
                    <span
                      className="flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-purple text-[0.5rem] text-white"
                      aria-hidden
                    >
                      ✓
                    </span>
                    {badge}
                  </span>
                  {index < TRUST_BADGES.length - 1 ? (
                    <span
                      className="hidden h-3 w-px bg-white/30 sm:block"
                      aria-hidden
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </main>
      </div>
    </section>
  );
}
