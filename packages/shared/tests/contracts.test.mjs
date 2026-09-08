import assert from "node:assert/strict";
import { test } from "node:test";
import { CAMPAIGN_TYPES, CONTENT_CHOICES } from "../dist/campaign.js";
import { OUTREACH_CHANNELS, SEQUENCE_STEP_TYPES } from "../dist/delivery.js";

test("preserves persisted campaign values and ordering", () => {
  assert.deepEqual(CAMPAIGN_TYPES, ["personalized_outreach", "ai_video_ad", "uploaded_video"]);
});

test("preserves the document distinction without adding a persisted campaign enum", () => {
  assert.deepEqual(CONTENT_CHOICES, ["personalized-video", "ai-video", "your-video", "document"]);
  assert.equal(CAMPAIGN_TYPES.includes("document"), false);
});

test("preserves channel and sequence identifiers without provider tokens", () => {
  assert.deepEqual(OUTREACH_CHANNELS, ["linkedin", "whatsapp", "facebook", "instagram", "email"]);
  assert.deepEqual(SEQUENCE_STEP_TYPES, ["linkedin_invite", "linkedin_message", "whatsapp_message", "facebook_message", "instagram_message", "email"]);
});
