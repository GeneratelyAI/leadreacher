export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="h-dvh max-h-dvh overflow-hidden bg-white dark:bg-[#0a0a1a]">
      {children}
    </div>
  );
}
