import type { FastifyPluginAsync } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

export const prismaPlugin: FastifyPluginAsync = async (app) => {
  app.decorate("prisma", prisma);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
};
