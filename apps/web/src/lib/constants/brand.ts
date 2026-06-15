export const BRAND_COLORS = {
  purple: "#5326b7",
  bg: "#0d0854",
  purpleLight: "#7a58c4",
  purpleDark: "#24106e",
} as const;

export const ASSETS = {
  logoColored: "/logo/leadreacher_logo_colored_transparent.svg",
  logoWhite: "/logo/leadreacher_logo_white_transparent.svg",
  authBackground: "/auth/auth-bg.jpg",
  dashboard: "/Image-asset.png",
  footerGrid: "/footer-grid.png",
} as const;

export const FOOTER_TAGLINE =
  "The done-for-you system for personalized social outreach that generates conversations and grows your pipeline.";

export const FOOTER_COPYRIGHT = "© 2026 Leadreacher. All rights reserved.";

export const FOOTER_SOCIAL_LINKS = [
  { label: "LinkedIn", href: "#" },
  { label: "Instagram", href: "#" },
  { label: "X", href: "#" },
] as const;

export const FOOTER_COLUMNS = [
  {
    title: "Product",
    links: ["How it Works", "Features", "Pricing", "Integrations"],
  },
  {
    title: "Resources",
    links: ["Case Studies", "Guides", "Blog", "Templates"],
  },
  {
    title: "Company",
    links: ["About Us", "Careers", "Partners", "Contact"],
  },
  {
    title: "Legal",
    links: ["Privacy Policy", "Terms of Service", "Cookie Policy"],
  },
] as const;

export const FEATURE_BENEFITS = [
  "Setup in minutes",
  "Start Now",
  "Cancel anytime",
] as const;
