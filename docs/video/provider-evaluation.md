# Video Provider Evaluation

LeadReacher supports `veo` and `omni` through the common video-provider
adapter. Provider choice must be based on a repeatable staging evaluation, not
on a single visual result.

## Fixture set

Use three safe, representative briefs:

1. A logo-forward B2B end card.
2. A direct-to-camera spokesperson opening.
3. A product-context scene with no text, metrics, or unsupported claims.

Store only synthetic or consented source assets. The checked-in fixture shape
is [`video-provider-evaluation.fixture.example.json`](../../apps/api/src/scripts/video-provider-evaluation.fixture.example.json).

## Run

```bash
cd apps/api
pnpm video:benchmark -- --fixture src/scripts/video-provider-evaluation.fixture.json
```

The script records provider, operation ID, duration, media-contract result, and
optional critic result. Record provider cost and reviewer notes alongside the
JSON output; the script does not select a production provider automatically.

## Decision criteria

Compare the same fixture set on:

- first-frame identity consistency;
- logo integrity on the end card;
- prompt compliance, including silent opening and no extra text;
- p50/p95 generation time;
- total cost per approved usable output;
- manual review rate and recovery behavior.

Keep raw evaluation output outside git when it contains provider URLs or
customer assets. Change `VIDEO_GENERATION_PROVIDER` only after a documented
staging result and a rollback plan.
