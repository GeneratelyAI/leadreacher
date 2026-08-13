import { ProspectDetails } from "@/components/dashboard/ProspectDetails";

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProspectDetails prospectId={id} presentation="page" />;
}
