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

export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Surface surface="discovery" />
      <div
        data-light-campaign-route
        className="onboarding-root min-h-dvh overflow-x-clip"
      >
        {children}
      </div>
    </>
  );
}
