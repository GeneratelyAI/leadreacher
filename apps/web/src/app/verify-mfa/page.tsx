import { MfaChallenge } from "@/components/auth/MfaChallenge";

export default async function VerifyMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <MfaChallenge nextPath={next} />;
}
