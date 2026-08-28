import { env } from "../config/env.js";
import { ExternalServiceError, externalServiceFailure } from "./errors.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TIMEOUT_MS = 30_000;
const GROQ_MAX_ATTEMPTS = 3;
const GROQ_MAX_INLINE_RETRY_DELAY_MS = 2_000;

// Structured onboarding and text-agent calls prefer the free-tier model with
// the largest daily token allowance, then fail over across separate model
// quotas when Groq reports capacity, permission, or rate-limit failures.
export const GROQ_TEXT_MODELS = [
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
  "qwen/qwen3.6-27b",
] as const;
export const GROQ_TEXT_MODEL = GROQ_TEXT_MODELS[0];

const GROQ_STRICT_JSON_MODELS = new Set<string>([
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-20b",
  "openai/gpt-oss-120b",
]);

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
  jsonSchema?: {
    name: string;
    schema: Record<string, unknown>;
  };
};

function retryableTransportStatus(status: number): boolean {
  return status === 408 || status >= 500;
}

function fallbackEligibleResponse(status: number, body: string): boolean {
  const normalizedBody = body.toLowerCase();
  return status === 404 || status === 408 || status === 429 || status >= 500 || (
    status === 403 && (
      normalizedBody.includes("model") ||
      normalizedBody.includes("permission")
    )
  ) || (
    status === 400 && (
      normalizedBody.includes("json_validate_failed") ||
      normalizedBody.includes("max completion tokens reached") ||
      normalizedBody.includes("model_decommissioned") ||
      normalizedBody.includes("model_not_found")
    )
  );
}

async function waitBeforeRetry(attempt: number, minimumDelayMs = 0): Promise<void> {
  const jitterMs = Math.floor(Math.random() * 150);
  const backoffMs = 250 * 2 ** (attempt - 1) + jitterMs;
  await new Promise((resolve) => setTimeout(resolve, Math.max(backoffMs, minimumDelayMs)));
}

function retryAfterMs(response: Response): number | null {
  const value = response.headers.get("retry-after");
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;

  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) return null;
  return Math.max(0, retryAt - Date.now());
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
      const providerDelayMs = retryAfterMs(response);
      const canRetryRateLimit = response.status === 429 && providerDelayMs !== null &&
        providerDelayMs <= GROQ_MAX_INLINE_RETRY_DELAY_MS;
      if (
        (!retryableTransportStatus(response.status) && !canRetryRateLimit) ||
        attempt === GROQ_MAX_ATTEMPTS
      ) return response;
      await response.body?.cancel();
      await waitBeforeRetry(attempt, providerDelayMs ?? 0);
      continue;
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
  let lastError: ExternalServiceError | null = null;

  for (const [index, model] of GROQ_TEXT_MODELS.entries()) {
    const responseFormat = options.jsonSchema
      ? GROQ_STRICT_JSON_MODELS.has(model)
        ? {
            type: "json_schema",
            json_schema: {
              name: options.jsonSchema.name,
              strict: true,
              schema: options.jsonSchema.schema,
            },
          }
        : { type: "json_object" }
      : options.jsonObject
        ? { type: "json_object" }
        : undefined;
    const response = await groqRequest({
      model,
      max_tokens: maxTokens,
      reasoning_effort: model.startsWith("openai/gpt-oss-") ? "low" : "none",
      ...(responseFormat ? { response_format: responseFormat } : {}),
      messages: [{ role: "system", content: system }, ...messages],
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => response.statusText);
      lastError = new ExternalServiceError("Groq", errorBody);
      const hasFallback = index < GROQ_TEXT_MODELS.length - 1;
      if (hasFallback && fallbackEligibleResponse(response.status, errorBody)) {
        console.warn("[groq] Text model unavailable; trying fallback", {
          model,
          status: response.status,
          fallbackModel: GROQ_TEXT_MODELS[index + 1],
        });
        continue;
      }
      throw lastError;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const text = payload.choices?.[0]?.message?.content;
    if (text) {
      return text.trim();
    }

    lastError = new ExternalServiceError("Groq", "Empty response from Groq");
    if (index === GROQ_TEXT_MODELS.length - 1) {
      throw lastError;
    }
  }

  throw lastError ?? new ExternalServiceError("Groq", "No text model was available");
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
