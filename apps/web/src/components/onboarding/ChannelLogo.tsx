import type { ComponentProps } from "react";
import {
  SocialMediaIcon,
  type SocialMediaIconName,
} from "@/components/ui/SocialMediaIcon";

type ChannelLogoName = Extract<SocialMediaIconName, "linkedin" | "whatsapp">;

type ChannelLogoProps = Omit<ComponentProps<"svg">, "children" | "viewBox"> & {
  name: ChannelLogoName;
};

/** Official channel marks used anywhere onboarding presents a social platform. */
export function ChannelLogo({ name, ...props }: ChannelLogoProps) {
  return <SocialMediaIcon name={name} {...props} />;
}
