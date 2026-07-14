import PageSurface from "@/components/layout/PageSurface";

export default function SignupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <PageSurface surface="auth" />
      <div className="flex min-h-dvh flex-1 flex-col bg-slate-100 dark:bg-slate-950">
        {children}
      </div>
    </>
  );
}
