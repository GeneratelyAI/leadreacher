import Surface from "@/components/layout/Surface";
import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#ffffff" },
  ],
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Surface surface="auth" />
      <div
        data-light-campaign-route
        className="flex min-h-dvh flex-1 flex-col bg-white"
      >
        {children}
      </div>
    </>
  );
}
