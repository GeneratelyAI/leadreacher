---
goal: Build a gated, end-to-end LeadReacher demo onboarding that reuses the production experience without creating accounts, charges, integrations, uploads, or campaigns
version: 1.0
date_created: 2026-08-30
last_updated: 2026-08-30
owner: LeadReacher Product and Engineering
status: In progress
tags: [feature, onboarding, demo, frontend, architecture, accessibility, testing]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This plan adds a public, feature-gated demo onboarding that begins from the existing landing-page website field and proceeds through the same visual onboarding screens as production. Demo mode must feel complete and interactive, including simulated signup, strategy generation, campaign selection, video or file choices, checkout, channel/API connection, and a final demo workspace. It must never create a Supabase account, mutate production onboarding data, initialize Stripe, open Unipile hosted authentication, upload files, launch workers, send outreach, or expose real credentials.

The implementation keeps the existing `/onboarding-preview` route as an internal visual-development tool controlled by `ENABLE_ONBOARDING_PREVIEW`. The new customer-facing demo is controlled independently by the server-side `DEMO_ONBOARDING_ENABLED` boolean and uses `/demo/onboarding` plus `/demo/dashboard`. Production onboarding remains authoritative and unchanged when the new flag is disabled.

## 1. Requirements & Constraints

- **REQ-001**: Add the server-side environment variable `DEMO_ONBOARDING_ENABLED` with a default effective value of `false`; only the exact string `"true"` enables demo routes and landing-page demo entry.
- **REQ-002**: Preserve `ENABLE_ONBOARDING_PREVIEW` exclusively for `/onboarding-preview`; do not reuse it to enable the customer-facing demo.
- **REQ-003**: When `DEMO_ONBOARDING_ENABLED` is `false`, submitting a valid website on the landing page must retain the existing anonymous scrape and `/signup` behavior.
- **REQ-004**: When `DEMO_ONBOARDING_ENABLED` is `true`, submitting a valid website on the landing page must initialize a demo session and navigate to `/demo/onboarding?step=signup`; loading the landing page alone must not redirect.
- **REQ-005**: Direct requests to `/demo/onboarding` and `/demo/dashboard` must return Next.js `notFound()` when the demo flag is disabled.
- **REQ-006**: Define one explicit mode type, `OnboardingMode = "production" | "demo" | "preview"`, and pass it through onboarding composition instead of inferring behavior from the pathname inside individual screens.
- **REQ-007**: Reuse production onboarding chrome, cards, typography, theme tokens, responsive rules, transitions, and step components wherever their behavior can be injected safely; do not create a second visual design system.
- **REQ-008**: The demo must provide these ordered scenes: demo signup, Discovery, Strategy, Campaign Type, Video/File Setup, Demo Checkout, Connect Data, and Demo Complete.
- **REQ-009**: Demo signup must visually resemble the normal account-creation entry point but use a single `Continue demo` action, require no password, CAPTCHA, email confirmation, Supabase user, or organization, and display a persistent `Demo workspace` label.
- **REQ-010**: Demo Discovery must be usable both after landing-page entry and by a direct demo-route load. A direct load must receive the deterministic default website `https://acme.example` and must never show the production-only message instructing the user to return to the homepage.
- **REQ-011**: Demo strategy generation must use deterministic, versioned fixtures in the first release. It may echo the submitted domain, but all inferred company, audience, and strategy copy must be labeled as sample demo output and must not be represented as a live scrape result.
- **REQ-012**: Preserve production campaign-type order and values for existing types while presenting the requested visual hierarchy in demo mode: Instant Ad (`ai_video_ad`), Personalized Ad (`personalized_outreach`), Upload Video (`uploaded_video`), then Build From a File (`build_from_file_demo`).
- **REQ-013**: `build_from_file_demo` is a demo-state value only. It must not be sent to `/strategy/:orgId/campaign-type`, billing, pricing, campaign creation, or any production API until product semantics, persistence, and pricing are approved separately.
- **REQ-014**: Demo upload interactions must store only browser-local file metadata and, when a local preview is required, a temporary object URL. No file bytes may be sent to the API, Supabase Storage, R2, or another provider.
- **REQ-015**: Demo checkout must reuse the checkout visual composition, display `Demo mode: no payment will be processed`, use a `Continue demo` action, and never load Stripe.js, mount Stripe Elements, or request a checkout session.
- **REQ-016**: Replace the production Channels scene in demo mode with a `Connect your data` scene containing LinkedIn, CRM, Email, API, and Upload CSV choices plus a `Connect later` action.
- **REQ-017**: The demo API connection panel must show a clearly fictional masked key, example base URL, webhook field, and deterministic test-connection states; it must never create, reveal, validate, or persist a real API credential.
- **REQ-018**: LinkedIn, CRM, Email, API, and CSV connection actions must use interruptible simulated progress with deterministic success and retry fixtures and must never open Unipile OAuth or call integration endpoints.
- **REQ-019**: Completion must navigate to `/demo/dashboard`, render only deterministic fixture data, and provide a `Restart demo` action that clears the current demo session before returning to the landing page.
- **REQ-020**: Demo mode must never call `/auth/bootstrap`, `/billing/checkout-session`, `/social-accounts/connect`, `/onboarding/complete`, file-upload endpoints, campaign-launch endpoints, or worker-triggering endpoints.
- **REQ-021**: Demo state must survive refresh, browser back, and browser forward within one tab through versioned `sessionStorage`; it must not use production onboarding local-storage keys or persist across browser sessions.
- **REQ-022**: Demo state must include a unique session ID, normalized website, active scene, completed scenes, simulated scrape state, strategy fixture, campaign type, media choice, upload metadata, connection choices, checkout state, and completion state.
- **REQ-023**: Every persisted demo-state read must be schema-validated. Invalid, missing, or unsupported-version state must be replaced with a deterministic initial state rather than throwing during render.
- **REQ-024**: Theme changes, polling timers, simulated delays, and URL navigation must not remount completed scenes, lose selected values, or change component geometry.
- **REQ-025**: Simple option scenes may auto-advance only after the selected state is committed. Auto-advance must be disabled under `prefers-reduced-motion: reduce`, with a visible Continue action remaining available.
- **REQ-026**: All selectable cards must support pointer and keyboard input, expose selected state through accessible semantics, and restore focus to the next scene heading after navigation.
- **REQ-027**: Status messages must use complete `aria-live` phrases. Typing or character-by-character animation must never be announced to assistive technology.
- **REQ-028**: The complete demo must work without horizontal overflow at `1366x650`, `1024x600`, `390x844`, tablet widths, and 200% browser text scaling.
- **REQ-029**: Demo analytics may record scene entry, completion, abandonment, retry, and final conversion using the demo session ID, but must not record the submitted website, entered business copy, uploaded filenames, API field contents, or other user-entered content.
- **REQ-030**: The rollout must be reversible by changing only `DEMO_ONBOARDING_ENABLED=false`; no database rollback or data cleanup may be required.
- **SEC-001**: Keep the demo flag server-only. Do not use `NEXT_PUBLIC_DEMO_ONBOARDING_ENABLED`, because a public environment variable cannot guard route availability.
- **SEC-002**: Keep all demo side effects inside the browser. The demo service must reject any unrecognized operation rather than forwarding it to `apiFetch`.
- **SEC-003**: Treat all website, file, webhook, and API-key-looking input as untrusted display data; normalize URLs, escape rendered text through React, and never interpolate input into executable URLs or HTML.
- **SEC-004**: Do not put real-looking secrets in fixtures. Use an unmistakable value such as `lr_demo_••••••••demo` and mark it `Demo credential` in visible text and accessible labels.
- **SEC-005**: Revoke every object URL when the chosen file changes, the upload scene unmounts, the demo restarts, or the session completes.
- **CON-001**: The current API and billing contracts support only `personalized_outreach`, `ai_video_ad`, and `uploaded_video`; this plan does not modify those contracts.
- **CON-002**: The first release makes no backend, database, Stripe, Unipile, Supabase, R2, prospect-search, campaign-launch, or worker changes.
- **CON-003**: The existing `/onboarding`, `/signup`, and `/onboarding-preview` URL contracts must remain compatible.
- **CON-004**: Use existing React 19, Next.js 16.3, Tailwind CSS, Framer Motion, Vitest, and Playwright dependencies; add no new runtime dependency.
- **GUD-001**: Prefer composition and injected services over copying complete production step components.
- **GUD-002**: Use explicit demo copy such as `Sample strategy` and `Demo workspace` at the point where a user could otherwise mistake fixture data for a real result.
- **GUD-003**: Use the existing checkout-style violet hairline border and dark-mode variants for interactive surfaces while preserving identical dimensions across themes.
- **GUD-004**: Simulated progress should be short enough for a demo, cancellable on navigation, and deterministic under tests by allowing a zero-delay clock adapter.
- **PAT-001**: Represent demo transitions with a pure reducer and derived selectors; browser persistence and timers belong in a provider/service layer, not in the reducer.
- **PAT-002**: Route all onboarding data access through an explicit mode-specific service interface: `productionOnboardingService`, `demoOnboardingService`, or `previewOnboardingService`.
- **PAT-003**: Server-rendered pages read the flag and pass a serializable `demoEnabled` boolean to the client entry component. Client code must not read a server-only environment variable directly.

## 2. Implementation Steps

### Implementation Phase 1: Define the feature boundary and mode contracts

- GOAL-001: Establish a server-gated demo route and mode-specific interfaces without changing existing production behavior.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Create `apps/web/src/lib/features/demo-onboarding.ts` with `isDemoOnboardingEnabled(env = process.env): boolean`; return `env.DEMO_ONBOARDING_ENABLED === "true"` and export no client-side environment access. | | |
| TASK-002 | Add `DEMO_ONBOARDING_ENABLED=false` to the repository's documented web environment variable template or deployment documentation in `docs/operations/railway-production-deploy.md`; state that `ENABLE_ONBOARDING_PREVIEW` remains independent. | | |
| TASK-003 | Create `apps/web/src/lib/onboarding/mode.ts` exporting `OnboardingMode`, `OnboardingService`, supported production campaign types, and the demo-only `build_from_file_demo` union without widening existing API request types. | | |
| TASK-004 | Refactor `apps/web/src/lib/api.ts` so production behavior remains the default but onboarding consumers can receive an `OnboardingService`; retain the current `apiFetch` export for non-onboarding callers and remove new pathname-based demo branching. | | |
| TASK-005 | Adapt `apps/web/src/lib/onboarding/preview-api.ts` to implement `previewOnboardingService` while retaining `isOnboardingPreview`, existing fixture responses, and developer-toolbar behavior. | | |
| TASK-006 | Create `apps/web/src/app/demo/onboarding/page.tsx` and `apps/web/src/app/demo/dashboard/page.tsx`; call `notFound()` unless `isDemoOnboardingEnabled()` is true, then render the demo entry components. | | |
| TASK-007 | Add `apps/web/src/app/demo/layout.tsx` using `PageSurface` and the same `onboarding-root` shell as `apps/web/src/app/onboarding/layout.tsx`; do not add authentication redirects. | | |
| TASK-008 | Extend `apps/web/src/components/onboarding/steps/steps.ts` with mode-aware href generation so production generates `/onboarding`, preview generates `/onboarding-preview`, and demo generates `/demo/onboarding`; preserve the existing exported helpers as production-compatible wrappers. | | |

Completion criteria for GOAL-001:

- With the flag absent or false, both demo routes return 404 and the existing production and preview routes render unchanged.
- With the flag true, both demo routes render without an authenticated Supabase session.
- TypeScript rejects passing `build_from_file_demo` to a production onboarding service method.

### Implementation Phase 2: Build versioned, session-scoped demo state

- GOAL-002: Provide deterministic state, persistence, fixtures, and simulated operations with zero external side effects.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-009 | Create `apps/web/src/lib/onboarding/demo-store.ts` defining `DEMO_STATE_VERSION = 1`, `DEMO_STORAGE_KEY = "lr_demo_onboarding_v1"`, `DemoOnboardingScene`, `DemoOnboardingState`, reducer actions, initial-state factory, selectors, and a runtime parser that rejects invalid persisted values. | | |
| TASK-010 | Define the exact scene union as `signup | discovery | strategy | campaign-type | media | checkout | connect | complete`, and constrain URL parsing to this list. Unknown `step` values must resolve to the earliest incomplete scene. | | |
| TASK-011 | Store `sessionId`, `website`, `activeScene`, `completedScenes`, `signup`, `scrapeStatus`, `strategy`, `campaignType`, `media`, `upload`, `checkoutComplete`, `connections`, and `completed` in `DemoOnboardingState`; never store a password, raw file, full API-key value, or production identifier. | | |
| TASK-012 | Create `apps/web/src/lib/onboarding/demo-fixtures.ts` containing frozen and versioned default, slow, failed, missing-data, and connection-retry fixtures. Mark all fixture company and strategy output as sample data. | | |
| TASK-013 | Create `apps/web/src/lib/onboarding/demo-api.ts` implementing `OnboardingService` against the reducer. Implement deterministic async operations through an injectable clock, support cancellation with `AbortSignal`, and throw a typed `DemoUnsupportedOperationError` for unknown operations. | | |
| TASK-014 | Create `apps/web/src/components/onboarding/demo/DemoOnboardingProvider.tsx`; initialize from validated `sessionStorage`, persist after reducer commits, expose reset and navigation actions, and cancel all active timers and object URLs on teardown. | | |
| TASK-015 | Add a mode-aware Discovery adapter so demo state supplies a normalized website and fixture status directly. Do not write `lr_website_url`, `lr_anon_scrape_id`, or discovery organization scope keys in demo mode. | | |
| TASK-016 | Add a deterministic direct-load fallback: when `/demo/onboarding` has no session, create a session with `https://acme.example`, set `scrapeStatus` to `idle`, and begin at `signup`; never show `NO_WEBSITE_MESSAGE` from `useWebsiteScrapeStatus`. | | |

Completion criteria for GOAL-002:

- Refreshing any demo scene restores all prior choices in the same tab.
- Corrupt or future-version session data safely resets to the initial demo state.
- Searching recorded browser requests during a full flow finds no API mutation, Stripe, Unipile, Supabase auth, storage upload, worker, or campaign launch request.

### Implementation Phase 3: Branch the landing-page entry safely

- GOAL-003: Enter demo onboarding from the existing landing-page website field only when the server flag is enabled.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-017 | Update `apps/web/src/app/page.tsx` to call `isDemoOnboardingEnabled()` on the server and pass `demoEnabled` to `Hero`; keep the default value false for tests and isolated rendering. | | |
| TASK-018 | Update `apps/web/src/components/landing/hero/Hero.tsx`: after existing URL normalization, when `demoEnabled` is true, initialize the demo session with the normalized domain and navigate to `/demo/onboarding?step=signup`; do not call `waitForReadyToNavigate` or write anonymous scrape keys in this branch. | | |
| TASK-019 | Preserve the existing `runAnalysis` code path without observable changes when `demoEnabled` is false, including validation, anonymous scrape, minimum progress, error handling, local-storage keys, and `/signup` navigation. | | |
| TASK-020 | Add a visible but restrained `Interactive demo` label near the landing submit action only when the flag is true so users understand that submission starts a demo rather than account creation. | | |

Completion criteria for GOAL-003:

- Flag false reproduces the current landing E2E request sequence and `/signup` redirect.
- Flag true creates only session-scoped demo state and reaches demo signup without contacting the anonymous scrape endpoints.
- Visiting `/` without submitting never starts or resumes the demo automatically.

### Implementation Phase 4: Compose the demo onboarding shell and signup

- GOAL-004: Reuse the onboarding visual system in a demo-specific, auth-free flow with stable navigation.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-021 | Extend `apps/web/src/components/onboarding/OnboardingFlow.tsx` to accept `mode`, `service`, and a scene controller. Preserve its current production props as defaults and keep preview toolbar ownership in `apps/web/src/app/onboarding-preview/page.tsx`. | | |
| TASK-022 | Update `apps/web/src/components/onboarding/OnboardingChrome.tsx` to render a persistent `Demo workspace` badge for demo mode and preserve identical layout measurements in light and dark themes. | | |
| TASK-023 | Create `apps/web/src/components/onboarding/demo/DemoSignup.tsx` with website identity, name, email, current analysis activity, and one `Continue demo` button; omit password, social auth, account creation, and legal-consent mutations. | | |
| TASK-024 | Implement scene navigation by writing `history.pushState` only after reducer state commits. Add a `popstate` subscriber that resolves the requested scene against completed-scene guards without remounting the provider. | | |
| TASK-025 | Restore focus to each new scene's `h1`, announce the complete scene title once, and retain Back and Continue controls in fixed-safe action regions across supported viewport sizes. | | |
| TASK-026 | Add reduced-motion behavior that skips staged progress and auto-advance delays while keeping all final states, selection feedback, and manual navigation controls visible. | | |

Completion criteria for GOAL-004:

- Demo signup completes without an auth network request.
- Browser Back and Forward restore the expected scene and persisted selection.
- Toggling theme during transitions changes color only; bounding-box snapshots for principal content and controls remain equal within 1 CSS pixel.

### Implementation Phase 5: Adapt Discovery, Strategy, campaign, and media scenes

- GOAL-005: Make the core onboarding screens fully interactive in demo mode while preserving production logic.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-027 | Adapt `apps/web/src/components/onboarding/steps/Discovery.tsx` to consume the injected onboarding service. In demo mode, show fixture activity states, sample-data disclosure, retry, and deterministic generated insights; in production, retain bootstrap and real status behavior. | | |
| TASK-028 | Adapt `apps/web/src/components/onboarding/steps/Strategy.tsx` to receive demo fixture strategy through the service, preserve the current presentation and interactions, and prevent production strategy generation calls in demo mode. | | |
| TASK-029 | Refactor option metadata in `apps/web/src/components/onboarding/steps/CampaignGoal.tsx` into a mode-aware configuration. For demo mode render Instant Ad, Personalized Ad, Upload Video, and Build From a File in that order; for production and preview preserve supported contracts. | | |
| TASK-030 | Add the demo-only Build From a File card with copy describing file-led campaign setup. Display a `Demo option` badge and route it only to the demo media scene; never serialize it into production strategy data. | | |
| TASK-031 | Adapt `apps/web/src/components/onboarding/steps/VideoSetup.tsx` to accept the service and selected demo campaign type. Preserve existing generated and upload-video presentations and add a demo-only file picker for `build_from_file_demo`. | | |
| TASK-032 | Implement demo upload validation for allowed fixture formats and a conservative browser-only size cap. Store only `{ name, size, type, lastModified }`; show a temporary local preview only when the MIME type is supported and revoke it per SEC-005. | | |
| TASK-033 | Ensure all simple selections commit to the reducer before optional auto-advance. Cancel pending auto-advance when the user changes selection, navigates back, toggles reduced motion, or leaves the scene. | | |

Completion criteria for GOAL-005:

- Every scene can complete through pointer and keyboard interaction.
- Demo mode produces zero production API calls while production mode continues to use current endpoints.
- Campaign cards appear in the requested demo hierarchy and all text fits without clipping at the required viewports and 200% scaling.
- No fake people, real prospect claims, or production-success claims appear in the demo strategy.

### Implementation Phase 6: Implement side-effect-free checkout and data connection

- GOAL-006: Complete the demo journey with credible checkout and integration experiences that cannot affect external systems.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-034 | Extract the presentational sections of `apps/web/src/components/onboarding/steps/Checkout.tsx` from Stripe orchestration so the demo can reuse layout and summary rendering without importing or mounting payment providers. | | |
| TASK-035 | Create `apps/web/src/components/onboarding/demo/DemoCheckout.tsx` using the extracted presentation, selected campaign summary, fictional payment display values, the disclosure `Demo mode: no payment will be processed`, and a `Continue demo` action that only dispatches `checkoutCompleted`. | | |
| TASK-036 | Create `apps/web/src/components/onboarding/demo/DemoApiConnection.tsx` with cards for LinkedIn, CRM, Email, API, and Upload CSV. Include selection state, accessible progress announcements, retry controls, and `Connect later`. | | |
| TASK-037 | Add the API detail panel with a fictional masked credential, example request URL, webhook input, Copy buttons that copy only fictional values, and an injectable test-connection operation with idle, testing, success, and failure states. | | |
| TASK-038 | Add simulated connection operations for LinkedIn, CRM, and Email that remain on-page, cancel on navigation, and never set `window.location` to provider URLs. | | |
| TASK-039 | Add a browser-only CSV chooser that displays file metadata and a deterministic sample validation result without reading or uploading full customer records. Clear its metadata and revoke previews on reset. | | |
| TASK-040 | Create `apps/web/src/components/onboarding/demo/DemoDashboard.tsx` and render it from `/demo/dashboard`; show selected campaign, strategy summary, and connected-demo sources using fixtures, plus `Restart demo` and `Create a real workspace` links. | | |
| TASK-041 | Implement `Restart demo` as a single provider action that cancels timers, revokes object URLs, removes only `lr_demo_onboarding_v1`, and navigates to `/`; do not clear production auth or discovery keys. | | |

Completion criteria for GOAL-006:

- No Stripe script, iframe, payment request, hosted-auth redirect, API-key request, upload request, or onboarding-complete request occurs during the full demo.
- Demo checkout and connection screens match the production onboarding design tokens in both themes.
- Completion and restart work after refresh and do not alter existing user authentication or production onboarding state.

### Implementation Phase 7: Add observability, regression coverage, and controlled rollout

- GOAL-007: Prove demo isolation, accessibility, responsiveness, and production non-regression before enabling the flag.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-042 | Add allowlisted demo analytics events in the existing telemetry layer: `demo_started`, `demo_scene_viewed`, `demo_scene_completed`, `demo_retry`, `demo_completed`, and `demo_restarted`; include only session ID and enum-valued scene metadata. | | |
| TASK-043 | Add reducer and parser tests in `apps/web/src/lib/onboarding/__tests__/demo-store.test.ts` covering every action, invalid state, version mismatch, resume selection, reset, and out-of-order async completion. | | |
| TASK-044 | Add service tests in `apps/web/src/lib/onboarding/__tests__/demo-api.test.ts` covering deterministic fixtures, cancellation, retry states, unsupported-operation rejection, and the absence of production fetch delegation. | | |
| TASK-045 | Extend `apps/web/e2e/landing-hero.spec.ts` with separate flag-disabled and flag-enabled projects or server configurations. Assert the existing scrape flow when false and session-only demo routing when true. | | |
| TASK-046 | Add `apps/web/e2e/demo-onboarding.spec.ts` covering direct entry, landing entry, signup, slow and failed discovery, strategy retry, all campaign branches, file metadata, checkout, each connection choice, connect-later, completion, restart, refresh, Back, and Forward. | | |
| TASK-047 | In `apps/web/e2e/demo-onboarding.spec.ts`, fail the test on any request matching Supabase auth, anonymous scrape, authenticated onboarding mutations, Stripe, Unipile, upload, worker, campaign launch, or `/onboarding/complete`. | | |
| TASK-048 | Add accessibility coverage for keyboard-only completion, focus restoration, selected-state semantics, complete live-region phrases, reduced motion, and automated accessibility checks using the repository's existing tooling. | | |
| TASK-049 | Add stable visual captures for desktop light, desktop dark, `1366x650`, `1024x600`, tablet, `390x844`, and zoom-equivalent widths. Assert no horizontal overflow and no theme-induced geometry shift. | | |
| TASK-050 | Run `pnpm --filter @leadreacher/web lint`, `pnpm --filter @leadreacher/web test`, `pnpm --filter @leadreacher/web build`, and `pnpm --filter @leadreacher/web test:e2e -- demo-onboarding.spec.ts landing-hero.spec.ts`; record failures and fixes before rollout. | | |
| TASK-051 | Enable `DEMO_ONBOARDING_ENABLED=true` in a non-production environment, complete internal QA, review analytics and client errors, then enable production explicitly. Roll back by setting the flag to false. | | |
| TASK-052 | Update `docs/onboarding/README.md` and `docs/onboarding/implementation-map.md` with demo mode boundaries, routes, state ownership, fixture disclosures, and the guarantee that real prospect discovery begins only in the real product. | | |

Completion criteria for GOAL-007:

- All specified static checks, unit tests, targeted E2E tests, accessibility checks, and production build pass.
- The full-flow network denylist records zero prohibited requests.
- Production onboarding, sign-up, preview, billing, and channel connection regression tests pass with the flag false.
- Operations can disable the demo without a deploy-time data migration or cleanup job.

## 3. Alternatives

- **ALT-001**: Reuse `ENABLE_ONBOARDING_PREVIEW` and redirect users into `/onboarding-preview`. Rejected because preview exposes developer controls, uses pathname-driven fixtures, is optimized for isolated screen review, and is not a customer-safe continuous journey.
- **ALT-002**: Create a fully separate set of demo pages by copying every onboarding component. Rejected because it would immediately diverge from production styling, accessibility, responsiveness, and copy, while doubling maintenance cost.
- **ALT-003**: Let the demo call production APIs with a shared demo account. Rejected because concurrent sessions would collide, user input could persist, external integrations could be triggered, rate limits could be consumed, and the experience would be unreliable.
- **ALT-004**: Perform a real public website scrape in the first release. Rejected for MVP because rate limits, latency, untrusted content, and provider failures reduce demo reliability. A later `DEMO_ONBOARDING_DATA_MODE=fixture|live` can be considered only with a dedicated public, rate-limited, ephemeral endpoint and explicit sample/live labeling.
- **ALT-005**: Add `build_from_file` immediately to the API and billing enums. Rejected because the requested option's meaning, storage behavior, campaign execution semantics, and pricing are not yet defined. The demo-only type safely validates the interaction before production adoption.
- **ALT-006**: Store demo state in local storage or the database. Rejected because the demo should reset naturally with the browser session, avoid cross-session tracking, and require no cleanup.

## 4. Dependencies

- **DEP-001**: Next.js 16.3 server components, `notFound()`, and App Router pages for server-side feature gating.
- **DEP-002**: Existing `apps/web/src/components/onboarding` components and onboarding design tokens.
- **DEP-003**: Existing Framer Motion integration and reduced-motion utilities for interruptible transitions.
- **DEP-004**: Browser `sessionStorage`, History API, `AbortController`, Web Animations support already targeted by the web application, and object URL APIs for local previews.
- **DEP-005**: Existing Vitest and Playwright configuration under `apps/web`.
- **DEP-006**: Product approval is required before promoting `build_from_file_demo` into production API, persistence, billing, or campaign execution contracts; that promotion is outside this plan.
- **DEP-007**: Deployment configuration must support a server-side `DEMO_ONBOARDING_ENABLED` value independently for local, staging, and production environments.

## 5. Files

- **FILE-001**: `apps/web/src/app/page.tsx`: read the server flag and pass `demoEnabled` to the landing Hero.
- **FILE-002**: `apps/web/src/components/landing/hero/Hero.tsx`: branch validated website submission into demo or existing production analysis.
- **FILE-003**: `apps/web/src/app/demo/layout.tsx`: new shared demo page surface and onboarding shell.
- **FILE-004**: `apps/web/src/app/demo/onboarding/page.tsx`: new guarded demo onboarding route.
- **FILE-005**: `apps/web/src/app/demo/dashboard/page.tsx`: new guarded demo completion route.
- **FILE-006**: `apps/web/src/lib/features/demo-onboarding.ts`: new server-only feature-flag helper.
- **FILE-007**: `apps/web/src/lib/onboarding/mode.ts`: new mode and onboarding service contracts.
- **FILE-008**: `apps/web/src/lib/onboarding/demo-store.ts`: new reducer, schema parser, selectors, serialization, and reset behavior.
- **FILE-009**: `apps/web/src/lib/onboarding/demo-fixtures.ts`: new deterministic and disclosed fixture scenarios.
- **FILE-010**: `apps/web/src/lib/onboarding/demo-api.ts`: new side-effect-free demo service.
- **FILE-011**: `apps/web/src/lib/onboarding/preview-api.ts`: adapt existing preview fixtures to the shared service interface without changing preview output.
- **FILE-012**: `apps/web/src/lib/api.ts`: preserve general API calls and support explicit onboarding service injection.
- **FILE-013**: `apps/web/src/components/onboarding/demo/DemoOnboardingProvider.tsx`: new session persistence and operation lifecycle owner.
- **FILE-014**: `apps/web/src/components/onboarding/demo/DemoSignup.tsx`: new simulated signup scene.
- **FILE-015**: `apps/web/src/components/onboarding/demo/DemoCheckout.tsx`: new checkout presentation without Stripe.
- **FILE-016**: `apps/web/src/components/onboarding/demo/DemoApiConnection.tsx`: new LinkedIn, CRM, Email, API, and CSV demo connection scene.
- **FILE-017**: `apps/web/src/components/onboarding/demo/DemoDashboard.tsx`: new deterministic final workspace.
- **FILE-018**: `apps/web/src/components/onboarding/OnboardingFlow.tsx`: compose explicit production, preview, and demo modes.
- **FILE-019**: `apps/web/src/components/onboarding/OnboardingChrome.tsx`: add stable demo-workspace disclosure.
- **FILE-020**: `apps/web/src/components/onboarding/steps/steps.ts`: add mode-aware routes and demo scene parsing.
- **FILE-021**: `apps/web/src/components/onboarding/steps/Discovery.tsx`: consume mode-specific website and strategy status.
- **FILE-022**: `apps/web/src/components/onboarding/steps/Strategy.tsx`: consume fixture strategy in demo mode without changing production generation.
- **FILE-023**: `apps/web/src/components/onboarding/steps/CampaignGoal.tsx`: support requested demo hierarchy and demo-only file option.
- **FILE-024**: `apps/web/src/components/onboarding/steps/VideoSetup.tsx`: support browser-only demo media selection.
- **FILE-025**: `apps/web/src/components/onboarding/steps/Checkout.tsx`: separate presentation from Stripe orchestration for safe reuse.
- **FILE-026**: `apps/web/src/hooks/useWebsiteScrapeStatus.ts`: expose or adapt the status contract so demo does not depend on production storage; retain production behavior.
- **FILE-027**: `apps/web/src/lib/onboarding/__tests__/demo-store.test.ts`: new reducer and persistence tests.
- **FILE-028**: `apps/web/src/lib/onboarding/__tests__/demo-api.test.ts`: new service isolation tests.
- **FILE-029**: `apps/web/e2e/demo-onboarding.spec.ts`: new end-to-end demo journey and network denylist.
- **FILE-030**: `apps/web/e2e/landing-hero.spec.ts`: add flag branch coverage while preserving current landing checks.
- **FILE-031**: `apps/web/playwright.config.ts`: add or document the demo-enabled test server/project configuration if the existing configuration cannot vary server environment per project.
- **FILE-032**: `docs/onboarding/README.md`: document the user-facing demo and its safety boundaries.
- **FILE-033**: `docs/onboarding/implementation-map.md`: document mode/service/state architecture.
- **FILE-034**: `docs/operations/railway-production-deploy.md`: document the independent server flag and rollback action.

## 6. Testing

- **TEST-001**: Verify `isDemoOnboardingEnabled` returns true only for the exact string `"true"` and false for undefined, empty, `false`, `1`, or differently cased values.
- **TEST-002**: Verify disabled demo routes return 404 and enabled routes do not require a Supabase session.
- **TEST-003**: Verify flag-disabled landing submission preserves anonymous scrape calls, storage keys, error handling, and `/signup` routing.
- **TEST-004**: Verify flag-enabled landing submission makes no anonymous scrape request, stores a normalized website only in demo session state, and reaches demo signup.
- **TEST-005**: Verify reducer transitions, completed-scene guards, serialization, schema validation, corrupt-state recovery, version mismatch, and reset.
- **TEST-006**: Verify late completion from a cancelled or previous simulated operation cannot overwrite the current scene or selection.
- **TEST-007**: Verify direct `/demo/onboarding` entry uses the deterministic default website and never displays the homepage URL error.
- **TEST-008**: Verify demo signup makes no Supabase auth or organization bootstrap request.
- **TEST-009**: Verify Discovery supports running, completed, failed, retry, slow, and missing-data fixtures and visibly identifies sample output.
- **TEST-010**: Verify campaign card order is Instant Ad, Personalized Ad, Upload Video, Build From a File in demo mode and unchanged for production mode.
- **TEST-011**: Verify `build_from_file_demo` cannot be passed to a production service or pricing function at compile time and runtime boundaries.
- **TEST-012**: Verify file selection stores metadata only, unsupported files are rejected accessibly, and every object URL is revoked on replacement, unmount, completion, and reset.
- **TEST-013**: Verify demo checkout never loads Stripe resources and `Continue demo` only changes session state.
- **TEST-014**: Verify each data-connection card supports success, failure, retry, cancellation, and Connect Later without provider redirects or external calls.
- **TEST-015**: Verify API connection displays only fictional credentials and analytics capture no user-entered API or webhook values.
- **TEST-016**: Verify `/demo/dashboard` displays only fixture/session summary data and restart removes only the demo storage key.
- **TEST-017**: Verify refresh, Back, and Forward preserve committed data and resolve inaccessible future scenes to the earliest incomplete scene.
- **TEST-018**: Verify keyboard-only completion, focus restoration, selected-state semantics, live-region phrases, and visible focus indicators.
- **TEST-019**: Verify reduced motion removes stagger, typing, path drawing, and timed auto-advance while preserving complete content and manual controls.
- **TEST-020**: Verify light/dark switches during every simulated progress state preserve content and principal component geometry within 1 CSS pixel.
- **TEST-021**: Verify no horizontal overflow, clipped actions, or hidden content at `1366x650`, `1024x600`, `390x844`, tablet widths, and 200% scaling.
- **TEST-022**: Verify a full demo registers zero requests to Supabase auth, production discovery, Stripe, Unipile, upload, campaign launch, worker, and `/onboarding/complete` endpoints.
- **TEST-023**: Verify `/onboarding-preview` still renders deterministic preview fixtures and its toolbar independently of the demo flag.
- **TEST-024**: Verify production onboarding resume logic, billing, channel connection, and completion tests remain green with the demo flag false.
- **TEST-025**: Run web lint, Vitest, production build, targeted Playwright suites, and accessibility checks before enabling the flag outside local development.

## 7. Risks & Assumptions

- **RISK-001**: Reusing components that contain embedded API calls could accidentally trigger production effects. Mitigation: require injected services, maintain an E2E request denylist, and make the demo service reject unknown operations.
- **RISK-002**: Fixture results may be mistaken for a real scrape. Mitigation: show `Sample strategy` and `Demo workspace` disclosures adjacent to generated-looking content and never claim the submitted site was actually analyzed.
- **RISK-003**: A public demo can become an abuse surface if live scraping is introduced. Mitigation: keep MVP fixture-only; require a separate rate-limited ephemeral endpoint and security review before enabling live data.
- **RISK-004**: Component extraction from Checkout could regress Stripe behavior. Mitigation: extract presentation only, keep payment orchestration in the production wrapper, and run existing billing E2E coverage.
- **RISK-005**: Timed auto-advance can disorient users or race navigation. Mitigation: commit state first, cancel every timer, disable timing under reduced motion, and always preserve manual navigation.
- **RISK-006**: Browser-stored file previews can leak memory. Mitigation: centralize object URL ownership and test revocation on all lifecycle exits.
- **RISK-007**: The demo-only file campaign may create false expectations about a production feature. Mitigation: label it `Demo option`, keep it out of production pricing/contracts, and require a separate product decision before launch beyond the demo.
- **RISK-008**: A single boolean enabled globally may expose unfinished work. Mitigation: default false, guard routes server-side, validate in staging, and retain one-variable rollback.
- **ASSUMPTION-001**: The requested “boolean” refers to a new customer-facing demo gate; the current `ENABLE_ONBOARDING_PREVIEW` remains an internal preview gate and is not equivalent.
- **ASSUMPTION-002**: “Bull game” in the discussion refers to a boolean/feature gate, not a separate existing runtime system.
- **ASSUMPTION-003**: “Build From a File” is intentionally demonstrated before its final production meaning is settled; it does not authorize API schema or billing changes.
- **ASSUMPTION-004**: The demo should resemble the complete onboarding and preserve its navigation model, not replace production onboarding or sign-up.
- **ASSUMPTION-005**: The first release values reliability and safety over real-time website analysis, so deterministic fixtures are acceptable when disclosed clearly.

## 8. Related Specifications / Further Reading

- [`docs/onboarding/README.md`](../docs/onboarding/README.md)
- [`docs/onboarding/system-design.md`](../docs/onboarding/system-design.md)
- [`docs/onboarding/implementation-map.md`](../docs/onboarding/implementation-map.md)
- [`docs/onboarding/discovery.md`](../docs/onboarding/discovery.md)
- [`docs/onboarding/campaign-type.md`](../docs/onboarding/campaign-type.md)
- [`docs/onboarding/checkout.md`](../docs/onboarding/checkout.md)
- [`docs/onboarding/channels.md`](../docs/onboarding/channels.md)
- [`docs/operations/railway-production-deploy.md`](../docs/operations/railway-production-deploy.md)
- [Next.js App Router documentation](https://nextjs.org/docs/app)
- [Framer Motion accessibility guidance](https://motion.dev/docs/react-accessibility)
- [MDN: Window sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)
