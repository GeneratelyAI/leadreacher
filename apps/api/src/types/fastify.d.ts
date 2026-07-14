import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    userEmail?: string;
    dbUserId?: string;
    orgId?: string;
    rawBody?: Buffer;
  }
}
