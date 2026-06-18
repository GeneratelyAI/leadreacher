import { env } from "../config/env.js";
import { ExternalServiceError } from "./errors.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

export type GroqMessage = {
  role: "user" | "assistant";
  content: string;
};

type CallGroqOptions = {
  jsonObject?: boolean;
};

export async function callGroq(
  system: string,
  messages: GroqMessage[],
  maxTokens: number,
  options: CallGroqOptions = {},
): Promise<string> {
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: maxTokens,
      ...(options.jsonObject
        ? { response_format: { type: "json_object" } }
        : {}),
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => response.statusText);
    throw new ExternalServiceError("Groq", errorBody);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const text = payload.choices?.[0]?.message?.content;
  if (!text) {
    throw new ExternalServiceError("Groq", "Empty response from Groq");
  }

  return text.trim();
}
