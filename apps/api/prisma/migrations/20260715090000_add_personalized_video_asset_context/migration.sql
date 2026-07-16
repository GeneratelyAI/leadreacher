-- Persist the prospect association and pipeline for lead-specific video generation.
ALTER TABLE "VideoAsset" ADD COLUMN "leadId" TEXT;
ALTER TABLE "VideoAsset" ADD COLUMN "pipeline" TEXT NOT NULL DEFAULT 'standard';

ALTER TABLE "VideoAsset"
  ADD CONSTRAINT "VideoAsset_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "VideoAsset_leadId_idx" ON "VideoAsset"("leadId");
CREATE INDEX "VideoAsset_campaignId_leadId_idx" ON "VideoAsset"("campaignId", "leadId");
