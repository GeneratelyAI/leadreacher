import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import swagger from "@fastify/swagger";
import scalarApiReference from "@scalar/fastify-api-reference";
import {
  createJsonSchemaTransform,
  jsonSchemaTransformObject,
} from "fastify-type-provider-zod";

import { isApiDocsEnabled } from "../config/env.js";
import { errorResponses, OPENAPI_TAGS } from "../lib/openapi.js";
import { applyZodCompilers } from "../lib/zod-compilers.js";

/**
 * Always installs Zod request/response compilers so route `schema` works.
 * Swagger + Scalar mount only when `isApiDocsEnabled()`.
 *
 * Wrapped with fastify-plugin so compilers and swagger see sibling routes
 * (encapsulation would leave Zod schemas on the default AJV compiler).
 */
const openapiPluginImpl: FastifyPluginAsync = async (app) => {
  applyZodCompilers(app);

  if (!isApiDocsEnabled()) {
    return;
  }

  const transformZodSchema = createJsonSchemaTransform({
    skipList: [
      "/documentation",
      "/documentation/",
      "/documentation/json",
      "/documentation/yaml",
      "/documentation/*",
      "/docs",
      "/docs/",
      "/docs/*",
    ],
  });

  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "LeadReacher API",
        description:
          "Multi-channel B2B outreach automation API. Use a Supabase JWT as Bearer token for protected routes.",
        version: "0.1.0",
      },
      tags: OPENAPI_TAGS.map((name) => ({ name })),
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "Supabase access token (`Authorization: Bearer <token>`)",
          },
          unipileSignature: {
            type: "apiKey",
            in: "header",
            name: "unipile-signature",
            description: "Unipile v2 HMAC webhook signature. Do not try from Scalar.",
          },
          stripeSignature: {
            type: "apiKey",
            in: "header",
            name: "stripe-signature",
            description: "Stripe webhook signature. Do not try from Scalar.",
          },
        },
      },
    },
    transform: (input) => {
      const schema = input.schema && typeof input.schema === "object"
        ? input.schema
        : {};
      const response = "response" in schema && schema.response && typeof schema.response === "object"
        ? schema.response
        : {};
      return transformZodSchema({
        ...input,
        schema: {
          ...schema,
          response: {
            ...errorResponses,
            ...response,
          },
        },
      });
    },
    transformObject: jsonSchemaTransformObject,
  });

  await app.register(scalarApiReference, {
    routePrefix: "/docs",
  });

  // @fastify/swagger v9 no longer exposes a JSON HTTP route by itself (that moved to swagger-ui).
  app.get(
    "/documentation/json",
    {
      schema: { hide: true },
      config: { rateLimit: false },
    },
    async () => app.swagger(),
  );
};

export const openapiPlugin = fp(openapiPluginImpl, {
  name: "openapi",
});
