ALTER TABLE "Organization"
  ADD COLUMN "disabledAt" TIMESTAMP(3),
  ADD COLUMN "deletionRequestedAt" TIMESTAMP(3),
  ADD COLUMN "purgeAt" TIMESTAMP(3),
  ADD COLUMN "legalAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "termsVersion" TEXT,
  ADD COLUMN "privacyVersion" TEXT;

CREATE TABLE "ActivityEvent" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "campaignId" TEXT,
  "leadId" TEXT,
  "messageId" TEXT,
  "channel" TEXT,
  "actorUserId" TEXT,
  "title" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "metadata" JSONB,
  "idempotencyKey" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductEmailOutbox" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductEmailOutbox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationExportJob" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "format" TEXT NOT NULL DEFAULT 'json',
  "status" TEXT NOT NULL DEFAULT 'pending',
  "objectKey" TEXT,
  "manifest" JSONB,
  "expiresAt" TIMESTAMP(3),
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationExportJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ActivityEvent_idempotencyKey_key" ON "ActivityEvent"("idempotencyKey");
CREATE INDEX "ActivityEvent_orgId_occurredAt_id_idx" ON "ActivityEvent"("orgId", "occurredAt", "id");
CREATE INDEX "ActivityEvent_orgId_eventType_occurredAt_idx" ON "ActivityEvent"("orgId", "eventType", "occurredAt");
CREATE INDEX "ActivityEvent_orgId_campaignId_occurredAt_idx" ON "ActivityEvent"("orgId", "campaignId", "occurredAt");
CREATE UNIQUE INDEX "ProductEmailOutbox_idempotencyKey_key" ON "ProductEmailOutbox"("idempotencyKey");
CREATE INDEX "ProductEmailOutbox_status_scheduledAt_idx" ON "ProductEmailOutbox"("status", "scheduledAt");
CREATE INDEX "ProductEmailOutbox_orgId_createdAt_idx" ON "ProductEmailOutbox"("orgId", "createdAt");
CREATE INDEX "OrganizationExportJob_orgId_createdAt_idx" ON "OrganizationExportJob"("orgId", "createdAt");
CREATE INDEX "OrganizationExportJob_status_createdAt_idx" ON "OrganizationExportJob"("status", "createdAt");

ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductEmailOutbox" ADD CONSTRAINT "ProductEmailOutbox_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationExportJob" ADD CONSTRAINT "OrganizationExportJob_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ActivityEvent" (
  "id", "orgId", "eventType", "campaignId", "leadId", "messageId", "channel",
  "title", "detail", "metadata", "idempotencyKey", "occurredAt"
)
SELECT
  'backfill:message:' || m."id",
  m."orgId",
  CASE WHEN m."direction" = 'inbound' THEN 'message.inbound' ELSE 'message.outbound' END,
  m."campaignId",
  m."leadId",
  m."id",
  m."channel",
  CASE
    WHEN m."direction" = 'inbound' THEN 'Reply received from ' || l."firstName" || ' ' || l."lastName"
    ELSE 'Outreach sent to ' || l."firstName" || ' ' || l."lastName"
  END,
  m."channel" || ' · ' || c."name",
  jsonb_build_object(
    'leadName', l."firstName" || ' ' || l."lastName",
    'company', l."company",
    'avatarUrl', l."avatarUrl",
    'campaignName', c."name"
  ),
  'message:' || m."id",
  m."createdAt"
FROM "Message" m
JOIN "Lead" l ON l."id" = m."leadId"
JOIN "Campaign" c ON c."id" = m."campaignId"
ON CONFLICT ("idempotencyKey") DO NOTHING;

INSERT INTO "ActivityEvent" (
  "id", "orgId", "eventType", "leadId", "title", "detail", "metadata",
  "idempotencyKey", "occurredAt"
)
SELECT
  'backfill:lead:' || l."id",
  l."orgId",
  'prospect.created',
  l."id",
  'Prospect added: ' || l."firstName" || ' ' || l."lastName",
  l."company",
  jsonb_build_object('leadName', l."firstName" || ' ' || l."lastName", 'company', l."company", 'avatarUrl', l."avatarUrl"),
  'lead:' || l."id",
  l."createdAt"
FROM "Lead" l
ON CONFLICT ("idempotencyKey") DO NOTHING;

INSERT INTO "ActivityEvent" (
  "id", "orgId", "eventType", "campaignId", "title", "detail", "metadata",
  "idempotencyKey", "occurredAt"
)
SELECT
  'backfill:campaign:' || c."id",
  c."orgId",
  'campaign.' || c."status",
  c."id",
  c."name" || ' is ' || c."status",
  (SELECT COUNT(*)::text || ' enrolled prospects' FROM "CampaignLead" cl WHERE cl."campaignId" = c."id"),
  jsonb_build_object('campaignName', c."name", 'status', c."status"),
  'campaign:' || c."id" || ':initial',
  c."updatedAt"
FROM "Campaign" c
ON CONFLICT ("idempotencyKey") DO NOTHING;

INSERT INTO "ActivityEvent" (
  "id", "orgId", "eventType", "campaignId", "leadId", "title", "detail", "metadata",
  "idempotencyKey", "occurredAt"
)
SELECT
  'backfill:video:' || v."id",
  v."orgId",
  'video.' || v."status",
  v."campaignId",
  v."leadId",
  CASE WHEN v."status" IN ('ready', 'approved') THEN 'Video ready' ELSE 'Video ' || v."status" END,
  COALESCE(c."name", 'Campaign video'),
  jsonb_build_object('campaignName', c."name", 'status', v."status"),
  'video:' || v."id" || ':initial',
  v."updatedAt"
FROM "VideoAsset" v
LEFT JOIN "Campaign" c ON c."id" = v."campaignId"
ON CONFLICT ("idempotencyKey") DO NOTHING;

CREATE OR REPLACE FUNCTION record_message_activity() RETURNS trigger AS $$
DECLARE
  lead_row "Lead"%ROWTYPE;
  campaign_row "Campaign"%ROWTYPE;
BEGIN
  SELECT * INTO lead_row FROM "Lead" WHERE "id" = NEW."leadId";
  SELECT * INTO campaign_row FROM "Campaign" WHERE "id" = NEW."campaignId";
  INSERT INTO "ActivityEvent" (
    "id", "orgId", "eventType", "campaignId", "leadId", "messageId", "channel",
    "title", "detail", "metadata", "idempotencyKey", "occurredAt"
  ) VALUES (
    'message:' || NEW."id", NEW."orgId",
    CASE WHEN NEW."direction" = 'inbound' THEN 'message.inbound' ELSE 'message.outbound' END,
    NEW."campaignId", NEW."leadId", NEW."id", NEW."channel",
    CASE WHEN NEW."direction" = 'inbound' THEN 'Reply received from ' ELSE 'Outreach sent to ' END ||
      lead_row."firstName" || ' ' || lead_row."lastName",
    NEW."channel" || ' · ' || campaign_row."name",
    jsonb_build_object(
      'leadName', lead_row."firstName" || ' ' || lead_row."lastName",
      'company', lead_row."company", 'avatarUrl', lead_row."avatarUrl",
      'campaignName', campaign_row."name"
    ),
    'message:' || NEW."id", NEW."createdAt"
  ) ON CONFLICT ("idempotencyKey") DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION record_lead_activity() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO "ActivityEvent" (
      "id", "orgId", "eventType", "leadId", "title", "detail", "metadata", "idempotencyKey", "occurredAt"
    ) VALUES (
      'lead:' || NEW."id", NEW."orgId", 'prospect.created', NEW."id",
      'Prospect added: ' || NEW."firstName" || ' ' || NEW."lastName", NEW."company",
      jsonb_build_object('leadName', NEW."firstName" || ' ' || NEW."lastName", 'company', NEW."company", 'avatarUrl', NEW."avatarUrl"),
      'lead:' || NEW."id", NEW."createdAt"
    ) ON CONFLICT ("idempotencyKey") DO NOTHING;
  ELSIF NEW."status" IS DISTINCT FROM OLD."status" THEN
    INSERT INTO "ActivityEvent" (
      "id", "orgId", "eventType", "leadId", "title", "detail", "metadata", "occurredAt"
    ) VALUES (
      'lead-status:' || NEW."id" || ':' || NEW."status" || ':' || extract(epoch FROM clock_timestamp())::text || ':' || random()::text,
      NEW."orgId", 'prospect.' || NEW."status", NEW."id",
      NEW."firstName" || ' ' || NEW."lastName" || ' is ' || NEW."status", NEW."company",
      jsonb_build_object('leadName', NEW."firstName" || ' ' || NEW."lastName", 'company', NEW."company", 'avatarUrl', NEW."avatarUrl", 'status', NEW."status"),
      NEW."updatedAt"
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION record_campaign_activity() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW."status" IS DISTINCT FROM OLD."status" THEN
    INSERT INTO "ActivityEvent" (
      "id", "orgId", "eventType", "campaignId", "title", "detail", "metadata", "occurredAt"
    ) VALUES (
      'campaign-status:' || NEW."id" || ':' || NEW."status" || ':' || extract(epoch FROM clock_timestamp())::text || ':' || random()::text,
      NEW."orgId", 'campaign.' || NEW."status", NEW."id",
      NEW."name" || ' is ' || NEW."status",
      (SELECT COUNT(*)::text || ' enrolled prospects' FROM "CampaignLead" WHERE "campaignId" = NEW."id"),
      jsonb_build_object('campaignName', NEW."name", 'status', NEW."status"), NEW."updatedAt"
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION record_video_activity() RETURNS trigger AS $$
DECLARE campaign_name TEXT;
BEGIN
  IF TG_OP = 'INSERT' OR NEW."status" IS DISTINCT FROM OLD."status" THEN
    SELECT "name" INTO campaign_name FROM "Campaign" WHERE "id" = NEW."campaignId";
    INSERT INTO "ActivityEvent" (
      "id", "orgId", "eventType", "campaignId", "leadId", "title", "detail", "metadata", "occurredAt"
    ) VALUES (
      'video-status:' || NEW."id" || ':' || NEW."status" || ':' || extract(epoch FROM clock_timestamp())::text || ':' || random()::text,
      NEW."orgId", 'video.' || NEW."status", NEW."campaignId", NEW."leadId",
      CASE WHEN NEW."status" IN ('ready', 'approved') THEN 'Video ready' ELSE 'Video ' || NEW."status" END,
      COALESCE(campaign_name, 'Campaign video'),
      jsonb_build_object('campaignName', campaign_name, 'status', NEW."status"), NEW."updatedAt"
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Message_activity_event" AFTER INSERT ON "Message"
  FOR EACH ROW EXECUTE FUNCTION record_message_activity();
CREATE TRIGGER "Lead_activity_event" AFTER INSERT OR UPDATE OF "status" ON "Lead"
  FOR EACH ROW EXECUTE FUNCTION record_lead_activity();
CREATE TRIGGER "Campaign_activity_event" AFTER INSERT OR UPDATE OF "status" ON "Campaign"
  FOR EACH ROW EXECUTE FUNCTION record_campaign_activity();
CREATE TRIGGER "VideoAsset_activity_event" AFTER INSERT OR UPDATE OF "status" ON "VideoAsset"
  FOR EACH ROW EXECUTE FUNCTION record_video_activity();
