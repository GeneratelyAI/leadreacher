CREATE TABLE "CampaignVideoTemplate" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "seedImageUrl" TEXT,
  "masterVideoUrl" TEXT,
  "sharedNarrationUrl" TEXT,
  "imagePrompt" TEXT,
  "videoPrompt" TEXT,
  "sharedNarration" TEXT,
  "selectedTone" TEXT,
  "voice" TEXT NOT NULL,
  "criticScore" INTEGER,
  "needsReview" BOOLEAN NOT NULL DEFAULT false,
  "veoOperationId" TEXT,
  "veoOperationState" TEXT,
  "veoSubmitLeaseAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CampaignVideoTemplate_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CampaignVideoTemplate"
  ADD CONSTRAINT "CampaignVideoTemplate_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignVideoTemplate"
  ADD CONSTRAINT "CampaignVideoTemplate_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "CampaignVideoTemplate_campaignId_version_key"
  ON "CampaignVideoTemplate"("campaignId", "version");
CREATE UNIQUE INDEX "CampaignVideoTemplate_veoOperationId_key"
  ON "CampaignVideoTemplate"("veoOperationId");
CREATE INDEX "CampaignVideoTemplate_orgId_status_idx"
  ON "CampaignVideoTemplate"("orgId", "status");
CREATE INDEX "CampaignVideoTemplate_campaignId_status_idx"
  ON "CampaignVideoTemplate"("campaignId", "status");
CREATE INDEX "CampaignVideoTemplate_veoOperationState_veoSubmitLeaseAt_idx"
  ON "CampaignVideoTemplate"("veoOperationState", "veoSubmitLeaseAt");

ALTER TABLE "VideoAsset" ADD COLUMN "templateId" TEXT;
ALTER TABLE "VideoAsset"
  ADD CONSTRAINT "VideoAsset_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "CampaignVideoTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "VideoAsset_templateId_idx" ON "VideoAsset"("templateId");
CREATE UNIQUE INDEX "VideoAsset_templateId_leadId_key" ON "VideoAsset"("templateId", "leadId");
