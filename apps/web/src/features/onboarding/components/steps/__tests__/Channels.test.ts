import { describe, expect, it } from "vitest";
import { connectionControlLabel, returnedConnectionIsActive } from "../Channels";

const linkedInAccount = {
  id: "account-linkedin",
  platform: "linkedin",
  providerType: "linkedin",
  accountName: "QA LinkedIn",
  avatarUrl: null,
  status: "active",
};

describe("returnedConnectionIsActive", () => {
  it("confirms the exact pending channel when browser state is available", () => {
    expect(returnedConnectionIsActive([linkedInAccount], "linkedin")).toBe(true);
    expect(returnedConnectionIsActive([linkedInAccount], "whatsapp")).toBe(false);
  });

  it("accepts an organization-scoped active account when browser state is missing", () => {
    expect(returnedConnectionIsActive([linkedInAccount], null)).toBe(true);
  });

  it("matches Gmail and Outlook with their provider type rather than the shared email platform", () => {
    const gmailAccount = {
      ...linkedInAccount,
      platform: "email",
      providerType: "google",
    };
    const outlookAccount = {
      ...linkedInAccount,
      platform: "email",
      providerType: "outlook",
    };

    expect(returnedConnectionIsActive([gmailAccount], "gmail")).toBe(true);
    expect(returnedConnectionIsActive([gmailAccount], "outlook")).toBe(false);
    expect(returnedConnectionIsActive([outlookAccount], "gmail")).toBe(false);
    expect(returnedConnectionIsActive([outlookAccount], "outlook")).toBe(true);
  });

  it("keeps polling when the returned account is not active", () => {
    expect(
      returnedConnectionIsActive(
        [{ ...linkedInAccount, status: "reconnecting" }],
        null,
      ),
    ).toBe(false);
  });
});

describe("connectionControlLabel", () => {
  it("marks only the provider that started connection as opening", () => {
    expect(connectionControlLabel({ selected: true, opening: true, retry: false })).toBe("Opening...");
    expect(connectionControlLabel({ selected: true, opening: false, retry: false })).toBe("Connect");
  });

  it("keeps unavailable and retry states explicit", () => {
    expect(connectionControlLabel({ selected: false, opening: false, retry: false })).toBe("Not selected");
    expect(connectionControlLabel({ selected: true, opening: false, retry: true })).toBe("Retry");
  });
});
