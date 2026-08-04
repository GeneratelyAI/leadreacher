import { captureException, initializeSentry } from "./lib/sentry.js";
import { buildServer } from "./server.js";
import { env } from "./config/env.js";

/**
 * Railway worker entry point. It registers the same Fastify lifecycle as the
 * API process, but does not bind an HTTP port. Enable worker flags only on the
 * dedicated worker service so jobs are never consumed twice.
 */
async function main() {
  if (env.RUNTIME_ROLE !== "worker") {
    throw new Error('The worker entry point requires RUNTIME_ROLE="worker"');
  }
  initializeSentry();
  const app = await buildServer();
  await app.ready();
  app.log.info("Background workers started");

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, "Stopping background workers");
    await app.close();
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void main().catch((error: unknown) => {
  captureException(error, { operation: "worker-startup" });
  console.error("Unable to start background workers", error);
  process.exit(1);
});
