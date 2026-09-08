const HEARTBEAT_INTERVAL_MS = 60_000;

type HeartbeatOptions = {
  name: string;
  url: string | undefined;
  intervalMs?: number;
};

/**
 * Better Stack heartbeat URLs are secret capabilities. They are intentionally
 * configured per deployment and are never logged or included in error reports.
 */
export function startBetterStackHeartbeat({
  name,
  url,
  intervalMs = HEARTBEAT_INTERVAL_MS,
}: HeartbeatOptions): () => void {
  if (!url) {
    return () => undefined;
  }

  const sendHeartbeat = async () => {
    try {
      const response = await fetch(url, { method: "GET" });
      if (!response.ok) {
        console.error(
          JSON.stringify({
            event: "better-stack-heartbeat-failed",
            name,
            status: response.status,
          }),
        );
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "better-stack-heartbeat-failed",
          name,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  };

  void sendHeartbeat();
  const timer = setInterval(() => {
    void sendHeartbeat();
  }, intervalMs);
  timer.unref();

  return () => clearInterval(timer);
}
