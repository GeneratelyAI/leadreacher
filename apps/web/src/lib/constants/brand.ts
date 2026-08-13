export const SITE_URL = "https://www.leadreacher.ai";
export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "support@leadreacher.com";
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;

export const ASSETS = {
  logoColored: "/logo/leadreacher_logo_colored_transparent.svg",
  logoWhite: "/logo/leadreacher_logo_white_transparent.svg",
  planeIcon: "/logo/leadreacher_plane_only.svg",
  planeIconWhite: "/logo/leadreacher_plane_white.svg",
  authBackground: "/auth/auth-bg.png",
  authBackgroundDark: "/auth/auth-bg-dark.png",
  dashboard: "/Image-asset.png",
  footerGrid: "/footer-grid.png",
} as const;
