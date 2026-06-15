import AuthForm from "@/components/auth/AuthForm";
import AuthPageShell from "@/components/auth/AuthPageShell";

export default function SignupPage() {
  return (
    <AuthPageShell>
      <AuthForm mode="signup" />
    </AuthPageShell>
  );
}
