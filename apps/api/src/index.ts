import { env } from "./config/env.js";
import { captureException, initializeSentry } from "./lib/sentry.js";
import { buildServer } from "./server.js";

const HOST = "0.0.0.0";

async function main() {
  initializeSentry();
  const app = await buildServer();

  try {
    await app.listen({ port: env.PORT, host: HOST });
  } catch (error) {
    app.log.error(error);
    captureException(error, { operation: "api-startup" });
    process.exit(1);
  }
}

void main();
