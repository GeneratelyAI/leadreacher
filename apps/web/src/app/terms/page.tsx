import Link from "next/link";

const sections = [
  {
    title: "Using LeadReacher",
    body: "LeadReacher provides business outreach, campaign planning, AI-assisted content generation, and channel-management tools. You must use the service only for lawful business purposes and remain responsible for the campaigns, messages, contacts, and connected accounts you authorize.",
  },
  {
    title: "Your accounts and connected services",
    body: "You are responsible for keeping your account credentials secure and for maintaining the permissions needed to connect third-party services. Social accounts are connected through Unipile-hosted authorization. Your use of LinkedIn, WhatsApp, Instagram, and other connected services must also comply with their applicable terms and policies.",
  },
  {
    title: "Data and outreach",
    body: "The service may process public web and professional-profile data that you provide, import, or request us to analyze. You must have a lawful basis for your outreach and respect applicable privacy, anti-spam, and marketing laws. Do not use the platform to send deceptive, unlawful, discriminatory, or unwanted communications.",
  },
  {
    title: "AI-generated content and video",
    body: "AI-generated campaign copy, recommendations, images, and videos are provided to help you work faster. You must review and approve content before using it. You are responsible for ensuring that generated content, uploaded assets, brand materials, and campaign claims are accurate and that you have the necessary rights to use them.",
  },
  {
    title: "Billing",
    body: "Paid plans and usage charges are processed by Stripe. Pricing, billing intervals, and any applicable usage charges are presented at checkout or in your account. Unless stated otherwise, fees are non-refundable to the extent permitted by law. You may cancel future renewal through the billing tools available to you.",
  },
  {
    title: "Availability and changes",
    body: "We aim to operate the service reliably, but it is provided on an as-available basis. We may update, suspend, or discontinue features when reasonably necessary. To the extent permitted by law, LeadReacher is not liable for indirect, incidental, special, or consequential losses arising from use of the service.",
  },
  {
    title: "Contact",
    body: "Questions about these terms can be sent to the LeadReacher team through your account support channel.",
  },
];

export default function TermsPage() {
  return (
    <main className="min-h-dvh bg-onboarding-neutral-50 px-5 py-12 text-onboarding-ink dark:bg-onboarding-neutral-900 dark:text-onboarding-neutral-0">
      <article className="mx-auto max-w-3xl">
        <p className="rounded-onboarding border border-onboarding-warning-500/30 bg-onboarding-warning-50 px-4 py-3 text-sm font-medium text-onboarding-warning-900 dark:bg-onboarding-warning-900 dark:text-onboarding-warning-50">
          Draft pending legal review. Do not rely on this page as final legal terms.
        </p>
        <Link href="/" className="mt-8 inline-block text-sm font-semibold text-onboarding-purple-600 hover:text-onboarding-purple-700 dark:text-onboarding-purple-200">
          LeadReacher
        </Link>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-3 text-sm text-onboarding-neutral-600 dark:text-onboarding-neutral-400">Last updated: July 17, 2026</p>
        <p className="mt-8 leading-7 text-onboarding-neutral-700 dark:text-onboarding-neutral-300">
          These draft terms govern your use of LeadReacher. By creating an account or using the service, you agree to these terms.
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
