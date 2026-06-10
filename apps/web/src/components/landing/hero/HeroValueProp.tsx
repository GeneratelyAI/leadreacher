const FEATURES = [
  { icon: "fa-star", label: "Automated content generation." },
  { icon: "fa-paper-plane", label: "Automated campaign execution." },
  { icon: "fa-comment", label: "Qualified conversations." },
] as const;

const SOCIAL_PLATFORMS = [
  { icon: "fa-linkedin", label: "LinkedIn", brand: true },
  { icon: "fa-instagram", label: "Instagram", brand: true },
  { icon: "fa-facebook", label: "Facebook", brand: true },
  { icon: "fa-whatsapp", label: "WhatsApp", brand: true },
  { icon: "fa-tiktok", label: "TikTok", brand: true },
  { icon: "fa-youtube", label: "YouTube", brand: true },
  { icon: "fa-reddit", label: "Reddit", brand: true },
  { icon: "fa-telegram", label: "Telegram", brand: true },
  { icon: "fa-comment-sms", label: "SMS", brand: false },
  { icon: "fa-envelope", label: "Email", brand: false },
] as const;

export default function HeroValueProp() {
  return (
    <section className="bg-brand-bg text-white">
      <div className="mx-auto max-w-7xl px-6 pb-12 pt-6 sm:pb-14 sm:pt-8">
        <div className="grid gap-10 md:grid-cols-2 md:gap-12 lg:gap-16">
          <div className="flex flex-col justify-center gap-4 border-white/10 md:border-r md:pr-12 lg:pr-16">
            <p className="text-lg leading-relaxed text-white/90 sm:text-xl">
              Most businesses spend time chasing customers.
            </p>
            <p className="text-lg leading-relaxed sm:text-xl">
              <span className="text-brand-purple">Leadreacher</span> helps
              customers find them.
            </p>
          </div>

          <div className="flex flex-col justify-center gap-6 md:pl-4 lg:pl-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                New customers on autopilot.
              </h2>
              <p className="mt-2 text-base text-white/60 sm:text-lg">
                Works while you sleep.
              </p>
            </div>

            <ul className="grid gap-6 sm:grid-cols-3 sm:gap-4">
              {FEATURES.map((feature) => (
                <li
                  key={feature.label}
                  className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-left"
                >
                  <span className="flex size-12 items-center justify-center rounded-full border border-brand-purple/40 bg-brand-purple/10">
                    <i
                      className={`fas ${feature.icon} text-lg text-brand-purple`}
                      aria-hidden
                    />
                  </span>
                  <span className="text-sm leading-snug text-white/85">
                    {feature.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center gap-4 sm:mt-10">
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 sm:gap-x-6">
            {SOCIAL_PLATFORMS.map((platform) => (
              <li key={platform.label}>
                <span className="sr-only">{platform.label}</span>
                <i
                  className={`${platform.brand ? "fab" : "fas"} ${platform.icon} text-xl text-white/80`}
                  aria-hidden
                />
              </li>
            ))}
          </ul>
          <p className="max-w-2xl text-center text-sm leading-relaxed text-white/70 sm:text-base">
            Customers are everywhere.{" "}
            <span className="text-brand-purple">Leadreacher</span> finds them
            and brings them to you.
          </p>
        </div>
      </div>
    </section>
  );
}
