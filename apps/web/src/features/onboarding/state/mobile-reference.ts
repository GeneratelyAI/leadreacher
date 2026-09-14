/** Numbered visual fixtures reuse the production components and preview API boundary. */
export const MOBILE_REFERENCE_STATES = [
  { id: "01", name: "Signup", route: "signup" },
  { id: "02", name: "Login", route: "login" },
  { id: "03", name: "Website entry", route: "discovery", view: "website" },
  { id: "04", name: "How LeadReacher works", route: "how-leadreacher-works" },
  { id: "05", name: "Discovery audience overview", route: "discovery" },
  {
    id: "06",
    name: "Audience editing sheet",
    route: "discovery",
    edit: "decisionMakers",
  },
  {
    id: "07",
    name: "Ambiguous category placement",
    route: "discovery",
    placement: "Healthcare",
  },
  { id: "08", name: "Campaign Content", route: "campaign-content" },
  {
    id: "09",
    name: "Personalized video style",
    route: "personalized-video",
  },
  { id: "10", name: "AI video style", route: "ai-video" },
  { id: "11", name: "Selected video upload", route: "your-video" },
  { id: "12", name: "Selected document upload", route: "document" },
  { id: "13", name: "Checkout", route: "checkout" },
  { id: "14", name: "Channel connections", route: "connect-channels" },
  { id: "15", name: "Campaign summary sheet", route: "connect-channels", summary: true },
  { id: "16", name: "Final setup review", route: "connect-channels", review: true },
  { id: "17", name: "Message and CTA", route: "cta" },
  { id: "18", name: "Channel selection", route: "channels" },
  { id: "19", name: "Campaign live", route: "live" },
] as const;

export type MobileReferenceId = (typeof MOBILE_REFERENCE_STATES)[number]["id"];

export function mobileReferenceState(screen: string | null | undefined) {
  return MOBILE_REFERENCE_STATES.find((state) => state.id === screen);
}

export function mobileReferenceHref(id: string) {
  const state = mobileReferenceState(id);
  if (!state) return "/onboarding-preview";
  const params = new URLSearchParams({ screen: state.id });
  if ("view" in state) params.set("view", state.view);
  if ("edit" in state) params.set("edit", state.edit);
  if ("placement" in state) params.set("placement", state.placement);
  if ("summary" in state && state.summary) params.set("summary", "true");
  if ("review" in state && state.review) params.set("review", "true");
  return `/onboarding-preview?${params.toString()}`;
}
