import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import {
  SocialMediaIcon,
  LINKEDIN_BRAND_LOGO_SRC,
  type SocialMediaIconName,
} from "@/components/ui/SocialMediaIcon";

type BrandImageName = "linkedin" | "instagram" | "facebook" | "gmail" | "outlook";

export type ChannelLogoName =
  | Extract<SocialMediaIconName, "whatsapp">
  | BrandImageName
  | "whatsapp-mark";

type ChannelLogoProps = Omit<ComponentProps<"svg">, "children" | "viewBox"> & {
  name: ChannelLogoName;
};

export { LINKEDIN_BRAND_LOGO_SRC };

// Same static brand marks used in the dashboard's channel picker
// (ChannelsWorkspace's ConnectChannelMark) - kept in sync so onboarding and
// dashboard always show identical logos for a given channel.
const BRAND_IMAGE_SRC: Record<BrandImageName, string> = {
  linkedin: "/landing/linkedin-logo.webp",
  instagram: "/landing/instagram-logo.webp",
  facebook: "/landing/facebook-logo.webp",
  gmail: "/landing/gmail-logo.webp",
  outlook: "/landing/outlook-logo.webp",
};

/** Official channel marks used in onboarding and dashboard chrome. */
export function ChannelLogo({ name, className, ...props }: ChannelLogoProps) {
  if (name === "whatsapp") {
    return <SocialMediaIcon name={name} className={className} {...props} />;
  }

  // Full-color WhatsApp app mark (rounded bubble + phone glyph), same as
  // the dashboard's "Connect a new channel" picker - self-contained, no
  // colored background container needed.
  if (name === "whatsapp-mark") {
    return (
      <svg viewBox="0 0 80 80" className={className} aria-hidden {...props}>
        <path
          fill="#25D366"
          d="M40.1 8C23.2 8 9.5 21.7 9.5 38.6c0 5.4 1.4 10.5 3.9 14.9L10 70.5l17.5-4.6a30.8 30.8 0 0 0 12.6 2.7h.1c16.9 0 30.6-13.7 30.6-30.6S57 8 40.1 8Z"
        />
        <path
          fill="#fff"
          d="M54.8 48.6c-.8-.4-4.9-2.4-5.6-2.7-.8-.3-1.3-.4-1.9.4-.5.8-2.1 2.6-2.5 3.1-.5.5-1 .6-1.8.2-4.8-2.4-7.9-4.2-11.1-9.6-.8-1.4.8-1.3 2.4-4.3.3-.5.1-1-.1-1.4-.3-.4-1.9-4.5-2.6-6.1-.7-1.6-1.4-1.4-1.9-1.4h-1.6c-.6 0-1.4.2-2.2 1-.7.8-2.9 2.8-2.9 6.9s2.9 8 3.3 8.6c.4.6 5.8 8.9 14.1 12.4 1.9.8 3.5 1.3 4.7 1.7 1.9.6 3.7.5 5.1.3 1.6-.2 4.8-2 5.5-3.9.7-1.9.7-3.6.5-3.9-.2-.4-.8-.6-1.6-1Z"
        />
      </svg>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- shared brand asset
    <img
      src={BRAND_IMAGE_SRC[name]}
      alt=""
      draggable={false}
      className={cn("object-contain", className)}
    />
  );
}
