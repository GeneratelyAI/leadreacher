import { describe, expect, it, vi } from "vitest";

vi.mock("../../../platform/persistence/prisma.js", () => ({ prisma: {} }));
vi.mock("../../../platform/redis/connection.js", () => ({ redis: {} }));

import { SCRAPE_RESPONSE_JSON_SCHEMA } from "../public/discovery-routes.js";

type Schema = {
  type?: string;
  properties?: Record<string, Schema>;
  required?: readonly string[];
  additionalProperties?: boolean;
  items?: Schema;
};

describe("discovery structured output", () => {
  it("requires every property at every object depth for Groq strict mode", () => {
    function check(schema: Schema, path: string): void {
      if (schema.type === "object") {
        expect(schema.additionalProperties, path).toBe(false);
        expect([...(schema.required ?? [])].sort(), path).toEqual(
          Object.keys(schema.properties ?? {}).sort(),
        );
        for (const [key, child] of Object.entries(schema.properties ?? {})) {
          check(child, `${path}.${key}`);
        }
      }
      if (schema.items) check(schema.items, `${path}[]`);
    }

    check(SCRAPE_RESPONSE_JSON_SCHEMA, "website_discovery");
  });
});
