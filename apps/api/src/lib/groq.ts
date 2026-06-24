import { env } from "../config/env.js";
import { ExternalServiceError } from "./errors.js";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Default text model for structured onboarding and video prompt/critic calls.
export const GROQ_TEXT_MODEL = "llama-3.1-8b-instant";

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
      model: GROQ_TEXT_MODEL,
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
  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_VISION_MODEL,
      max_tokens: maxTokens,
      ...(options.jsonObject
        ? { response_format: { type: "json_object" } }
        : {}),
      messages: [
        { role: "system", content: system },
        ...messages.map(toGroqVisionMessage),
      ],
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
