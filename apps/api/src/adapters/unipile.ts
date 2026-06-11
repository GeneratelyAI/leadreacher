import { ExternalServiceError } from "../lib/errors.js";
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
  ): Promise<{ chat_id: string }> {
    const formData = new FormData();
    formData.append("account_id", accountId);
    formData.append("text", text);
    formData.append("attendees_ids", attendeeProviderId);

    return this.request<{ chat_id: string }>("POST", "/chats", formData);
  }

  async sendMessageToChat(
    chatId: string,
    text: string,
  ): Promise<{ message_id: string }> {
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
};
