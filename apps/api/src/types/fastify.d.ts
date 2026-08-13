import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    userEmail?: string;
    dbUserId?: string;
    orgId?: string;
    authAal?: "aal1" | "aal2";
    rawBody?: Buffer;
  }
}
