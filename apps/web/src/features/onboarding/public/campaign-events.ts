export const CAMPAIGN_SAVED_EVENT = "leadreacher:campaign-saved";
export const CAMPAIGN_CHANNEL_SELECTION_EVENT = "leadreacher:campaign-channel-selection";

export function announceCampaignChannelSelection(channels: readonly string[]) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<string[]>(CAMPAIGN_CHANNEL_SELECTION_EVENT, {
    detail: [...channels],
  }));
}

export function announceCampaignSave(path: string, method?: string) {
  if (typeof window === "undefined" || !method || method.toUpperCase() === "GET") return;
  if (path === "/discovery/complete" || path === "/social-accounts/sync" || /^\/strategy\/[^/]+\/(campaign-type|video-decision|content-approval|channels|outreach-message)$/.test(path)) {
    window.dispatchEvent(new Event(CAMPAIGN_SAVED_EVENT));
  }
}
