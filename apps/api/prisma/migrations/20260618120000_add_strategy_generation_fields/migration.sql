-- AlterTable
ALTER TABLE "Strategy" ADD COLUMN     "audienceSegments" JSONB,
ADD COLUMN     "channelPlan" JSONB,
ADD COLUMN     "contentApproach" JSONB,
ADD COLUMN     "expectedOutcome" JSONB,
ADD COLUMN     "reachSequence" JSONB,
ADD COLUMN     "statHighlights" JSONB,
ADD COLUMN     "approvedAt" TIMESTAMP(3);
