import LoginCampaign from "@/features/authentication/public/LoginCampaign";
import Layout from "@/features/authentication/public/Layout";

export default function LoginPage() {
  return (
    <Layout campaign>
      <LoginCampaign />
    </Layout>
  );
}
