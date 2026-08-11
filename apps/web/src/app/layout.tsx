import type { Metadata, Viewport } from "next";
import { geist } from "@/lib/fonts/geist";
import { themeInitScript } from "@/lib/theme-init-script";
import { Toaster } from "@/components/ui/sonner";
import HorizontalRouteTransition from "@/components/layout/HorizontalRouteTransition";
import "./globals.css";

const SITE_URL = "https://leadreacher.ai";
const SITE_DESCRIPTION =
  "AI-powered multi-channel outreach with personalized video, built for review before launch.";
const SOCIAL_PREVIEW_IMAGE = "/social/leadreacher-link-preview.png";
// Keep a single, versioned browser icon URL. Safari caches favicons aggressively
// by URL, so changing this value is the reliable way to refresh existing tabs.
const FAVICON_IMAGE = "/leadreacher-favicon-v2.png?v=20260811";

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
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LeadReacher",
  },
  icons: {
    icon: [
      { url: FAVICON_IMAGE, sizes: "192x192", type: "image/png" },
    ],
    shortcut: [
      { url: FAVICON_IMAGE, sizes: "192x192", type: "image/png" },
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body className="flex min-h-dvh flex-col overscroll-y-none font-sans bg-white dark:bg-[#0a0e14] text-slate-900 dark:text-slate-50">
        {children}
        <HorizontalRouteTransition />
        <Toaster />
      </body>
    </html>
  );
}
