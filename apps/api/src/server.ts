import Fastify from "fastify";

export async function buildServer() {
  const app = Fastify({ logger: true });

  app.get("/", async () => {
    return { message: "Hello World" };
  });

  return app;
}
