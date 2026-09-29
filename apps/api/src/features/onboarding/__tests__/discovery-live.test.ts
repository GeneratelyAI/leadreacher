import { randomUUID } from "node:crypto";
import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { applyZodCompilers } from "../../../platform/http/zod-compilers.js";

const { cache } = vi.hoisted(() => ({ cache: new Map<string, string>() }));

// Exercise real provider calls without writing campaign or production cache data.
vi.mock("../../../platform/persistence/prisma.js", () => ({
  prisma: {
    strategy: {
      findFirst: async () => null,
      create: async () => ({ id: "live-test-strategy" }),
    },
  },
}));
vi.mock("../../../platform/redis/connection.js", () => ({
  redis: {
    get: async (key: string) => cache.get(key) ?? null,
    set: async (key: string, value: string, ...options: unknown[]) => {
      if (options.includes("NX") && cache.has(key)) return null;
      cache.set(key, value);
      return "OK";
    },
    del: async (key: string) => Number(cache.delete(key)),
    eval: async (_script: string, _keys: number, key: string, token: string) =>
      cache.get(key) === token ? Number(cache.delete(key)) : 0,
  },
}));

import {
  anonymousDiscoveryRoutes,
  discoveryRoutes,
  orgScrapeStatusKey,
  type DiscoveryScrapeStatus,
} from "../public/discovery-routes.js";

// Opt in because these canaries use Firecrawl and Groq credentials and credits.
describe.skipIf(process.env.RUN_DISCOVERY_LIVE !== "true")("live website discovery", () => {
  it.each(["https://generately.ai", "https://clay.com"])("analyzes %s into a usable onboarding summary", async (url) => {
    const app = Fastify();
    applyZodCompilers(app);
    const orgId = randomUUID();
    app.addHook("preHandler", async (request) => { request.orgId = orgId; });
    await app.register(anonymousDiscoveryRoutes);
    await app.register(discoveryRoutes);
    const anonId = randomUUID();
    try {
      const start = await app.inject({
        method: "POST",
        url: "/discovery/scrape/anonymous",
        payload: { url, anonId },
      });
      expect(start.statusCode).toBe(200);
      let status = start.json<DiscoveryScrapeStatus>();
      const deadline = Date.now() + 150_000;
      while (status.status === "running" && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const response = await app.inject({
          method: "GET",
          url: `/discovery/scrape/anonymous-status?anonId=${anonId}`,
        });
        expect(response.statusCode).toBe(200);
        status = response.json<DiscoveryScrapeStatus>();
      }
      expect(status.status, status.error ?? "Analysis did not finish").toBe("completed");
      expect(status.error).toBeNull();
      for (const field of [status.market, status.offer, status.audience, status.value]) {
        expect(field.trim().length).toBeGreaterThan(0);
      }
      cache.set(orgScrapeStatusKey(orgId), JSON.stringify(status));
      const continued = await app.inject({
        method: "POST",
        url: "/discovery/complete",
        payload: {
          mode: "introduction",
          websiteUrl: url,
          summary: {
            businessModel: status.offer || status.market,
            industry: status.market || status.offer,
            strengths: status.value || status.offer,
            idealCustomer: status.audience || status.market,
            nextStep: status.strategyStatus,
          },
          messages: [{ role: "user", content: "Continue to review audience criteria." }],
          prospectProfile: status.prospectProfile ? { ...status.prospectProfile, additionalContext: "" } : undefined,
        },
      });
      expect(continued.statusCode, continued.body).toBe(200);
      expect(continued.json()).toEqual({ strategyId: "live-test-strategy" });
      console.info("Verified live discovery", { url, market: status.market, offer: status.offer, audience: status.audience });
    } finally {
      await app.close();
    }
  }, 180_000);
});
