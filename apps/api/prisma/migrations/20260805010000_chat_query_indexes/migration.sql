CREATE INDEX "Message_orgId_direction_readAt_createdAt_idx"
ON "Message"("orgId", "direction", "readAt", "createdAt");

CREATE INDEX "Message_orgId_campaignId_leadId_createdAt_idx"
ON "Message"("orgId", "campaignId", "leadId", "createdAt");
