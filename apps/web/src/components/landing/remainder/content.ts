import { MessagesSquare, ShieldCheck, UsersRound } from "@/components/ui/icons";
import type { OrbitalTimelineItem } from "@/components/ui/radial-orbital-timeline";

export const comparisonRows = [
  ["Learn complex software", "LeadReacher learns your business"],
  ["Build and manage lists", "You review a focused audience"],
  ["Write every campaign", "LeadReacher drafts the outreach"],
  ["Send follow-ups manually", "Approved follow-ups run automatically"],
  ["Chase replies across inboxes", "Interested replies arrive in Chat"],
] as const;

export const channelTimeline: OrbitalTimelineItem[] = [
  { id: 1, title: "LinkedIn", date: "Social", content: "Invites and follow-ups from your connected LinkedIn account.", category: "Social", relatedIds: [2, 3], status: "completed", energy: 100, image: "/landing/linkedin-logo.webp" },
  { id: 2, title: "WhatsApp", date: "Messaging", content: "Direct conversations with campaign and reply context attached.", category: "Messaging", relatedIds: [1, 3], status: "completed", energy: 100, whatsapp: true },
  { id: 3, title: "Instagram", date: "Social", content: "Professional outreach through a connected Instagram inbox.", category: "Social", relatedIds: [1, 2, 4], status: "completed", energy: 100, image: "/landing/instagram-logo.webp" },
  { id: 4, title: "Gmail", date: "Email", content: "Approved email sequences sent from your connected Google inbox.", category: "Email", relatedIds: [3, 5], status: "completed", energy: 100, image: "/landing/gmail-logo.webp" },
  { id: 5, title: "Outlook", date: "Email", content: "Approved email sequences sent from your connected Microsoft inbox.", category: "Email", relatedIds: [4], status: "completed", energy: 100, image: "/landing/outlook-logo.webp" },
];

export const approvalTabs = ["Email", "LinkedIn", "WhatsApp", "Video"] as const;
export type ApprovalTab = (typeof approvalTabs)[number];

export const approvalBenefits = [
  "Review and approve prospects",
  "Edit personalized messages",
  "Watch and approve video choices",
] as const;

export const checkoutFeatures = [
  "AI strategy and audience research",
  "Personalized messaging and video choices",
  "Multi-channel outreach",
  "Automated follow-ups",
  "Unified reply management",
  "Campaign controls and visibility",
] as const;

export const checkoutStates = [
  {
    eyebrow: "FOCUSED AUDIENCE",
    title: "Start with the right people.",
    description: "Review the prospects selected for your campaign before any outreach begins.",
    features: ["Sarah · Common Thread is in your audience", "Fit signals are ready to review", "Approve before enrollment"],
    action: "Review your prospects",
    note: "Your audience stays reviewable.",
    status: "Audience ready",
  },
  {
    eyebrow: "SIMPLE, TRANSPARENT CHECKOUT",
    title: "Choose the campaign that fits the work.",
    description: "Your campaign selection and video choice determine the final total, shown clearly before purchase.",
    features: ["Sarah's message is personalized", "Video choice is ready to review", "Approve before launch"],
    action: "Review Sarah's campaign",
    note: "The final amount is confirmed before purchase.",
    status: "Review ready",
  },
  {
    eyebrow: "CONVERSATIONS IN CONTEXT",
    title: "Keep every reply moving forward.",
    description: "Replies arrive with their campaign and channel context intact, so you can step in at the right moment.",
    features: ["Sarah's reply stays in context", "Channel and campaign attached", "Step in when she is ready"],
    action: "Open the conversation",
    note: "Your team stays close to every opportunity.",
    status: "Reply context live",
  },
] as const;

export const reviewCards = [
  { title: "Audience ready", description: "Review the people selected for outreach.", icon: UsersRound, eyebrow: "Prospects", status: "Ready for review", accent: "blue" as const },
  { title: "Outreach approved", description: "Edit messages and channel routing before launch.", icon: ShieldCheck, eyebrow: "Campaign", status: "Approved", accent: "violet" as const },
  { title: "Conversations visible", description: "Replies arrive with their campaign context intact.", icon: MessagesSquare, eyebrow: "Chat", status: "Live context", accent: "green" as const },
] as const;

export const faqs = [
  ["How quickly can I get started?", "Drop in your website to begin. LeadReacher analyzes the business first, then guides you through audience, campaign, checkout, and channel connection."],
  ["Do I need technical skills?", "No. The workflow is designed around review and approval rather than technical configuration."],
  ["Which channels can I connect?", "LeadReacher supports LinkedIn, WhatsApp, Instagram, Facebook Messenger, Gmail, and Outlook through connected accounts."],
  ["What can I review before launch?", "You can review prospects, outreach copy, sequence steps, channel routing, and video choices before a campaign goes live."],
  ["How does personalization work?", "LeadReacher uses the business brief, approved strategy, and available prospect context to prepare relevant outreach for review."],
  ["Can I pause a campaign?", "Yes. Campaigns can be paused, and the product exposes delivery state so you can see what is running."],
] as const;
