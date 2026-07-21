import { SocialMediaIcon, type SocialMediaIconName } from "@/components/ui/SocialMediaIcon";
import { FOOTER_SOCIAL_LINKS } from "@/lib/constants/brand";

const SOCIAL_ICON_CLASS = "h-4 w-4";

const SOCIAL_ICONS: Record<(typeof FOOTER_SOCIAL_LINKS)[number]["label"], SocialMediaIconName> = {
  LinkedIn: "linkedin",
  Instagram: "instagram",
  X: "x",
};

export default function FooterSocialLinks() {
  return (
    <div className="flex items-center gap-3">
      {FOOTER_SOCIAL_LINKS.map(({ label, href }) => (
        <a
          key={label}
          href={href}
          aria-label={label}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-purple shadow-[0_2px_14px_rgba(83,38,183,0.14)] transition-all duration-fast ease-brand hover:-translate-y-0.5 hover:shadow-[0_4px_18px_rgba(83,38,183,0.22)] focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30 focus-visible:shadow-[0_4px_18px_rgba(83,38,183,0.22)]"
        >
          <SocialMediaIcon name={SOCIAL_ICONS[label]} className={SOCIAL_ICON_CLASS} />
        </a>
      ))}
    </div>
  );
}
