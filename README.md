# LeadReacher

pnpm + Turborepo monorepo for the LeadReacher product.

## Structure

```
leadreacher/
├── apps/
│   ├── web/          # Next.js marketing site (@leadreacher/web)
│   └── api/          # Fastify API server (@leadreacher/api)
├── packages/
│   └── shared/       # Shared TypeScript types (@leadreacher/shared)
├── .env.local        # Local environment variables (root)
├── package.json      # Workspace root
├── pnpm-workspace.yaml
└── turbo.json
```

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+

## Getting started

Install dependencies from the repository root:

```bash
pnpm install
```

Run all apps in development:

```bash
pnpm dev
```

Run a single app:

```bash
pnpm dev:web   # Next.js on http://localhost:3000
pnpm dev:api   # Fastify on http://localhost:3001
```

## Scripts

| Command       | Description                          |
|---------------|--------------------------------------|
| `pnpm dev`    | Start all apps in dev mode (Turbo)   |
| `pnpm build`  | Build all packages and apps          |
| `pnpm lint`   | Lint all packages and apps           |
| `pnpm dev:web`| Dev server for the Next.js app only  |
| `pnpm dev:api`| Dev server for the Fastify API only  |

## Environment variables

Local secrets live in `.env.local` at the **repository root**. The Next.js app loads this file automatically via `apps/web/next.config.ts`.

Do not commit `.env.local` - it is gitignored.

## Packages

### `@leadreacher/web`

Next.js 16 app with the landing page, waitlist form, and Supabase client integration.

### `@leadreacher/api`

Fastify + TypeScript API scaffold. Default route: `GET /` → `{ "message": "Hello World" }` on port **3001**.

### `@leadreacher/shared`

Shared TypeScript types consumed by `web` and `api`. Add exports in `packages/shared/src/index.ts`.
