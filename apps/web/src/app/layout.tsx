import type { Metadata, Viewport } from "next";
import { geist } from "@/lib/fonts/geist";
import { themeInitScript } from "@/lib/theme-init-script";
import { Toaster } from "@/components/ui/sonner";
import HorizontalRouteTransition from "@/components/layout/HorizontalRouteTransition";
import "./globals.css";

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
  title: "LeadReacher",
  description:
    "Cold calls and emails are dead. AI + social + creative to drive fresh, qualified leads.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "leadreacher",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
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
