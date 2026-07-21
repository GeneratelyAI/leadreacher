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

const LINKEDIN_PATH =
  "M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12Zm1.78 13.02H3.56V9h3.56v11.45Z";

const SOCIAL_ICON_PATHS: Record<SocialMediaIconName, string> = {
  facebook: siFacebook.path,
  instagram: siInstagram.path,
  linkedin: LINKEDIN_PATH,
  reddit: siReddit.path,
  telegram: siTelegram.path,
  tiktok: siTiktok.path,
  whatsapp: siWhatsapp.path,
  x: siX.path,
  youtube: siYoutube.path,
};

/** Canonical 24x24 social marks used anywhere a named channel is displayed. */
export function SocialMediaIcon({
  name,
  title,
  ...props
}: SocialMediaIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path d={SOCIAL_ICON_PATHS[name]} />
    </svg>
  );
}
