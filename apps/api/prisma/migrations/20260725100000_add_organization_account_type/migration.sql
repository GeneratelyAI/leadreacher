-- "individual" | "company", captured at signup so the org's name/identity
-- and any future team-only UI (invites, seats) can key off it.
ALTER TABLE "Organization" ADD COLUMN "accountType" TEXT NOT NULL DEFAULT 'individual';
