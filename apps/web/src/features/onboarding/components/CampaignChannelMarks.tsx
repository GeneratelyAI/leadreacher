import { ChannelLogo, type ChannelLogoName } from "@/platform/branding/ChannelLogo";
import { cn } from "@/lib/utils";
import type { PillSection } from "../public/campaign-summary";

type CampaignChannel = {
  id: "linkedin" | "whatsapp" | "instagram" | "facebook" | "gmail" | "outlook";
  label: "LinkedIn" | "WhatsApp" | "Instagram" | "Facebook" | "Gmail" | "Outlook";
  logo: ChannelLogoName;
};

const CHANNELS: Record<CampaignChannel["id"], CampaignChannel> = {
  linkedin: { id: "linkedin", label: "LinkedIn", logo: "linkedin" },
  whatsapp: { id: "whatsapp", label: "WhatsApp", logo: "whatsapp-mark" },
  instagram: { id: "instagram", label: "Instagram", logo: "instagram" },
  facebook: { id: "facebook", label: "Facebook", logo: "facebook" },
  gmail: { id: "gmail", label: "Gmail", logo: "gmail" },
  outlook: { id: "outlook", label: "Outlook", logo: "outlook" },
};

function channelId(value: string): CampaignChannel["id"] | null {
  switch (value.trim().toLowerCase()) {
    case "linkedin":
      return "linkedin";
    case "whatsapp":
      return "whatsapp";
    case "instagram":
      return "instagram";
    case "facebook":
    case "messenger":
      return "facebook";
    case "gmail":
      return "gmail";
    case "outlook":
      return "outlook";
    case "email":
      return "gmail";
    default:
      return null;
  }
}

/** Keeps persisted channel order while presenting only supported campaign marks. */
export function campaignChannels(section: PillSection): CampaignChannel[] {
  const selectedField = section.fields?.find(
    (field) => field.label.trim().toLowerCase() === "selected channels",
  );
  const selected = selectedField?.values
    ?? selectedField?.value?.split(" · ")
    ?? section.summary?.split(" · ")
    ?? [];

  return selected.flatMap((value) => {
    const id = channelId(value);
    return id ? [CHANNELS[id]] : [];
  });
}

export function CampaignChannelMarks({
  channels,
  className,
}: {
  channels: readonly CampaignChannel[];
  className?: string;
}) {
  return (
    <span
      className={cn("campaign-pill-channel-marks", className)}
      role="list"
      aria-label="Selected channels"
    >
      {channels.map((channel, index) => (
        <span
          className="campaign-pill-channel-mark"
          role="listitem"
          aria-label={channel.label}
          key={`${channel.id}-${index}`}
        >
          <ChannelLogo name={channel.logo} className="campaign-pill-channel-mark-icon" />
        </span>
      ))}
    </span>
  );
}

export function CampaignChannelDetails({ channels }: { channels: readonly CampaignChannel[] }) {
  return (
    <div className="campaign-pill-channel-details" data-campaign-pill-channel-details>
      <div className="campaign-pill-channel-pills" role="list" aria-label="Selected channels">
        {channels.map((channel, index) => (
          <span className="campaign-pill-channel-pill" role="listitem" key={`${channel.id}-${index}`}>
            <ChannelLogo name={channel.logo} className="campaign-pill-channel-pill-icon" />
            <span>{channel.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
