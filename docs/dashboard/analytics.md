# Analytics

## Function

Analytics provides factual campaign and channel reporting from persisted
outreach activity.

## Current implementation

`/dashboard/analytics` reports sent, received, delivered, replied, and meeting
totals from persisted Message and Lead records, plus per-channel send/receive
counts and campaign prospect coverage.

## Required capabilities

- Time ranges, accepted rates, advanced campaign outcomes, and video-quality
  reporting remain future work.

## Data rules

Do not show forecast percentages, positive-reply rates, video-view rates, or
period-over-period trends until the underlying event data and definitions exist.
Empty charts are preferable to invented evidence.
