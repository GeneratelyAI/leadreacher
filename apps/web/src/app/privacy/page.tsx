import Link from "next/link";

const sections = [
  {
    title: "Information we process",
    body: "We process account information such as your name, email address, organization details, and billing references. We also process campaign settings, connected-channel account references, public web and professional-profile data you ask us to analyze, and content you create, upload, or approve.",
  },
  {
    title: "How we use information",
    body: "We use information to provide LeadReacher, build outreach strategies, generate and deliver approved campaign content, operate connected channels, process payments, secure the service, and improve reliability. We do not use your confidential campaign data to train public AI models unless you separately agree.",
  },
  {
    title: "Third-party providers",
    body: "LeadReacher relies on service providers to operate the product, including providers for social-channel authorization and delivery, payment processing, cloud infrastructure and storage, and AI content and video generation. These providers process information only as needed to provide their services under their own applicable terms and privacy practices.",
  },
  {
    title: "Public web and professional data",
    body: "The service may collect and analyze publicly available web and professional-profile information to help you identify business prospects. You are responsible for ensuring that your use of that information and any resulting outreach complies with applicable privacy, marketing, and platform rules.",
  },
  {
    title: "Data retention and security",
    body: "We retain information for as long as needed to provide the service, meet legal obligations, resolve disputes, and enforce agreements. We use reasonable administrative, technical, and organizational measures to protect information, but no system can guarantee absolute security.",
  },
  {
    title: "Your choices",
    body: "You may request access to, correction of, or deletion of personal information associated with your account, subject to legal and operational requirements. You can disconnect linked channels and cancel future billing through the tools available in your account.",
  },
  {
    title: "Contact",
    body: "For privacy questions or requests, contact the LeadReacher team through your account support channel.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-onboarding-neutral-50 px-5 py-12 text-onboarding-ink dark:bg-onboarding-neutral-900 dark:text-onboarding-neutral-0">
      <article className="mx-auto max-w-3xl">
        <p className="rounded-onboarding border border-onboarding-warning-500/30 bg-onboarding-warning-50 px-4 py-3 text-sm font-medium text-onboarding-warning-900 dark:bg-onboarding-warning-900 dark:text-onboarding-warning-50">
          Draft pending legal review. Do not rely on this page as final legal terms.
        </p>
        <Link href="/" className="mt-8 inline-block text-sm font-semibold text-onboarding-purple-600 hover:text-onboarding-purple-700 dark:text-onboarding-purple-200">
          LeadReacher
        </Link>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-3 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Last updated: July 17, 2026</p>
        <p className="mt-8 leading-7 text-onboarding-neutral-700 dark:text-onboarding-neutral-300">
          This draft policy explains how LeadReacher handles information when you use our AI-powered B2B outreach platform.
        </p>
        <div className="mt-10 space-y-9">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <p className="mt-3 leading-7 text-onboarding-neutral-700 dark:text-onboarding-neutral-300">{section.body}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
