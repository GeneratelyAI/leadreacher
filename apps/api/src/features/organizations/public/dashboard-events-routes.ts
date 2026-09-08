import { type FastifyInstance } from "fastify";
import { type ZodTypeProvider } from "fastify-type-provider-zod";
import { authenticatedRoute } from "../../../platform/http/openapi.js";
import { requireOrgId } from "../../../platform/auth/request-org.js";
import { createRedisSubscriber } from "../../../platform/redis/connection.js";
import { dashboardEventChannel } from "../../../lib/dashboard-events.js";

export async function registerDashboardEventsRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();
  r.get("/dashboard/events", {
    schema: authenticatedRoute("Dashboard", "Stream live dashboard events"),
  }, async (request, reply) => {
    const orgId = requireOrgId(request);
    const subscriber = createRedisSubscriber();
    const preparedHeaders = reply.getHeaders();
    reply.hijack();
    for (const [name, value] of Object.entries(preparedHeaders)) {
      if (value !== undefined) reply.raw.setHeader(name, value);
    }
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const writeEvent = (payload: string): boolean => {
      if (reply.raw.destroyed || reply.raw.writableEnded) return false;
      try {
        return reply.raw.write(payload);
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
        if (["EIO", "EPIPE", "ECONNRESET", "ERR_STREAM_DESTROYED"].includes(code)) return false;
        throw error;
      }
    };
    writeEvent(": connected\n\n");

    const heartbeat = setInterval(() => writeEvent(": keepalive\n\n"), 20_000);
    let closedByClient = false;
    let connectionFailed = false;
    const cleanup = () => {
      closedByClient = true;
      clearInterval(heartbeat);
      subscriber.disconnect();
    };
    request.raw.once("close", cleanup);
    subscriber.on("message", (_channel, payload) => {
      writeEvent(`data: ${payload}\n\n`);
    });
    subscriber.on("error", (error) => {
      if (closedByClient || connectionFailed) return;
      connectionFailed = true;
      request.log.error({
        category: "SYSTEM",
        event: "dashboard.events.redis.disconnected",
        orgId,
        error: error.message,
        retryStatus: "Redis reconnecting automatically",
      }, "[SYSTEM] Dashboard event stream lost its Redis connection, reconnecting automatically");
    });
    subscriber.on("ready", () => {
      if (!connectionFailed || closedByClient) return;
      connectionFailed = false;
      request.log.info({
        category: "SYSTEM",
        event: "dashboard.events.redis.reconnected",
        orgId,
        retryStatus: "reconnected",
      }, "[SYSTEM] Dashboard event stream reconnected to Redis");
    });
    try {
      await subscriber.subscribe(dashboardEventChannel(orgId));
    } catch (error) {
      if (!closedByClient && !connectionFailed) {
        connectionFailed = true;
        request.log.error({
          category: "SYSTEM",
          event: "dashboard.events.redis.subscribe_failed",
          orgId,
          error: error instanceof Error ? error.message : String(error),
          retryStatus: "Redis reconnecting automatically",
        }, "[SYSTEM] Dashboard event stream could not subscribe to Redis, reconnecting automatically");
      }
    }
  });
}
