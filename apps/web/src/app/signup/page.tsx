import AuthForm from "@/components/auth/AuthForm";

export default function SignupPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-neutral-50 px-4 py-16">
      <AuthForm mode="signup" />
    </main>
  );
}
