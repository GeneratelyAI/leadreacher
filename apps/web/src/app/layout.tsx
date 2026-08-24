import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { geist } from "@/lib/fonts/geist";
import { themeInitScript } from "@/lib/theme-init-script";
import { Toaster } from "@/components/ui/sonner";
import RouteTransition from "@/components/layout/RouteTransition";
import { SITE_URL } from "@/lib/constants/brand";
import "./globals.css";

// The apex domain redirects here. Keep metadata on the serving host so search
// engines associate one canonical favicon and page identity with the site.
const SITE_DESCRIPTION =
  "AI-powered multi-channel outreach with personalized video, built for review before launch.";
// Social platforms cache previews independently. Version this URL whenever the
// branded card changes so new shares cannot reuse an old third-party preview.
const SOCIAL_PREVIEW_IMAGE = "/social/leadreacher-link-preview.png?v=20260812";
// Keep a single, versioned browser icon URL. Safari caches favicons aggressively
// by URL, so changing this value is the reliable way to refresh existing tabs.
const FAVICON_IMAGE = "/logo/leadreacher_icon_colored.svg?v=20260824";

// theme-color is intentionally omitted here: themeInitScript and
// useThemeMode own that meta tag directly (they remove/recreate it on
// every load and toggle). Letting Next's metadata system also render it
// gives two owners of the same DOM node - React's reconciler ends up
// calling removeChild on a node our script already removed, throwing
// "Cannot read properties of null (reading 'removeChild')".
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "LeadReacher",
  description: SITE_DESCRIPTION,
  applicationName: "LeadReacher",
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LeadReacher",
  },
  icons: {
    icon: [
      { url: FAVICON_IMAGE, type: "image/svg+xml" },
    ],
    shortcut: [
      { url: FAVICON_IMAGE, type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [{ rel: "mask-icon", url: "/safari-pinned-tab.svg" }],
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "LeadReacher",
    title: "LeadReacher",
    description: SITE_DESCRIPTION,
    images: [
      {
        url: SOCIAL_PREVIEW_IMAGE,
        width: 1200,
        height: 630,
        alt: "LeadReacher",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LeadReacher",
    description: SITE_DESCRIPTION,
    images: [SOCIAL_PREVIEW_IMAGE],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      className={`${geist.variable} h-full antialiased bg-white dark:bg-[#0a0e14]`}
      suppressHydrationWarning
    >
      <head>
        {/* Next's appleWebApp.capable metadata option doesn't emit this tag
            in the installed Next version - set directly so "Add to Home
            Screen" launches standalone on iOS instead of opening Safari. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <script
          id="lr-theme-init"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body className="flex min-h-dvh flex-col overscroll-y-none font-sans bg-white dark:bg-[#0a0e14] text-slate-900 dark:text-slate-50">
        {children}
        <RouteTransition />
        <Toaster />
      </body>
    </html>
  );
}
