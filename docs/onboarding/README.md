# Onboarding

Onboarding turns a new organization's website and business context into a
configured, paid, channel-connected workspace. The route is
`/onboarding?step=<step>` and is only available to authenticated organizations
that have not completed onboarding.

## Flow

1. [Discovery](discovery.md)
2. [Strategy](strategy.md)
3. [Campaign type](campaign-type.md)
4. [Video decision](video-decision.md)
5. [Checkout](checkout.md)
6. [Channels](channels.md)
7. [Onboarding system design](system-design.md)
8. [Implementation map for AI agents](implementation-map.md)

## Completion and resume behavior

- The server calculates a safe resume target from persisted Strategy and billing
  data when a step parameter is missing or invalid.
- Strategy has internal substeps: `how-it-works`, `targeting`, and `channels`.
- Checkout success moves the user to Channels.
- Completing channel setup approves and enrolls the prospects produced by the
  saved audience analysis, launches the first LinkedIn campaign through the
  standard guarded launch service, records `Organization.onboardedAt`, and sends
  the user to `/dashboard`.
- Returning users with `onboardedAt` are redirected away from `/onboarding` to
  the dashboard.

## Design choices

- The flow asks for decisions only after enough business context exists to make
  them useful.
- It persists decisions incrementally so refresh, browser navigation, and login
  resumes do not silently discard work.
- The final button explicitly says **Finish and launch** and explains its effect.
  This is the user's confirmation for the first campaign. Campaigns created
  later in the dashboard still require explicit enrollment and launch.

## Implementation entry point

Before changing an onboarding component, read the
[AI implementation guide](../IMPLEMENTATION_GUIDE.md) and the
[onboarding implementation map](implementation-map.md). They identify the
canonical route state, API ownership, persistence boundary, and tests for each
step.

## Public demo mode

The optional public demo is a side-effect-free rendering of the production
onboarding journey:

- `DEMO_ONBOARDING_ENABLED=true` enables `/demo/onboarding` and
  `/demo/dashboard` and branches landing-page website submissions into the
  demo.
- Demo progress is versioned and stored only in the current tab's
  `sessionStorage` under `lr_demo_onboarding_v1`.
- Demo signup does not create a Supabase account or organization.
- After simulated signup, the demo renders the same `OnboardingFlow`, step
  components, chrome, motion, responsive layout, and theme behavior as the
  authenticated product.
- The shared API client swaps to deterministic browser fixtures on the demo
  pathname. The submitted website is normalized for display but is not scraped.
- Checkout uses the production checkout presentation but never loads Stripe;
  channel completion never opens Unipile.
- `/onboarding-preview` remains a separate internal visual-development tool
  controlled by `ENABLE_ONBOARDING_PREVIEW`.

The feature defaults to disabled. Disabling it requires no data cleanup because
the demo performs no backend writes.
