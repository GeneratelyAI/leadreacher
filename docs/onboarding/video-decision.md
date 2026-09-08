# Video Style Configuration

## Purpose

The content and style screens collect the video-specific configuration needed
for billing and generation. This document describes the persisted API contract,
not a standalone onboarding route.

## Variants

### Personalized outreach

- Loads or generates a first-touch LinkedIn message from persisted Strategy.
- The message contains `{{FirstName}}` and `{{Company}}` placeholders and can be
  edited by the user.
- The user selects `professional`, `casual`, or `aggressive` tone.
- The eventual media pipeline generates one campaign template and composes a
  lead-specific asset before first chat delivery.

### AI video ad

- The user selects `professional`, `casual`, or `aggressive` tone.
- The video is standardized and generated. There is no outreach-message editor
  because the asset is not individualized per prospect.

### Uploaded video

- The user supplies the campaign video through its dedicated upload flow.
- This variant is intentionally separate from AI-generated visual-source logic.

## Implementation notes

- The video-style UI persists configuration with `PATCH /strategy/:orgId/video-decision`.
- The backend rejects `enabled: false`; direct API callers cannot avoid the
  mandatory-video decision or video billing line item.
- Personalized message generation is idempotent. Existing Strategy messaging
  data is returned instead of regenerating on every page visit.

## Related architecture

See [video pipeline documentation](../video/README.md) for the template,
composition, recovery, and test design.
