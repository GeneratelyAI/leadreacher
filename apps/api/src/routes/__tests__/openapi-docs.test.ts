import { afterEach, describe, expect, it, vi } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { openapiPlugin } from "../../plugins/openapi.js";
import { authenticatedRoute, publicRoute } from "../../lib/openapi.js";
import { healthRoutes } from "../health.js";

vi.mock("../../config/env.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../config/env.js")>();
  return {
    ...actual,
    isApiDocsEnabled: () => true,
  };
});

vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock("../../lib/redis.js", () => ({
  redis: { ping: vi.fn().mockResolvedValue("PONG") },
}));

describe("OpenAPI / Scalar docs", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it("exposes OpenAPI JSON and Scalar UI for registered Zod routes", async () => {
    app = Fastify({ logger: false });
    await app.register(openapiPlugin);
    await app.register(healthRoutes);

    app.get(
      "/campaigns",
      {
        schema: {
          ...authenticatedRoute("Campaigns", "List campaigns"),
          querystring: z.object({ status: z.string().optional() }),
        },
      },
      async () => ({ campaigns: [] }),
    );
    app.post(
      "/auth/bootstrap",
      {
        schema: {
          ...publicRoute("Auth", "Bootstrap"),
          body: z.object({ name: z.string().min(1) }),
        },
      },
      async () => ({ ok: true }),
    );

    await app.ready();

    const specResponse = await app.inject({ method: "GET", url: "/documentation/json" });
    expect(specResponse.statusCode).toBe(200);
    const spec = specResponse.json() as {
      openapi: string;
      paths: Record<string, { get?: { responses?: Record<string, unknown> } }>;
      components: {
        securitySchemes: Record<string, unknown>;
        schemas?: Record<string, unknown>;
      };
    };
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.paths).toHaveProperty("/health");
    expect(spec.paths).toHaveProperty("/ready");
    expect(spec.paths).toHaveProperty("/campaigns");
    expect(spec.paths).toHaveProperty("/auth/bootstrap");
    expect(spec.components.securitySchemes).toHaveProperty("bearerAuth");
    expect(spec.components.securitySchemes).toHaveProperty("unipileAuth");
    expect(spec.components.securitySchemes).toHaveProperty("stripeSignature");
    expect(spec.components.schemas).toHaveProperty("ApiErrorResponse");
    expect(spec.paths["/campaigns"]?.get?.responses).toEqual(
      expect.objectContaining({
        "400": expect.any(Object),
        "404": expect.any(Object),
        "410": expect.any(Object),
        "429": expect.any(Object),
        "500": expect.any(Object),
        "504": expect.any(Object),
      }),
    );

    const uiResponse = await app.inject({ method: "GET", url: "/docs/" });
    expect(uiResponse.statusCode).toBe(200);
    expect(uiResponse.body.toLowerCase()).toContain("scalar");
  });
});
