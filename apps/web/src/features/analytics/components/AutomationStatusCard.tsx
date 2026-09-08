import { useEffect, useState, type ComponentType, type CSSProperties } from "react";
import { Users, Send, MessageSquare, Megaphone } from "@/components/ui/icons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatNumber } from "../state/analytics-format";
import type { DashboardOverview } from "../state/overview-model";

function WorkingMetric({
  icon: Icon,
  label,
  value,
  detail,
  active,
  highlighted,
  reducedMotion,
}: {
  icon: ComponentType<{ className?: string; style?: CSSProperties; "aria-hidden"?: boolean; "data-slot"?: string }>;
  label: string;
  value: number;
  detail: string;
  active: boolean;
  highlighted: boolean;
  reducedMotion: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="flex min-w-0 flex-col items-center px-4 py-4 text-center">
      <div
        data-slot="overview-feature-icon"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: "relative",
          display: "flex",
          width: "7rem",
          height: "7rem",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "9999px",
          opacity: active ? 1 : 0.65,
        }}
        aria-hidden
      >
        <span
          data-slot="overview-feature-ring"
          style={{
            position: "absolute",
            inset: 0,
            border: "2px dashed var(--onboarding-purple-500)",
            borderRadius: "inherit",
            animation: reducedMotion
              ? "none"
              : `overview-feature-spin-inline ${hovered ? "3s" : "20s"} linear infinite`,
            boxShadow: highlighted && !hovered ? "0 0 0 7px rgba(83, 38, 183, 0.12)" : "none",
            transition: "box-shadow 500ms ease",
          }}
          aria-hidden
        />
        <span
          data-slot="overview-feature-core"
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            width: "5.5rem",
            height: "5.5rem",
            alignItems: "center",
            justifyContent: "center",
            border: "1.5px solid var(--onboarding-purple-500)",
            borderRadius: "inherit",
            background: hovered ? "var(--onboarding-purple-500)" : "var(--app-elevated)",
            boxShadow: hovered ? "0 10px 32px rgba(83, 38, 183, 0.28)" : "none",
            transform: hovered ? "translateY(-4px)" : "translateY(0)",
            transition: reducedMotion ? "none" : "background 250ms ease, box-shadow 250ms ease, transform 250ms ease",
          }}
          aria-hidden
        >
          <Icon
            data-slot="overview-feature-glyph"
            style={{
              width: "2rem",
              height: "2rem",
              color: hovered ? "white" : "var(--onboarding-purple-500)",
              transition: reducedMotion ? "none" : "color 250ms ease",
            }}
          />
        </span>
      </div>
      <p className="mt-3 text-sm font-medium">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-onboarding-purple-700 dark:text-onboarding-purple-100">{formatNumber(value)}</p>
      <p className="text-xs text-muted-foreground">{detail}</p>
      <Badge variant="outline" className="mt-3 gap-1.5 rounded-full font-normal">
        <span className={cn("size-1.5 rounded-full", active ? "bg-onboarding-success-500" : "bg-onboarding-neutral-400")} />
        {active ? "Working" : "Waiting"}
      </Badge>
    </div>
  );
}

export function AutomationStatusCard({ overview }: { overview: DashboardOverview }) {
  const campaign = overview.primaryCampaign;
  const stats = campaign?.stats;
  const active = campaign?.status === "active";
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotionPreference = () => setReducedMotion(mediaQuery.matches);
    updateMotionPreference();
    mediaQuery.addEventListener("change", updateMotionPreference);
    return () => mediaQuery.removeEventListener("change", updateMotionPreference);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const interval = window.setInterval(() => {
      setHighlightedIndex((current) => (current + 1) % 3);
    }, 1_600);
    return () => window.clearInterval(interval);
  }, [reducedMotion]);

  return (
    <Card className="h-full overflow-hidden">
      <style>{`@keyframes overview-feature-spin-inline { to { transform: rotate(360deg); } }`}</style>
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-app-border py-4">
        <div>
          <CardTitle>LeadReacher is working</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">Finding prospects, delivering outreach, and monitoring replies.</p>
        </div>
        <Badge variant="outline" className="hidden max-w-64 gap-2 sm:inline-flex">
          <Megaphone className="size-3.5" aria-hidden />
          <span className="truncate">{campaign?.name ?? "No campaign selected"}</span>
        </Badge>
      </CardHeader>
      <CardContent className="grid px-0 sm:grid-cols-3 sm:divide-x sm:divide-app-border">
        <WorkingMetric highlighted={highlightedIndex === 0} reducedMotion={reducedMotion} icon={Users} label="Finding prospects" value={stats?.prospects ?? campaign?.prospectCount ?? 0} detail="prospects enrolled" active={active} />
        <WorkingMetric highlighted={highlightedIndex === 1} reducedMotion={reducedMotion} icon={Send} label="Sending outreach" value={stats?.contacted ?? overview.metrics.outreachSent} detail="prospects contacted" active={active} />
        <WorkingMetric highlighted={highlightedIndex === 2} reducedMotion={reducedMotion} icon={MessageSquare} label="Tracking replies" value={stats?.replies ?? overview.metrics.replies} detail="replies received" active={active} />
      </CardContent>
    </Card>
  );
}
