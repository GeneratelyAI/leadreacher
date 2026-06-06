import { buildServer } from "./server.js";

const PORT = 3001;
const HOST = "0.0.0.0";

async function main() {
  const app = await buildServer();

  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
