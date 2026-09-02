import { ExternalServiceError, RecipientUnreachableError, externalServiceFailure } from "../lib/errors.js";
import type { UnipileCredentials, UnipileProfile } from "./types.js";

const UNIPILE_V2_BASE_URL = "https://api.unipile.com/v2";
const UNIPILE_TIMEOUT_MS = 30_000;

type UnipileAccountStatus = {
  id: string;
  user_id: string;
  type: string;
  name: string;
  status: "running" | "errored" | "disconnected" | "degraded" | "partial";
  metadata?: {
    v1_account_id?: string;
    products_connection_status?: Record<string, string>;
  };
};

type UnipileAccount = {
  id: string;
  type: string;
  name?: string;
  user_id?: string;
  status?: UnipileAccountStatus["status"];
  metadata?: UnipileAccountStatus["metadata"];
};

type UnipileAccountList = {
  items: UnipileAccount[];
};

type HostedAuthLink = {
  url: string;
};

type UnipileV2Account = Omit<UnipileAccountStatus, "type"> & {
  provider: string;
};

type UnipileV2AccountList = {
  data: UnipileV2Account[];
  has_more: boolean;
};

type UnipileV2Profile = {
  id: string;
  public_identifier?: string;
  first_name?: string;
  last_name?: string;
  description?: string;
  specifics?: {
    network_distance?: string;
    messaging_identifier?: string;
  };
};

export type UnipilePeopleSearchResult = {
  id: string;
  display_name: string;
  public_identifier?: string;
  profile_url?: string;
  public_picture_url?: string;
  public_picture_url_large?: string;
  location?: string;
  headline?: string;
  network_distance: string;
  industry?: string;
  product: "classic";
};

export type UnipilePeopleSearchResponse = {
  data: UnipilePeopleSearchResult[];
  total_count?: number;
  next_cursor?: string;
};

export type UnipilePeopleSearchBody = {
  keywords?: string;
  network_distance?: number[];
};

export type UnipileRelationResult = {
  id?: string;
  member_id?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  description?: string;
  headline?: string;
  public_identifier?: string;
  profile_url?: string;
  public_profile_url?: string;
  public_picture_url?: string;
  profile_picture_url?: string;
};

type UnipileV2Relation = UnipileRelationResult & {
  user?: UnipileRelationResult;
};

type UnipileV2RelationsResponse = {
  data: UnipileV2Relation[];
};

export type CreateHostedAuthLinkInput = {
  providers: string[];
  redirectUri: string;
  state: string;
  expiresOn: string;
};

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
  contentType: string;
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
    body?: Record<string, unknown>,
  ): Promise<T> {
    return this.requestUrl<T>(method, `${UNIPILE_V2_BASE_URL}${path}`, body);
  }

  private async requestUrl<T>(
    method: "GET" | "POST",
    url: string,
    body?: Record<string, unknown>,
  ): Promise<T> {

    const init: RequestInit = {
      method,
      headers: { ...this.headers },
    };

    if (body !== undefined) {
      init.headers = {
        ...init.headers,
        "Content-Type": "application/json",
      };
      init.body = JSON.stringify(body);
    }

    const maxAttempts = method === "GET" ? 3 : 1;
    let res: Response | null = null;
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        res = await fetch(url, {
          ...init,
          signal: AbortSignal.timeout(UNIPILE_TIMEOUT_MS),
        });
        if (![408, 429].includes(res.status) && res.status < 500) break;
        if (attempt === maxAttempts) break;
        await res.body?.cancel();
      } catch (error) {
        lastError = error;
        if (attempt === maxAttempts) break;
      }
      const jitterMs = Math.floor(Math.random() * 150);
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1) + jitterMs));
    }

    if (!res) {
      throw externalServiceFailure("Unipile", lastError ?? new Error("Request timed out"));
    }

    if (!res.ok) {
      const text = (await res.text()).slice(0, 4_000);
      if (res.status === 422 && /invalid_recipient|recipient cannot be reached/i.test(text)) {
        throw new RecipientUnreachableError();
      }
      throw new ExternalServiceError("Unipile", text);
    }

    const responseText = await res.text();
    return responseText ? JSON.parse(responseText) as T : undefined as T;
  }

  async getProfile(
    accountId: string,
    linkedinPublicId: string,
  ): Promise<UnipileProfile> {
    const profile = await this.request<UnipileV2Profile>(
      "GET",
      `/${accountId}/users/${encodeURIComponent(linkedinPublicId)}`,
    );
    const networkDistance = profile.specifics?.network_distance ?? "OUT_OF_NETWORK";
    return {
      provider_id: profile.id,
      messaging_identifier: profile.specifics?.messaging_identifier,
      public_identifier: profile.public_identifier ?? linkedinPublicId,
      first_name: profile.first_name ?? "",
      last_name: profile.last_name ?? "",
      headline: profile.description ?? "",
      network_distance: networkDistance,
      is_relationship: networkDistance === "FIRST_DEGREE",
    };
  }

  async searchLinkedInPeople(
    accountId: string,
    body: UnipilePeopleSearchBody,
    _limit: number,
  ): Promise<UnipilePeopleSearchResponse> {
    return this.request<UnipilePeopleSearchResponse>(
      "POST",
      `/${accountId}/linkedin/search/people`,
      body,
    );
  }

  async searchLinkedInPeopleFromUrl(
    accountId: string,
    searchUrl: string,
    limit: number,
  ): Promise<UnipilePeopleSearchResponse> {
    const response = await this.request<UnipilePeopleSearchResponse>(
      "POST",
      `/${accountId}/linkedin/search`,
      { url: searchUrl },
    );
    return { ...response, data: response.data.slice(0, limit) };
  }

  async listLinkedInRelations(
    accountId: string,
    limit: number,
  ): Promise<UnipileRelationResult[]> {
    const response = await this.request<UnipileV2RelationsResponse>(
      "GET",
      `/${accountId}/users/me/relations`,
    );
    return response.data.map((relation) => relation.user ?? relation).slice(0, limit);
  }

  async sendConnectionInvite(
    accountId: string,
    providerId: string,
    message?: string,
  ): Promise<void> {
    // Unipile documents no provider idempotency field for relation requests.
    await this.request<void>("POST", `/${accountId}/users/me/relation-requests`, {
      user_id: providerId,
      ...(message && { message }),
    });
  }

  async startChat(
    accountId: string,
    attendeeProviderId: string,
    text: string,
    options?: { videoMessage?: UnipileVideoMessage },
  ): Promise<{ chat_id: string }> {
    // Callers wrap this non-idempotent provider operation in a durable reservation.
    const video = options?.videoMessage;
    const response = await this.request<{ chat_id?: string; id?: string }>("POST", `/${accountId}/chats/send`, {
      text,
      users_ids: attendeeProviderId,
      ...(video
        ? {
            attachments: [{
              data: video.buffer.toString("base64"),
              content_type: video.contentType,
              filename: video.filename,
              send_mode: "native",
            }],
          }
        : {}),
    });
    const chatId = response?.chat_id ?? response?.id;
    if (!chatId) {
      throw new ExternalServiceError("Unipile", "Start chat response did not include a chat ID");
    }
    return { chat_id: chatId };
  }

  async sendMessageToChat(
    accountId: string,
    chatId: string,
    text: string,
  ): Promise<{ message_id: string }> {
    // Callers preserve unknown state instead of blindly retrying this operation.
    const response = await this.request<{ message_id?: string; id?: string }>(
      "POST",
      `/${accountId}/chats/${encodeURIComponent(chatId)}/messages/send`,
      { text },
    );
    const messageId = response?.message_id ?? response?.id;
    if (!messageId) {
      throw new ExternalServiceError("Unipile", "Send message response did not include a message ID");
    }
    return { message_id: messageId };
  }

  async sendEmail(input: {
    accountId: string;
    toEmail: string;
    toName?: string;
    subject: string;
    body: string;
  }): Promise<{ id?: string; email_id?: string; provider_id?: string }> {
    return this.request<{ id?: string; email_id?: string; provider_id?: string }>(
      "POST",
      `/${input.accountId}/emails/send`,
      {
        subject: input.subject,
        plain_text: input.body,
        to: [{
          email: input.toEmail,
          ...(input.toName?.trim() ? { display_name: input.toName.trim() } : {}),
        }],
      },
    );
  }

  async getAccountStatus(accountId: string): Promise<UnipileAccountStatus> {
    const account = await this.request<UnipileV2Account>("GET", `/accounts/${accountId}`);
    return { ...account, type: account.provider };
  }

  async listAccounts(): Promise<UnipileAccountList> {
    const response = await this.request<UnipileV2AccountList>("GET", "/accounts/?limit=100");
    return {
      items: response.data.map((account) => ({
        id: account.id,
        type: account.provider,
        name: account.name,
        user_id: account.user_id,
        status: account.status,
        metadata: account.metadata,
      })),
    };
  }

  async createHostedAuthLink(
    input: CreateHostedAuthLinkInput,
  ): Promise<HostedAuthLink> {
    const response = await this.request<{ link: string }>("POST", "/auth/link", {
      providers: input.providers,
      expires_on: input.expiresOn,
      redirect_uri: input.redirectUri,
      state: input.state,
    });
    return { url: response.link };
  }

  async getChat(accountId: string, chatId: string): Promise<UnipileChat> {
    return this.request<UnipileChat>("GET", `/${accountId}/chats/${encodeURIComponent(chatId)}`);
  }

  async getMessage(accountId: string, chatId: string, messageId: string): Promise<UnipileMessage> {
    return this.request<UnipileMessage>(
      "GET",
      `/${accountId}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`,
    );
  }
}

export function isAccountHealthy(account: UnipileAccountStatus): boolean {
  return account.status === "running";
}

export type {
  UnipileAccount,
  UnipileAccountList,
  UnipileAccountStatus,
  HostedAuthLink,
};
