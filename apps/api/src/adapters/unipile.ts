import crypto from "node:crypto";
import { ExternalServiceError } from "../lib/errors.js";
import { env } from "../config/env.js";
import type { UnipileCredentials, UnipileProfile } from "./types.js";

const API_VERSION = "/api/v1";

// Shape of GET /accounts/{id}, confirmed empirically against a live LinkedIn
// account (the docs page does not render the response schema):
//   { object, id, name, type, sources: [{ id, status }], connection_params, ... }
// There is NO top-level `status` field — status lives per-source in `sources[]`.
// A LinkedIn account can expose multiple sources (e.g. MESSAGING, RECRUITER),
// each with its own status; observed value: "OK". `isAccountHealthy()` treats
// only "OK" as healthy.
// Docs: https://developer.unipile.com/reference/accountscontroller_getaccountbyid
type UnipileAccountSource = {
  id: string;
  status: string;
};

type UnipileAccountStatus = {
  id: string;
  type: string;
  name: string;
  sources: UnipileAccountSource[];
};

type UnipileAccount = {
  id: string;
  type: string;
  name?: string;
};

type UnipileAccountList = {
  items: UnipileAccount[];
};

type HostedAuthLink = {
  url: string;
};

export type CreateHostedAuthLinkInput = {
  providers: string[];
  name: string;
  notifyUrl: string;
  successRedirectUrl: string;
  failureRedirectUrl: string;
  expiresOn: string;
};

const HOSTED_AUTH_NAME_PREFIX = "lr";

export function encodeHostedAuthName(orgId: string): string {
  const signature = crypto
    .createHmac("sha256", env.UNIPILE_WEBHOOK_SECRET)
    .update(orgId)
    .digest("hex");
  return `${HOSTED_AUTH_NAME_PREFIX}:${orgId}:${signature}`;
}

export function decodeHostedAuthName(name: string): string | null {
  const [prefix, orgId, signature] = name.split(":");
  if (!prefix || !orgId || !signature || prefix !== HOSTED_AUTH_NAME_PREFIX) {
    return null;
  }

  const expected = encodeHostedAuthName(orgId);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(name, "utf8");
  if (expectedBuffer.length !== actualBuffer.length) {
    return null;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer) ? orgId : null;
}

export type UnipileChat = {
  id?: string;
};

export type UnipileMessage = {
  id?: string;
  message_id?: string;
};

export type UnipileVideoMessage = {
  buffer: Buffer;
  filename: string;
  contentType: "video/mp4";
};

export type { UnipileCredentials, UnipileProfile } from "./types.js";

export class UnipileAdapter {
  constructor(private readonly credentials: UnipileCredentials) {}

  private get headers(): Record<string, string> {
    return { "X-API-KEY": this.credentials.apiKey };
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown> | FormData,
  ): Promise<T> {
    const url = `https://${this.credentials.dsn}${API_VERSION}${path}`;

    const init: RequestInit = {
      method,
      headers: { ...this.headers },
    };

    if (body !== undefined) {
      if (body instanceof FormData) {
        init.body = body;
      } else {
        init.headers = {
          ...init.headers,
          "Content-Type": "application/json",
        };
        init.body = JSON.stringify(body);
      }
    }

    const res = await fetch(url, init);

    if (!res.ok) {
      const text = await res.text();
      throw new ExternalServiceError("Unipile", text);
    }

    return (await res.json()) as T;
  }

  async getProfile(
    accountId: string,
    linkedinPublicId: string,
  ): Promise<UnipileProfile> {
    const params = new URLSearchParams({ account_id: accountId });
    return this.request<UnipileProfile>(
      "GET",
      `/users/${linkedinPublicId}?${params.toString()}`,
    );
  }

  async sendConnectionInvite(
    accountId: string,
    providerId: string,
    message?: string,
  ): Promise<void> {
    // Unipile's documented v1 invite endpoint has no provider idempotency
    // header/body field. A successful send followed by a process crash is kept
    // as an unknown reservation for provider-positive recovery or review.
    await this.request<void>("POST", "/users/invite", {
      account_id: accountId,
      provider_id: providerId,
      ...(message && { message }),
    });
  }

  async startChat(
    accountId: string,
    attendeeProviderId: string,
    text: string,
    options?: { videoMessage?: UnipileVideoMessage },
  ): Promise<{ chat_id: string }> {
    // Unipile's documented v1 start-chat endpoint has no provider idempotency
    // header/body field; callers rely on durable reservations around this call.
    const formData = new FormData();
    formData.append("account_id", accountId);
    formData.append("text", text);
    formData.append("attendees_ids", attendeeProviderId);
    if (options?.videoMessage) {
      const { buffer, filename, contentType } = options.videoMessage;
      formData.append(
        "video_message",
        new Blob([buffer], { type: contentType }),
        filename,
      );
    }

    return this.request<{ chat_id: string }>("POST", "/chats", formData);
  }

  async sendMessageToChat(
    chatId: string,
    text: string,
  ): Promise<{ message_id: string }> {
    // Unipile's documented v1 send-message endpoint has no provider idempotency
    // header/body field; callers preserve unknown state instead of blind retries.
    const formData = new FormData();
    formData.append("text", text);

    return this.request<{ message_id: string }>(
      "POST",
      `/chats/${chatId}/messages`,
      formData,
    );
  }

  async getAccountStatus(accountId: string): Promise<UnipileAccountStatus> {
    return this.request<UnipileAccountStatus>("GET", `/accounts/${accountId}`);
  }

  async listAccounts(): Promise<UnipileAccountList> {
    return this.request<UnipileAccountList>("GET", "/accounts");
  }

  async createHostedAuthLink(
    input: CreateHostedAuthLinkInput,
  ): Promise<HostedAuthLink> {
    return this.request<HostedAuthLink>("POST", "/hosted/accounts/link", {
      type: "create",
      providers: input.providers,
      api_url: `https://${this.credentials.dsn}`,
      expiresOn: input.expiresOn,
      name: input.name,
      notify_url: input.notifyUrl,
      success_redirect_url: input.successRedirectUrl,
      failure_redirect_url: input.failureRedirectUrl,
    });
  }

  async getChat(chatId: string): Promise<UnipileChat> {
    return this.request<UnipileChat>("GET", `/chats/${chatId}`);
  }

  async getMessage(messageId: string): Promise<UnipileMessage> {
    return this.request<UnipileMessage>("GET", `/messages/${messageId}`);
  }
}

// An account is healthy when it has at least one source and every source is OK.
export function isAccountHealthy(account: UnipileAccountStatus): boolean {
  return (
    account.sources.length > 0 &&
    account.sources.every((source) => source.status === "OK")
  );
}

export type {
  UnipileAccount,
  UnipileAccountList,
  UnipileAccountSource,
  UnipileAccountStatus,
  HostedAuthLink,
};
