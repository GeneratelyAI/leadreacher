import type { DemoCampaignType } from "@/lib/onboarding/mode";

export type { DemoCampaignType } from "@/lib/onboarding/mode";

export const DEMO_STATE_VERSION = 1 as const;
export const DEMO_STORAGE_KEY = "lr_demo_onboarding_v1";

export const DEMO_SCENES = [
  "signup",
  "discovery",
  "strategy",
  "campaign-type",
  "media",
  "checkout",
  "connect",
  "complete",
] as const;

export type DemoScene = (typeof DEMO_SCENES)[number];
export type DemoConnection = "linkedin" | "crm" | "email" | "api" | "csv";

export type DemoFileMetadata = {
  name: string;
  size: number;
  type: string;
  lastModified: number;
};

const DEMO_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const DEMO_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export function validateDemoFile(
  file: DemoFileMetadata,
  campaignType: DemoCampaignType | null,
): string | null {
  if (campaignType === "uploaded_video") {
    if (!file.type.startsWith("video/")) return "Choose a video file for this campaign.";
    if (file.size > DEMO_VIDEO_MAX_BYTES) return "Choose a demo video smaller than 50 MB.";
    return null;
  }
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!["pdf", "doc", "docx", "csv", "txt"].includes(extension ?? "")) {
    return "Choose a PDF, DOCX, CSV, or TXT source file.";
  }
  if (file.size > DEMO_DOCUMENT_MAX_BYTES) return "Choose a demo source file smaller than 10 MB.";
  return null;
}

export type DemoOnboardingState = {
  version: typeof DEMO_STATE_VERSION;
  sessionId: string;
  website: string;
  activeScene: DemoScene;
  completedScenes: DemoScene[];
  signup: { name: string; email: string; complete: boolean };
  scrapeStatus: "idle" | "running" | "completed" | "failed";
  campaignType: DemoCampaignType | null;
  mediaTone: "professional" | "friendly" | "direct" | null;
  upload: DemoFileMetadata | null;
  checkoutComplete: boolean;
  connections: DemoConnection[];
  completed: boolean;
};

export type DemoAction =
  | { type: "hydrate"; state: DemoOnboardingState }
  | { type: "navigate"; scene: DemoScene }
  | { type: "complete-scene"; scene: DemoScene }
  | { type: "complete-signup"; name: string; email: string }
  | { type: "set-scrape-status"; status: DemoOnboardingState["scrapeStatus"] }
  | { type: "select-campaign"; campaignType: DemoCampaignType }
  | { type: "select-tone"; tone: NonNullable<DemoOnboardingState["mediaTone"]> }
  | { type: "select-file"; file: DemoFileMetadata | null }
  | { type: "complete-checkout" }
  | { type: "toggle-connection"; connection: DemoConnection }
  | { type: "complete-demo" };

const DEFAULT_WEBSITE = "https://acme.example";

export function normalizeDemoWebsite(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_WEBSITE;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProtocol);
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return DEFAULT_WEBSITE;
  }
}

function createSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `demo-${Date.now()}`;
}

export function createInitialDemoState(website = DEFAULT_WEBSITE): DemoOnboardingState {
  return {
    version: DEMO_STATE_VERSION,
    sessionId: createSessionId(),
    website: normalizeDemoWebsite(website),
    activeScene: "signup",
    completedScenes: [],
    signup: { name: "", email: "", complete: false },
    scrapeStatus: "idle",
    campaignType: null,
    mediaTone: null,
    upload: null,
    checkoutComplete: false,
    connections: [],
    completed: false,
  };
}

export function isDemoScene(value: unknown): value is DemoScene {
  return typeof value === "string" && DEMO_SCENES.includes(value as DemoScene);
}

function isCampaignType(value: unknown): value is DemoCampaignType {
  return [
    "ai_video_ad",
    "personalized_outreach",
    "uploaded_video",
    "build_from_file_demo",
  ].includes(String(value));
}

function isConnection(value: unknown): value is DemoConnection {
  return ["linkedin", "crm", "email", "api", "csv"].includes(String(value));
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function parseDemoState(value: unknown): DemoOnboardingState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<DemoOnboardingState>;
  if (
    candidate.version !== DEMO_STATE_VERSION ||
    typeof candidate.sessionId !== "string" ||
    typeof candidate.website !== "string" ||
    !isDemoScene(candidate.activeScene) ||
    !candidate.signup ||
    typeof candidate.signup.name !== "string" ||
    typeof candidate.signup.email !== "string" ||
    typeof candidate.signup.complete !== "boolean" ||
    !["idle", "running", "completed", "failed"].includes(String(candidate.scrapeStatus)) ||
    typeof candidate.checkoutComplete !== "boolean" ||
    typeof candidate.completed !== "boolean"
  ) {
    return null;
  }

  const completedScenes = Array.isArray(candidate.completedScenes)
    ? unique(candidate.completedScenes.filter(isDemoScene))
    : [];
  const connections = Array.isArray(candidate.connections)
    ? unique(candidate.connections.filter(isConnection))
    : [];
  const campaignType = candidate.campaignType === null || isCampaignType(candidate.campaignType)
    ? candidate.campaignType
    : null;
  const mediaTone = ["professional", "friendly", "direct"].includes(String(candidate.mediaTone))
    ? candidate.mediaTone as DemoOnboardingState["mediaTone"]
    : null;
  const upload = candidate.upload &&
    typeof candidate.upload.name === "string" &&
    typeof candidate.upload.size === "number" &&
    typeof candidate.upload.type === "string" &&
    typeof candidate.upload.lastModified === "number"
    ? candidate.upload
    : null;

  return {
    version: DEMO_STATE_VERSION,
    sessionId: candidate.sessionId,
    website: normalizeDemoWebsite(candidate.website),
    activeScene: candidate.activeScene,
    completedScenes,
    signup: candidate.signup,
    scrapeStatus: candidate.scrapeStatus as DemoOnboardingState["scrapeStatus"],
    campaignType,
    mediaTone,
    upload,
    checkoutComplete: candidate.checkoutComplete,
    connections,
    completed: candidate.completed,
  };
}

export function readDemoState(storage: Pick<Storage, "getItem">): DemoOnboardingState | null {
  try {
    const raw = storage.getItem(DEMO_STORAGE_KEY);
    return raw ? parseDemoState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeDemoState(
  storage: Pick<Storage, "setItem">,
  state: DemoOnboardingState,
): void {
  storage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
}

export function completeStoredDemoSession(): void {
  if (typeof window === "undefined") return;
  const current = readDemoState(window.sessionStorage);
  if (!current) return;
  writeDemoState(window.sessionStorage, demoReducer(current, { type: "complete-demo" }));
}

export function initializeDemoSession(website: string): DemoOnboardingState {
  const state = createInitialDemoState(website);
  if (typeof window !== "undefined") writeDemoState(window.sessionStorage, state);
  return state;
}

function markComplete(state: DemoOnboardingState, scene: DemoScene): DemoScene[] {
  return unique([...state.completedScenes, scene]);
}

export function demoReducer(
  state: DemoOnboardingState,
  action: DemoAction,
): DemoOnboardingState {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "navigate":
      return { ...state, activeScene: action.scene };
    case "complete-scene":
      return { ...state, completedScenes: markComplete(state, action.scene) };
    case "complete-signup":
      return {
        ...state,
        signup: { name: action.name.trim(), email: action.email.trim(), complete: true },
        completedScenes: markComplete(state, "signup"),
        activeScene: "discovery",
      };
    case "set-scrape-status":
      return {
        ...state,
        scrapeStatus: action.status,
        completedScenes: action.status === "completed"
          ? markComplete(state, "discovery")
          : state.completedScenes,
      };
    case "select-campaign":
      return {
        ...state,
        campaignType: action.campaignType,
        upload: action.campaignType === "uploaded_video" || action.campaignType === "build_from_file_demo"
          ? state.upload
          : null,
        completedScenes: markComplete(state, "campaign-type"),
      };
    case "select-tone":
      return { ...state, mediaTone: action.tone, completedScenes: markComplete(state, "media") };
    case "select-file":
      return {
        ...state,
        upload: action.file,
        completedScenes: action.file ? markComplete(state, "media") : state.completedScenes.filter((scene) => scene !== "media"),
      };
    case "complete-checkout":
      return { ...state, checkoutComplete: true, completedScenes: markComplete(state, "checkout") };
    case "toggle-connection": {
      const connections = state.connections.includes(action.connection)
        ? state.connections.filter((item) => item !== action.connection)
        : [...state.connections, action.connection];
      return { ...state, connections };
    }
    case "complete-demo":
      return {
        ...state,
        completed: true,
        activeScene: "complete",
        completedScenes: markComplete(state, "connect"),
      };
    default:
      return state;
  }
}

export function furthestAllowedDemoScene(state: DemoOnboardingState): DemoScene {
  if (!state.signup.complete) return "signup";
  if (state.scrapeStatus !== "completed") return "discovery";
  if (!state.completedScenes.includes("strategy")) return "strategy";
  if (!state.campaignType) return "campaign-type";
  if (!state.completedScenes.includes("media")) return "media";
  if (!state.checkoutComplete) return "checkout";
  if (!state.completed) return "connect";
  return "complete";
}

export function resolveAllowedDemoScene(
  state: DemoOnboardingState,
  requested: unknown,
): DemoScene {
  const fallback = furthestAllowedDemoScene(state);
  if (!isDemoScene(requested)) return state.activeScene;
  return DEMO_SCENES.indexOf(requested) <= DEMO_SCENES.indexOf(fallback)
    ? requested
    : fallback;
}
