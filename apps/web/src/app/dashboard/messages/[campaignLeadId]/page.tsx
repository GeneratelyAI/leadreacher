import { DashboardPageFrame, MessagesView } from "@/components/dashboard/DashboardWorkspaceViews";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ campaignLeadId: string }>;
}) {
  const { campaignLeadId } = await params;
  return <DashboardPageFrame><MessagesView conversationId={campaignLeadId} /></DashboardPageFrame>;
}
