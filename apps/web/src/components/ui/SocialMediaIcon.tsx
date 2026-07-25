import type { ComponentProps } from "react";
import {
  siFacebook,
  siInstagram,
  siReddit,
  siTelegram,
  siTiktok,
  siWhatsapp,
  siX,
  siYoutube,
} from "simple-icons";
import { cn } from "@/lib/utils";

export type SocialMediaIconName =
  | "facebook"
  | "instagram"
  | "linkedin"
  | "reddit"
  | "telegram"
  | "tiktok"
  | "whatsapp"
  | "x"
  | "youtube";

type SocialMediaIconProps = Omit<ComponentProps<"svg">, "children" | "viewBox"> & {
  name: SocialMediaIconName;
  title?: string;
};

const SOCIAL_ICON_PATHS: Record<Exclude<SocialMediaIconName, "linkedin">, string> = {
  facebook: siFacebook.path,
  instagram: siInstagram.path,
  reddit: siReddit.path,
  telegram: siTelegram.path,
  tiktok: siTiktok.path,
  whatsapp: siWhatsapp.path,
  x: siX.path,
  youtube: siYoutube.path,
};

export const LINKEDIN_BRAND_LOGO_SRC = "/dashboard/linkedin-logo.png";

/** Canonical social marks used anywhere a named channel is displayed. */
export function SocialMediaIcon({
  name,
  title,
  className,
  ...props
}: SocialMediaIconProps) {
  if (name === "linkedin") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- shared brand asset
      <img
        src={LINKEDIN_BRAND_LOGO_SRC}
        alt={title ?? ""}
        draggable={false}
        className={cn("object-contain", className)}
        aria-hidden={title ? undefined : true}
      />
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={className}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path d={SOCIAL_ICON_PATHS[name]} />
    </svg>
  );
}
