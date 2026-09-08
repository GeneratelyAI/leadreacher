import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProspectReview } from "../useProspectReview";
import type { WebsiteScrapeStatus } from "../../public/website-status";

// Drive effect commits explicitly to exercise restoration before the next render.
// Browser suites separately cover React rendering, focus, and chip animations.
const hooks = vi.hoisted(() => ({
  cursor: 0,
  slots: [] as unknown[],
  effects: [] as Array<() => unknown>,
}));
vi.mock("react", () => ({
  useCallback: (callback: unknown) => callback,
  useState: (initial: unknown) => {
    const slot = hooks.cursor++;
    if (!(slot in hooks.slots)) hooks.slots[slot] = typeof initial === "function" ? initial() : initial;
    return [hooks.slots[slot], (next: unknown) => {
      hooks.slots[slot] = typeof next === "function" ? next(hooks.slots[slot]) : next;
    }];
  },
  useRef: (initial: unknown) => {
    const slot = hooks.cursor++;
    return hooks.slots[slot] ??= { current: initial };
  },
  useEffect: (effect: () => unknown) => hooks.effects.push(effect),
}));

const profile = (role: string) => ({ decisionMakers: [role], companyTypes: [], industries: [], locations: [] });
const status = (url: string, role: string): WebsiteScrapeStatus => ({
  url, status: "completed", prospectProfile: profile(role),
  market: "", offer: "", audience: "", value: "", strategyStatus: "", error: null,
});
const draftKey = (org: string, url: string) => `lr_prospect_review:${org}:${url}`;
const context = vi.fn();
let storage: Map<string, string>;

function ReviewHarness(source: WebsiteScrapeStatus) {
  return useProspectReview(source, true, context);
}

function renderReview(source: WebsiteScrapeStatus) {
  hooks.cursor = 0;
  hooks.effects = [];
  const review = ReviewHarness(source);
  hooks.effects.forEach((effect) => effect());
  return review;
}

describe("prospect review draft ownership", () => {
  beforeEach(() => {
    hooks.slots = [];
    storage = new Map([["lr_discovery_org_id", "org-a"]]);
    context.mockClear();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("restores a scoped draft and keeps unsaved edits through status updates", () => {
    const source = status("https://first.example", "Saved role");
    storage.set(draftKey("org-a", source.url!), JSON.stringify({ profile: profile("Draft role") }));
    renderReview(source);
    const review = renderReview(source);
    expect(review.profile).toEqual(profile("Draft role"));
    review.setProfile(profile("Edited role"));
    expect(renderReview({ ...source }).profile).toEqual(profile("Edited role"));
    expect(context).toHaveBeenCalledTimes(1);
  });

  it("never writes the previous website profile over the next website draft", () => {
    const first = status("https://first.example", "First role");
    const next = status("https://next.example", "Next role");
    const nextKey = draftKey("org-a", next.url!);
    storage.set(nextKey, JSON.stringify({ profile: profile("Next draft") }));
    renderReview(first);
    renderReview(first);
    expect(renderReview(next).profile.decisionMakers).toEqual([]);
    expect(renderReview(next).profile).toEqual(profile("Next draft"));
    expect(JSON.parse(storage.get(nextKey)!)).toEqual({ profile: profile("Next draft") });
  });

  it("does not persist the initial empty profile when mount effects replay", () => {
    const source = status("https://first.example", "Saved role");
    const key = draftKey("org-a", source.url!);
    storage.set(key, JSON.stringify({ profile: profile("Existing draft") }));
    renderReview(source);
    hooks.effects.forEach((effect) => effect());
    expect(JSON.parse(storage.get(key)!)).toEqual({ profile: profile("Existing draft") });
    expect(renderReview(source).profile).toEqual(profile("Existing draft"));
  });

  it("restores another organization's draft even when both use the same website", () => {
    const first = status("https://shared.example", "First organization");
    const next = status(first.url!, "Second organization");
    renderReview(first);
    renderReview(first);
    storage.set("lr_discovery_org_id", "org-b");
    storage.set(draftKey("org-b", next.url!), JSON.stringify({ profile: profile("Second draft") }));
    expect(renderReview(next).profile.decisionMakers).toEqual([]);
    expect(renderReview(next).profile).toEqual(profile("Second draft"));
    expect(JSON.parse(storage.get(draftKey("org-a", first.url!))!)).toEqual({ profile: profile("First organization") });
  });

  it.each(["invalid JSON", JSON.stringify({ profile: { decisionMakers: [4] } })])(
    "uses saved analysis when a draft is malformed: %s", (draft) => {
      const source = status("https://first.example", "Saved role");
      storage.set(draftKey("org-a", source.url!), draft);
      renderReview(source);
      expect(renderReview(source).profile).toEqual(profile("Saved role"));
    },
  );

  it("does not initialize drafts from a pending analysis", () => {
    const source = { ...status("https://pending.example", "Pending role"), status: "running" as const };
    renderReview(source);
    expect(renderReview(source).profile.decisionMakers).toEqual([]);
    expect(storage.has(draftKey("org-a", source.url!))).toBe(false);
    expect(context).not.toHaveBeenCalled();
  });

  it("keeps saved analysis usable when browser storage is disabled", () => {
    vi.stubGlobal("window", { sessionStorage: {
      getItem: () => { throw new Error("Storage disabled"); },
      setItem: () => { throw new Error("Storage disabled"); },
    } });
    const source = status("https://first.example", "Saved role");
    renderReview(source);
    expect(renderReview(source).profile).toEqual(profile("Saved role"));
  });

  it("accepts legacy unwrapped drafts without changing their storage key", () => {
    const source = status("https://first.example", "Saved role");
    storage.set(draftKey("org-a", source.url!), JSON.stringify(profile("Legacy draft")));
    renderReview(source);
    expect(renderReview(source).profile).toEqual(profile("Legacy draft"));
  });

  it("ignores a late edit from the previous source after recovery", () => {
    const first = status("https://first.example", "First role");
    const next = status("https://next.example", "Next role");
    renderReview(first);
    const stale = renderReview(first);
    renderReview(next);
    stale.setProfile(profile("Late edit"));
    expect(renderReview(next).profile).toEqual(profile("Next role"));
  });
});
