export function extractJsonObject(raw: string): string {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match?.[0]) {
    throw new Error("No JSON found in LLM response");
  }

  return match[0];
}
