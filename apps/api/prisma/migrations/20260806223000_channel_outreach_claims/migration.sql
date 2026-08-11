CREATE TABLE "ChannelOutreachClaim" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChannelOutreachClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChannelOutreachClaim_orgId_leadId_channel_key"
ON "ChannelOutreachClaim"("orgId", "leadId", "channel");

CREATE INDEX "ChannelOutreachClaim_campaignId_channel_idx"
ON "ChannelOutreachClaim"("campaignId", "channel");
