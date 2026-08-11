import { randomUUID } from "node:crypto";
import { publishDashboardEvent } from "./dashboard-events.js";

export type ChatEventType =
  | "message.created"
  | "message.updated"
  | "conversation.read"
  | "conversation.handled";

export type ChatEvent = {
  id: string;
  orgId: string;
  type: ChatEventType;
  campaignLeadId: string;
  messageId?: string;
  occurredAt: string;
};

export async function publishChatEvent(input: Omit<ChatEvent, "id" | "occurredAt">): Promise<ChatEvent> {
  const event: ChatEvent = { ...input, id: randomUUID(), occurredAt: new Date().toISOString() };
  await publishDashboardEvent({
    orgId: input.orgId,
    type: "conversation.updated",
    resources: { campaignLeadId: input.campaignLeadId },
  });
  return event;
}
