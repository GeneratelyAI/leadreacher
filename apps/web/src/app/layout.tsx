import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ANIMATION_VIDEO_SRC } from "@/lib/constants/animation";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

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
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <head>
        <link
          rel="preload"
          href={ANIMATION_VIDEO_SRC}
          as="video"
          type="video/webm"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
