import { type EngineStatus } from "../public/workspace-status.js";

export type DashboardChrome = {
  organization: { name: string; plan: string };
  engine: { status: EngineStatus; label: string; detail: string };
  unreadNotificationCount: number;
  channels: Array<{ id: string; platform: string; accountName: string; status: string }>;
  activity: Array<{
    id: string;
    kind: "message";
    title: string;
    detail: string;
    occurredAt: Date;
    avatarUrl: string | null;
    channel: string;
    action: "reply" | "view";
    href: string;
  }>;
};
