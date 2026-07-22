-- Prospect review, campaign sender ownership, and operator-inbox delivery state.
ALTER TABLE "Lead"
  ADD COLUMN "avatarUrl" TEXT,
  ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN "reviewedAt" TIMESTAMP(3);

CREATE INDEX "Lead_orgId_reviewStatus_idx" ON "Lead"("orgId", "reviewStatus");

ALTER TABLE "Campaign" ADD COLUMN "socialAccountId" TEXT;
CREATE INDEX "Campaign_orgId_socialAccountId_idx" ON "Campaign"("orgId", "socialAccountId");
ALTER TABLE "Campaign"
  ADD CONSTRAINT "Campaign_socialAccountId_fkey"
  FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Message"
  ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'automation',
  ADD COLUMN "readAt" TIMESTAMP(3),
  ADD COLUMN "handledAt" TIMESTAMP(3);
CREATE INDEX "Message_orgId_direction_readAt_idx" ON "Message"("orgId", "direction", "readAt");

CREATE TABLE "ManualDeliveryAttempt" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "campaignLeadId" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'reserved',
  "providerRef" TEXT,
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ManualDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManualDeliveryAttempt_messageId_key" ON "ManualDeliveryAttempt"("messageId");
CREATE INDEX "ManualDeliveryAttempt_campaignLeadId_state_idx" ON "ManualDeliveryAttempt"("campaignLeadId", "state");
CREATE INDEX "ManualDeliveryAttempt_state_reservedAt_idx" ON "ManualDeliveryAttempt"("state", "reservedAt");
ALTER TABLE "ManualDeliveryAttempt"
  ADD CONSTRAINT "ManualDeliveryAttempt_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualDeliveryAttempt"
  ADD CONSTRAINT "ManualDeliveryAttempt_campaignLeadId_fkey"
  FOREIGN KEY ("campaignLeadId") REFERENCES "CampaignLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
