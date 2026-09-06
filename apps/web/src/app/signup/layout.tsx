import Surface from "@/components/layout/Surface";

export default function SignupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Surface surface="auth" />
      <div className="flex min-h-dvh flex-1 flex-col bg-white dark:bg-[#0a0e14]">
        {children}
      </div>
    </>
  );
}
