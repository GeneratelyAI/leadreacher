import SignupCampaign from "@/features/authentication/public/SignupCampaign";
import Layout from "@/features/authentication/public/Layout";

export default function SignupPage() {
  return (
    <Layout campaign>
      <SignupCampaign />
    </Layout>
  );
}
