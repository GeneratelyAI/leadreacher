import type { Metadata } from "next";
import { type ReactNode } from "react";
import LandingFooter from "@/components/landing/remainder/LandingFooter";
import Navbar from "@/components/layout/Navbar";
import TermsNavigator from "./TermsNavigator";
import { termsDocument, type TermsBlock } from "./terms-content";

export const metadata: Metadata = {
  title: "Terms and Conditions | LeadReacher",
  description:
    "The terms and conditions governing business access to and use of LeadReacher.",
  alternates: { canonical: "/terms" },
};

type LegalIconProps = {
  className?: string;
};

function CheckIcon({ className }: LegalIconProps) {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><path d="m3.5 8.2 2.7 2.7 6.3-6.3" /></svg>;
}

function ShieldCheckIcon({ className }: LegalIconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></svg>;
}

function renderBlocks(blocks: readonly TermsBlock[]): ReactNode[] {
  const content: ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    content.push(
      <ul key={`list-${content.length}`} className="my-5 space-y-3 pl-1">
        {bullets.map((bullet) => (
          <li key={bullet} className="grid grid-cols-[1.25rem_1fr] gap-3">
            <span className="mt-[0.45rem] flex size-4 items-center justify-center rounded-full bg-[#eee9ff] text-[#5c3df2]">
              <CheckIcon className="size-2.5" />
            </span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  blocks.forEach((block, index) => {
    if (block.kind === "bullet") {
      bullets.push(block.text);
      return;
    }

    flushBullets();
    content.push(
      <p key={`paragraph-${index}`} className="mt-4 first:mt-0">
        {block.text}
      </p>,
    );
  });
  flushBullets();

  return content;
}

export default function TermsPage() {
  const sectionLinks = termsDocument.sections.map(({ number, title, id }) => ({ number, title, id }));

  return (
    <main id="top" className="min-h-dvh overflow-x-clip bg-[#f7f7fb] text-[#111326]">
      <a
        href="#terms-content"
        className="fixed left-4 top-3 z-[80] -translate-y-20 rounded-lg bg-[#17162a] px-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform focus:translate-y-0"
      >
        Skip to terms content
      </a>
      <div className="print:hidden">
        <Navbar />
      </div>

      <LandingFooter footerClassName="print:hidden">
        <div className="relative z-10 rounded-b-[28px] bg-[#f7f7fb] sm:rounded-b-[40px]">
          <section data-navbar-theme="light" className="relative isolate border-b border-[#dfdceb] bg-white pt-16 print:pt-0">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_15%,rgba(101,71,246,0.12),transparent_28%),radial-gradient(circle_at_88%_5%,rgba(71,157,255,0.10),transparent_26%)]"
        />
        <div className="mx-auto max-w-[90rem] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24 print:py-8">
          <div className="max-w-4xl">
            <h1 className="text-balance text-4xl font-semibold tracking-[-0.045em] text-[#111326] sm:text-6xl lg:text-7xl">
              Terms and Conditions
            </h1>
            <p className="mt-6 max-w-3xl text-pretty text-lg leading-8 text-[#5f6173] sm:text-xl">
              The agreement governing business access to and use of the LeadReacher website, platform, AI features, and connected services.
            </p>
            <dl className="mt-9 grid max-w-3xl gap-4 border-t border-[#dddbea] pt-6 text-sm sm:grid-cols-2 sm:gap-8">
              <div>
                <dt className="font-semibold text-[#22243a]">Effective and last updated</dt>
                <dd className="mt-1 text-[#6b6d7d]">{termsDocument.effectiveDate}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[#22243a]">Contracting entity</dt>
                <dd className="mt-1 text-[#6b6d7d]">{termsDocument.contractingEntity}</dd>
              </div>
            </dl>
          </div>
        </div>
          </section>

          <div data-navbar-theme="light" className="mx-auto max-w-[90rem] px-5 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-18 print:px-0 print:py-5">
        <aside className="mb-8 rounded-2xl border border-[#d8d1ff] bg-[linear-gradient(135deg,#f2efff_0%,#faf9ff_58%,#f0f6ff_100%)] p-5 shadow-[0_12px_34px_rgba(62,43,151,0.08)] sm:p-6">
          <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
            <span className="flex size-11 items-center justify-center rounded-xl bg-white text-[#5a3de4] shadow-[0_7px_20px_rgba(73,48,174,0.12)] ring-1 ring-[#ded8ff]">
              <ShieldCheckIcon className="size-6" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#5a3de4]">Business-use notice</p>
              <p className="mt-2 max-w-6xl text-sm leading-6 text-[#39364f] sm:text-base sm:leading-7">
                {termsDocument.notice}
              </p>
            </div>
          </div>
        </aside>

        <div className="grid gap-10 lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)] xl:gap-16 print:block">
          <TermsNavigator sections={sectionLinks} />

          <article id="terms-content" className="min-w-0 scroll-mt-24 rounded-3xl border border-[#deddea] bg-white px-5 py-2 shadow-[0_22px_60px_rgba(23,20,54,0.07)] sm:px-9 lg:px-10 xl:px-14 print:border-0 print:px-8 print:shadow-none">
            {termsDocument.sections.map((section) => (
              <section
                id={section.id}
                key={section.id}
                className="scroll-mt-24 border-b border-[#ebe9f2] py-10 last:border-0 sm:py-12"
              >
                <div className="grid gap-4 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-5">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[#f2efff] font-mono text-xs font-semibold text-[#6346e7] ring-1 ring-[#e2ddff] sm:size-11">
                    {String(section.number).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-pretty text-xl font-semibold tracking-[-0.02em] text-[#16182c] sm:text-2xl">
                      {section.title}
                    </h2>
                    <div className="mt-4 text-[0.975rem] leading-7 text-[#57596c] sm:text-base sm:leading-8">
                      {renderBlocks(section.blocks)}
                    </div>
                  </div>
                </div>
              </section>
            ))}

            <footer className="border-t border-[#dcd9e8] py-10 sm:py-12">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#6346e7]">Publisher</p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#5f6173]">{termsDocument.publisher}</p>
            </footer>
          </article>
        </div>
          </div>
        </div>
      </LandingFooter>
    </main>
  );
}
