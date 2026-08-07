ALTER TABLE "Lead"
ADD COLUMN "instagramUsername" TEXT,
ADD COLUMN "instagramMessagingId" TEXT,
ADD COLUMN "instagramIdentityStatus" TEXT NOT NULL DEFAULT 'unresolved',
ADD COLUMN "whatsappConsentAt" TIMESTAMP(3),
ADD COLUMN "whatsappConsentSource" TEXT,
ADD COLUMN "outreachSuppressedAt" TIMESTAMP(3),
ADD COLUMN "outreachSuppressionReason" TEXT;

CREATE INDEX "Lead_orgId_instagramUsername_idx"
ON "Lead"("orgId", "instagramUsername");

CREATE INDEX "Lead_orgId_instagramIdentityStatus_idx"
ON "Lead"("orgId", "instagramIdentityStatus");

CREATE INDEX "Lead_orgId_whatsappConsentAt_idx"
ON "Lead"("orgId", "whatsappConsentAt");

CREATE INDEX "Lead_orgId_outreachSuppressedAt_idx"
ON "Lead"("orgId", "outreachSuppressedAt");

ALTER TABLE "CampaignLead"
ADD COLUMN "skipReason" TEXT,
ADD COLUMN "skippedAt" TIMESTAMP(3);
