import { Mail, MessageSquareText } from "lucide-react";
import { SocialMediaIcon, type SocialMediaIconName } from "@/components/ui/SocialMediaIcon";

const FEATURES = [
  {
    icon: "fa-star",
    label: "Automated content generation.",
    description: "We create content that attracts your ideal customers.",
  },
  {
    icon: "fa-paper-plane",
    label: "Automated campaign execution.",
    description: "We run and optimize campaigns across the right channels.",
  },
  {
    icon: "fa-comment",
    label: "Qualified conversations.",
    description: "We deliver qualified conversations ready for you to close.",
  },
] as const;

const SOCIAL_PLATFORMS = [
  { icon: "linkedin", label: "LinkedIn" },
  { icon: "instagram", label: "Instagram" },
  { icon: "facebook", label: "Facebook" },
  { icon: "whatsapp", label: "WhatsApp" },
  { icon: "tiktok", label: "TikTok" },
  { icon: "youtube", label: "YouTube" },
  { icon: "reddit", label: "Reddit" },
  { icon: "telegram", label: "Telegram" },
  { icon: "sms", label: "SMS" },
  { icon: "email", label: "Email" },
] as const;

function platformIcon(icon: (typeof SOCIAL_PLATFORMS)[number]["icon"]) {
  if (icon === "sms") return <MessageSquareText className="size-5" aria-hidden />;
  if (icon === "email") return <Mail className="size-5" aria-hidden />;
  return <SocialMediaIcon name={icon satisfies SocialMediaIconName} className="size-5" />;
}

export default function HeroValueProp() {
  return (
    <section className="bg-brand-bg text-white">
      <div className="mx-auto max-w-7xl px-6 pb-14 pt-10 sm:pb-16 sm:pt-12 lg:pb-20">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            New customers on autopilot.
          </h2>
          <p className="mt-3 text-base text-white/55 sm:text-lg">
            Works while you sleep.
          </p>
        </div>

        <ul className="mt-12 grid gap-10 text-center md:grid-cols-3 md:gap-0">
          {FEATURES.map((feature, index) => (
            <li
              key={feature.label}
              className="relative flex flex-col items-center px-4 md:px-10 lg:px-14"
            >
              {index > 0 ? (
                <span
                  className="absolute left-0 top-6 hidden h-48 w-px bg-white/10 md:block"
                  aria-hidden
                />
              ) : null}
              <span className="flex size-20 items-center justify-center rounded-full border border-brand-purple/55 bg-brand-purple/8 shadow-[0_0_34px_rgba(83,38,183,0.18)]">
                <i
                  className={`fas ${feature.icon} text-3xl text-brand-purple`}
                  aria-hidden
                />
              </span>
              <h3 className="mt-6 max-w-56 text-xl font-bold leading-tight text-white">
                {feature.label}
              </h3>
              <p className="mt-5 max-w-64 text-sm leading-relaxed text-white/55 sm:text-base">
                {feature.description}
              </p>
            </li>
          ))}
        </ul>

        <div className="mt-14 border-t border-white/10 pt-12 text-center sm:mt-16 sm:pt-14">
          <p className="text-xl leading-relaxed text-white/85 sm:text-2xl">
            Most businesses spend time chasing customers.
          </p>
          <p className="mt-2 text-xl leading-relaxed text-white/85 sm:text-2xl">
            <span className="font-semibold text-brand-purple">Leadreacher</span>{" "}
            helps customers find them.
          </p>

          <ul className="mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
            {SOCIAL_PLATFORMS.map((platform) => (
              <li key={platform.label}>
                <span className="sr-only">{platform.label}</span>
                <span className="flex size-11 items-center justify-center rounded-xl border border-brand-purple/25 bg-brand-purple/5 text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  {platformIcon(platform.icon)}
                </span>
              </li>
            ))}
          </ul>

          <p className="mx-auto mt-10 max-w-3xl text-center text-base leading-relaxed text-white/60 sm:text-lg">
            Customers are everywhere.{" "}
            <span className="text-brand-purple">Leadreacher</span> finds them and
            brings them to you.
          </p>
        </div>
      </div>
    </section>
  );
}
