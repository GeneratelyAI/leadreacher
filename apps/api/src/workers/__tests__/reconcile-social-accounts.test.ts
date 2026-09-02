import { beforeEach, describe, expect, it, vi } from "vitest";

const { listAccounts, socialAccountFindMany, socialAccountUpdate } = vi.hoisted(() => ({
  listAccounts: vi.fn(),
  socialAccountFindMany: vi.fn(),
  socialAccountUpdate: vi.fn(),
}));

vi.mock("../../config/env.js", () => ({ env: { UNIPILE_API_KEY: "key" } }));
vi.mock("../../adapters/unipile.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../adapters/unipile.js")>();
  return {
    ...actual,
    UnipileAdapter: class {
      listAccounts = listAccounts;
    },
  };
});
vi.mock("../../lib/prisma.js", () => ({
  prisma: {
    socialAccount: {
      findMany: socialAccountFindMany,
      update: socialAccountUpdate,
    },
  },
}));
vi.mock("../../lib/operational-logger.js", () => ({ logOperationalInfo: vi.fn() }));

import { reconcileSocialAccountStatuses } from "../reconcile-social-accounts.js";

beforeEach(() => {
  socialAccountFindMany.mockReset().mockResolvedValue([
    {
      id: "stored-1",
      unipileId: "legacy-1",
      platformUserId: "legacy-1",
      status: "disconnected",
    },
  ]);
  socialAccountUpdate.mockReset().mockResolvedValue({});
  listAccounts.mockReset().mockResolvedValue({
    items: [{
      id: "acc-1",
      type: "linkedin",
      name: "Sender",
      user_id: "sender-1",
      status: "running",
      metadata: { v1_account_id: "legacy-1" },
    }],
  });
});

describe("reconcileSocialAccountStatuses", () => {
  it("repairs a stale local status and migrates a transferred account ID", async () => {
    await expect(reconcileSocialAccountStatuses()).resolves.toEqual({
      checked: 1,
      updated: 1,
      unmatched: 0,
    });
    expect(socialAccountUpdate).toHaveBeenCalledWith({
      where: { id: "stored-1" },
      data: { unipileId: "acc-1", status: "active" },
    });
  });

  it("does not disconnect a local account merely because it is absent upstream", async () => {
    listAccounts.mockResolvedValue({ items: [] });

    await expect(reconcileSocialAccountStatuses()).resolves.toEqual({
      checked: 1,
      updated: 0,
      unmatched: 1,
    });
    expect(socialAccountUpdate).not.toHaveBeenCalled();
  });
});
