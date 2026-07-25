import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import {
  SocialMediaIcon,
  LINKEDIN_BRAND_LOGO_SRC,
  type SocialMediaIconName,
} from "@/components/ui/SocialMediaIcon";

export type ChannelLogoName = Extract<SocialMediaIconName, "linkedin" | "whatsapp">;

type ChannelLogoProps = Omit<ComponentProps<"svg">, "children" | "viewBox"> & {
  name: ChannelLogoName;
};

export { LINKEDIN_BRAND_LOGO_SRC };

/** Official channel marks used in onboarding and dashboard chrome. */
export function ChannelLogo({ name, className, ...props }: ChannelLogoProps) {
  if (name === "linkedin") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- shared brand asset
      <img
        src={LINKEDIN_BRAND_LOGO_SRC}
        alt=""
        draggable={false}
        className={cn("object-contain", className)}
      />
    );
  }

  return <SocialMediaIcon name={name} className={className} {...props} />;
}
