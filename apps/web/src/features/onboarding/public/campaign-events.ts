export const CAMPAIGN_SAVED_EVENT = "leadreacher:campaign-saved";

export function announceCampaignSave(path: string, method?: string) {
  if (typeof window === "undefined" || !method || method.toUpperCase() === "GET") return;
  if (path === "/discovery/complete" || /^\/strategy\/[^/]+\/(campaign-type|video-decision|content-approval|channels)$/.test(path)) {
    window.dispatchEvent(new Event(CAMPAIGN_SAVED_EVENT));
  }
}
