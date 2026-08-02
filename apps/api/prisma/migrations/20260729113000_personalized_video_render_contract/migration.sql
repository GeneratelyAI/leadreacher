-- Keep an immutable, versioned record of how each personalized template and
-- lead asset was rendered. The JSON is intentionally private to the org.
ALTER TABLE "VideoAsset" ADD COLUMN "renderManifest" JSONB;
ALTER TABLE "CampaignVideoTemplate" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "CampaignVideoTemplate" ADD COLUMN "renderManifest" JSONB;
