const OPT_OUT_PHRASES = new Set([
  "stop",
  "unsubscribe",
  "do not contact me",
  "don't contact me",
  "remove me",
  "no more messages",
]);

export function isExplicitOutreachOptOut(message: string): boolean {
  const normalized = message.trim().toLowerCase().replace(/[.!?]+$/g, "");
  return OPT_OUT_PHRASES.has(normalized);
}
