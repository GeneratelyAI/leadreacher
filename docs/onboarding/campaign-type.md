# Campaign Type

## Purpose

This step selects the delivery model for the first campaign. The selection is
persisted on Strategy and determines the allowed video decision that follows.

## Available types

| Type | Intended use | Video model |
| --- | --- | --- |
| `personalized_outreach` | Lead-generation outreach that benefits from a tailored opening | Campaign template plus a unique greeting and composed asset per lead |
| `ai_video_ad` | One AI-generated video reused across a campaign | Standardized generated video |
| `uploaded_video` | A campaign that uses customer-supplied media | Uploaded video |

## Implementation notes

- The UI writes the selection through `PATCH /strategy/:orgId/campaign-type`.
- A campaign type must exist before Video Decision accepts configuration.
- The choice is a setup decision, not a campaign launch. No prospects are sent
  messages and no campaign is silently created here.

## Product boundary

The selection should describe what will be created, not promise unsupported
channel behavior. Actual outreach starts only after a campaign exists, prospects
are approved, and a user confirms launch.
