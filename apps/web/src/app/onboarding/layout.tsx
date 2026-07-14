import PageSurface from "@/components/layout/PageSurface";

export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <PageSurface surface="discovery" />
      <div className="onboarding-root h-dvh max-h-dvh min-h-dvh overflow-hidden">
        {children}
      </div>
    </>
  );
}
