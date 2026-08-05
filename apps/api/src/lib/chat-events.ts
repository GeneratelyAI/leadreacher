import { randomUUID } from "node:crypto";
import { redis } from "./redis.js";

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

export const chatEventChannel = (orgId: string) => `leadreacher:chat:${orgId}`;
const chatEventStream = (orgId: string) => `leadreacher:chat-events:${orgId}`;

export async function publishChatEvent(input: Omit<ChatEvent, "id" | "occurredAt">): Promise<ChatEvent> {
  const event: ChatEvent = { ...input, id: randomUUID(), occurredAt: new Date().toISOString() };
  const payload = JSON.stringify(event);
  void Promise.all([
    redis.publish(chatEventChannel(input.orgId), payload),
    redis.xadd(chatEventStream(input.orgId), "MAXLEN", "~", 1000, "*", "event", payload),
  ]).catch(() => {
    // Delivery persistence is authoritative. A transient live-update failure
    // must never turn a successfully delivered provider message into an error.
  });
  return event;
}
