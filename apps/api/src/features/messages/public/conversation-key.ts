

export function conversationKey(campaignId: string, leadId: string): string {
  return `${campaignId}:${leadId}`;
}
