import { prisma } from "./prisma.js";
import {
  recordInboundMessageWithStore,
  type InboundMessageData,
} from "./inbound-message-core.js";

export {
  inboundMessageId,
  isUniqueConstraintError,
  recordInboundMessageWithStore,
} from "./inbound-message-core.js";

/** Production wrapper around the tested, injectable durable store primitive. */
export function recordInboundMessage(
  data: InboundMessageData,
): Promise<{ created: boolean }> {
  return recordInboundMessageWithStore(prisma, data);
}
