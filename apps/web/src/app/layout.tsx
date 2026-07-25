import type { Metadata, Viewport } from "next";
import { geist } from "@/lib/fonts/geist";
import { THEME_COLOR_LIGHT, themeInitScript } from "@/lib/theme-init-script";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "leadreacher — Lead Generation, Reimagined",
  description:
    "Cold calls and emails are dead. AI + social + creative to drive fresh, qualified leads.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <meta name="theme-color" content={THEME_COLOR_LIGHT} />
        <script
          id="lr-theme-init"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body className="flex min-h-dvh flex-col overscroll-y-none font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
