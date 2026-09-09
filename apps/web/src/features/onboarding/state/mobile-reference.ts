/** Numbered visual fixtures reuse the production components and preview API boundary. */
export const MOBILE_REFERENCE_STATES = [
  { id: "01", name: "Signup", step: "signup" },
  { id: "02", name: "Login", step: "login" },
  { id: "03", name: "Website entry", step: "discovery", view: "website" },
  { id: "04", name: "How LeadReacher works", step: "strategy", substep: "how-it-works" },
  { id: "05", name: "Discovery audience overview", step: "discovery" },
  {
    id: "06",
    name: "Audience editing sheet",
    step: "discovery",
    edit: "decisionMakers",
  },
  {
    id: "07",
    name: "Ambiguous category placement",
    step: "discovery",
    placement: "Healthcare",
  },
  { id: "08", name: "Campaign Content", step: "campaign-content" },
  {
    id: "09",
    name: "Personalized video style",
    step: "personalized-video-style",
  },
  { id: "10", name: "AI video style", step: "ai-video-style" },
  { id: "11", name: "Selected video upload", step: "upload-video" },
  { id: "12", name: "Selected document upload", step: "upload-document" },
  { id: "13", name: "Checkout", step: "checkout" },
  { id: "14", name: "Channel connections", step: "channels" },
  { id: "15", name: "Campaign summary sheet", step: "channels", summary: true },
  { id: "16", name: "Final setup review", step: "channels", review: true },
] as const;

export type MobileReferenceId = (typeof MOBILE_REFERENCE_STATES)[number]["id"];

export function mobileReferenceState(screen: string | null | undefined) {
  return MOBILE_REFERENCE_STATES.find((state) => state.id === screen);
}

export function mobileReferenceHref(id: string) {
  const state = mobileReferenceState(id);
  if (!state) return "/onboarding-preview";
  const params = new URLSearchParams({ screen: state.id, step: state.step });
  if ("substep" in state) params.set("substep", state.substep);
  if ("view" in state) params.set("view", state.view);
  if ("review" in state) params.set("review", "true");
  if (state.id === "09" || state.id === "10")
    params.set("media", "placeholder");
  return `/onboarding-preview?${params}`;
}
