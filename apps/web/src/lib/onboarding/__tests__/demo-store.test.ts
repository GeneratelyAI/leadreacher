import { describe, expect, it } from "vitest";
import {
  createInitialDemoState,
  DEMO_STORAGE_KEY,
  demoReducer,
  normalizeDemoWebsite,
  parseDemoState,
  readDemoState,
  resolveAllowedDemoScene,
  validateDemoFile,
  writeDemoState,
} from "../demo-store";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("demo onboarding state", () => {
  it("normalizes websites without retaining paths or unsafe schemes", () => {
    expect(normalizeDemoWebsite("leadreacher.ai/pricing")).toBe("https://leadreacher.ai");
    expect(normalizeDemoWebsite("javascript:alert(1)")).toBe("https://acme.example");
    expect(normalizeDemoWebsite("")).toBe("https://acme.example");
  });

  it("progresses through signup without storing a password or production id", () => {
    const initial = createInitialDemoState("example.com");
    const signedUp = demoReducer(initial, {
      type: "complete-signup",
      name: "Alex Morgan",
      email: "alex@example.com",
    });

    expect(signedUp.activeScene).toBe("discovery");
    expect(signedUp.completedScenes).toContain("signup");
    expect(signedUp.signup).toEqual({
      name: "Alex Morgan",
      email: "alex@example.com",
      complete: true,
    });
    expect(signedUp).not.toHaveProperty("password");
    expect(signedUp).not.toHaveProperty("orgId");
  });

  it("keeps Build From a File as a demo state value", () => {
    const selected = demoReducer(createInitialDemoState(), {
      type: "select-campaign",
      campaignType: "build_from_file_demo",
    });
    expect(selected.campaignType).toBe("build_from_file_demo");
  });

  it("prevents deep links from skipping incomplete scenes", () => {
    const initial = createInitialDemoState();
    expect(resolveAllowedDemoScene(initial, "connect")).toBe("signup");
    const signedUp = demoReducer(initial, {
      type: "complete-signup",
      name: "Alex",
      email: "alex@example.com",
    });
    expect(resolveAllowedDemoScene(signedUp, "connect")).toBe("discovery");
    expect(resolveAllowedDemoScene(signedUp, "signup")).toBe("signup");
  });

  it("validates demo files without reading or uploading their contents", () => {
    const video = { name: "campaign.mp4", size: 1024, type: "video/mp4", lastModified: 1 };
    expect(validateDemoFile(video, "uploaded_video")).toBeNull();
    expect(validateDemoFile({ ...video, type: "application/pdf" }, "uploaded_video")).toMatch(/video file/);
    expect(validateDemoFile({ ...video, name: "brief.pdf", type: "application/pdf" }, "build_from_file_demo")).toBeNull();
    expect(validateDemoFile({ ...video, name: "script.exe" }, "build_from_file_demo")).toMatch(/PDF/);
  });

  it("round-trips valid state through session-style storage", () => {
    const storage = memoryStorage();
    const state = demoReducer(createInitialDemoState(), {
      type: "select-campaign",
      campaignType: "personalized_outreach",
    });
    writeDemoState(storage, state);
    expect(storage.getItem(DEMO_STORAGE_KEY)).not.toBeNull();
    expect(readDemoState(storage)).toEqual(state);
  });

  it("rejects corrupt and unsupported-version state", () => {
    expect(parseDemoState(null)).toBeNull();
    expect(parseDemoState({ version: 999 })).toBeNull();
    const storage = memoryStorage();
    storage.setItem(DEMO_STORAGE_KEY, "not-json");
    expect(readDemoState(storage)).toBeNull();
  });
});
