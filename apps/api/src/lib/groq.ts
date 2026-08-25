import { env } from "../config/env.js";
import { ExternalServiceError, externalServiceFailure } from "./errors.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TIMEOUT_MS = 30_000;
const GROQ_MAX_ATTEMPTS = 3;

// Default text model for structured onboarding and video prompt/critic calls.
// Keep this on a model that supports Groq's JSON object response mode.
export const GROQ_TEXT_MODEL = "openai/gpt-oss-20b";

// Vision model used by the video output critic to inspect representative frames.
export const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export type GroqMessage = {
  role: "user" | "assistant";
  content: string;
};

export type VisionContentPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image";
      mimeType: string;
      data: string;
    };

export type VisionMessage = {
  role: "user" | "assistant";
  content: string | VisionContentPart[];
};

type CallGroqOptions = {
  jsonObject?: boolean;
};

function transientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function waitBeforeRetry(attempt: number): Promise<void> {
  const jitterMs = Math.floor(Math.random() * 150);
  await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1) + jitterMs));
}

async function groqRequest(body: Record<string, unknown>): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= GROQ_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
      });
      if (!transientStatus(response.status) || attempt === GROQ_MAX_ATTEMPTS) return response;
      await response.body?.cancel();
    } catch (error) {
      lastError = error;
      if (attempt === GROQ_MAX_ATTEMPTS) break;
    }
    await waitBeforeRetry(attempt);
  }
  throw externalServiceFailure("Groq", lastError ?? new Error("Request timed out"));
}

export async function callGroq(
  system: string,
  messages: GroqMessage[],
  maxTokens: number,
  options: CallGroqOptions = {},
): Promise<string> {
  const response = await groqRequest({
    model: GROQ_TEXT_MODEL,
    max_tokens: maxTokens,
    ...(options.jsonObject
      ? { response_format: { type: "json_object" } }
      : {}),
    messages: [{ role: "system", content: system }, ...messages],
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

function toGroqVisionMessage(message: VisionMessage): {
  role: "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
} {
  if (typeof message.content === "string") {
    return {
      role: message.role,
      content: message.content,
    };
  }

  return {
    role: message.role,
    content: message.content.map((part) => {
      if (part.type === "text") {
        return { type: "text", text: part.text };
      }

      return {
        type: "image_url",
        image_url: {
          url: `data:${part.mimeType};base64,${part.data}`,
        },
      };
    }),
  };
}

export async function callGroqVision(
  system: string,
  messages: VisionMessage[],
  maxTokens: number,
  options: CallGroqOptions = {},
): Promise<string> {
  const response = await groqRequest({
    model: GROQ_VISION_MODEL,
    max_tokens: maxTokens,
    ...(options.jsonObject
      ? { response_format: { type: "json_object" } }
      : {}),
    messages: [
      { role: "system", content: system },
      ...messages.map(toGroqVisionMessage),
    ],
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
