import type { Metadata } from "next";
import LandingFooter from "@/components/landing/remainder/LandingFooter";
import Navbar from "@/components/layout/Navbar";
import TermsNavigator from "../terms/TermsNavigator";

export const metadata: Metadata = {
  title: "Privacy Policy | LeadReacher",
  description: "How LeadReacher collects, uses, stores, and protects information.",
  alternates: { canonical: "/privacy" },
};

const lastUpdated = "July 17, 2026";

const sections = [
  {
    number: 1,
    id: "information-we-process",
    title: "Information we process",
    body: "We process account information such as your name, email address, organization details, and billing references. We also process campaign settings, connected-channel account references, public web and professional-profile data you ask us to analyze, and content you create, upload, or approve.",
  },
  {
    number: 2,
    id: "how-we-use-information",
    title: "How we use information",
    body: "We use information to provide LeadReacher, build outreach strategies, generate and deliver approved campaign content, operate connected channels, process payments, secure the service, and improve reliability. We do not use your confidential campaign data to train public AI models unless you separately agree.",
  },
  {
    number: 3,
    id: "third-party-providers",
    title: "Third-party providers",
    body: "LeadReacher relies on service providers to operate the product, including providers for social-channel authorization and delivery, payment processing, cloud infrastructure and storage, and AI content and video generation. These providers process information only as needed to provide their services under their own applicable terms and privacy practices.",
  },
  {
    number: 4,
    id: "public-web-and-professional-data",
    title: "Public web and professional data",
    body: "The service may collect and analyze publicly available web and professional-profile information to help you identify business prospects. You are responsible for ensuring that your use of that information and any resulting outreach complies with applicable privacy, marketing, and platform rules.",
  },
  {
    number: 5,
    id: "data-retention-and-security",
    title: "Data retention and security",
    body: "We retain information for as long as needed to provide the service, meet legal obligations, resolve disputes, and enforce agreements. We use reasonable administrative, technical, and organizational measures to protect information, but no system can guarantee absolute security.",
  },
  {
    number: 6,
    id: "your-choices",
    title: "Your choices",
    body: "You may request access to, correction of, or deletion of personal information associated with your account, subject to legal and operational requirements. You can disconnect linked channels and cancel future billing through the tools available in your account.",
  },
  {
    number: 7,
    id: "contact",
    title: "Contact",
    body: "For privacy questions or requests, contact the LeadReacher team through your account support channel.",
  },
] as const;

function PrivacyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="M9.5 11.5V9a2.5 2.5 0 0 1 5 0v2.5" />
      <rect x="8" y="11.5" width="8" height="6" rx="1.5" />
    </svg>
  );
}

export default function PrivacyPage() {
  const sectionLinks = sections.map(({ number, title, id }) => ({ number, title, id }));

  return (
    <main id="top" className="min-h-dvh overflow-x-clip bg-[#f7f7fb] text-[#111326]">
      <a href="#privacy-content" className="fixed left-4 top-3 z-[80] -translate-y-20 rounded-lg bg-[#17162a] px-4 py-3 text-sm font-semibold text-white shadow-lg transition-transform focus:translate-y-0">
        Skip to privacy content
      </a>
      <div className="print:hidden"><Navbar /></div>

      <LandingFooter footerClassName="print:hidden">
        <div className="relative z-10 rounded-b-[28px] bg-[#f7f7fb] sm:rounded-b-[40px]">
          <section data-navbar-theme="light" className="relative isolate border-b border-[#dfdceb] bg-white pt-16 print:pt-0">
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_15%,rgba(101,71,246,0.12),transparent_28%),radial-gradient(circle_at_88%_5%,rgba(71,157,255,0.10),transparent_26%)]" />
            <div className="mx-auto max-w-[90rem] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24 print:py-8">
              <div className="max-w-4xl">
                <h1 className="text-balance text-4xl font-semibold tracking-[-0.045em] text-[#111326] sm:text-6xl lg:text-7xl">Privacy Policy</h1>
                <p className="mt-6 max-w-3xl text-pretty text-lg leading-8 text-[#5f6173] sm:text-xl">
                  How LeadReacher handles information when you use our AI-powered business outreach platform and connected services.
                </p>
                <dl className="mt-9 grid max-w-3xl gap-4 border-t border-[#dddbea] pt-6 text-sm sm:grid-cols-2 sm:gap-8">
                  <div><dt className="font-semibold text-[#22243a]">Last updated</dt><dd className="mt-1 text-[#6b6d7d]">{lastUpdated}</dd></div>
                  <div><dt className="font-semibold text-[#22243a]">Applies to</dt><dd className="mt-1 text-[#6b6d7d]">LeadReacher websites, platform, AI features, and connected services</dd></div>
                </dl>
              </div>
            </div>
          </section>

          <div data-navbar-theme="light" className="mx-auto max-w-[90rem] px-5 py-10 sm:px-8 sm:py-14 lg:px-12 lg:py-18 print:px-0 print:py-5">
            <aside className="mb-8 rounded-2xl border border-[#e6cf8d] bg-[linear-gradient(135deg,#fff8dd_0%,#fffdf4_58%,#f7f4ff_100%)] p-5 shadow-[0_12px_34px_rgba(94,73,15,0.07)] sm:p-6">
              <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
                <span className="flex size-11 items-center justify-center rounded-xl bg-white text-[#6546e7] shadow-[0_7px_20px_rgba(73,48,174,0.10)] ring-1 ring-[#ead99d]"><PrivacyIcon className="size-6" /></span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#765a08]">Legal review notice</p>
                  <p className="mt-2 max-w-6xl text-sm leading-6 text-[#4d452c] sm:text-base sm:leading-7">This policy is a draft pending legal review. Do not rely on this page as a final privacy policy.</p>
                </div>
              </div>
            </aside>

            <div className="grid gap-10 lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)] xl:gap-16 print:block">
              <TermsNavigator sections={sectionLinks} contentId="privacy-content" documentLabel="privacy policy" />

              <article id="privacy-content" className="min-w-0 scroll-mt-24 rounded-3xl border border-[#deddea] bg-white px-5 py-2 shadow-[0_22px_60px_rgba(23,20,54,0.07)] sm:px-9 lg:px-10 xl:px-14 print:border-0 print:px-8 print:shadow-none">
                {sections.map((section) => (
                  <section id={section.id} key={section.id} className="scroll-mt-24 border-b border-[#ebe9f2] py-10 last:border-0 sm:py-12">
                    <div className="grid gap-4 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-5">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-[#f2efff] font-mono text-xs font-semibold text-[#6346e7] ring-1 ring-[#e2ddff] sm:size-11">{String(section.number).padStart(2, "0")}</span>
                      <div className="min-w-0">
                        <h2 className="text-pretty text-xl font-semibold tracking-[-0.02em] text-[#16182c] sm:text-2xl">{section.title}</h2>
                        <p className="mt-4 text-[0.975rem] leading-7 text-[#57596c] sm:text-base sm:leading-8">{section.body}</p>
                      </div>
                    </div>
                  </section>
                ))}
                <footer className="border-t border-[#dcd9e8] py-10 sm:py-12">
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#6346e7]">Privacy requests</p>
                  <p className="mt-3 text-sm leading-6 text-[#5f6173]">Contact the LeadReacher team through your account support channel.</p>
                </footer>
              </article>
            </div>
          </div>
        </div>
      </LandingFooter>
    </main>
  );
}
