import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { OverviewMode } from "../state/overview-model";

export function OverviewModeSwitcher({ mode, onChange }: { mode: OverviewMode; onChange: (mode: OverviewMode) => void }) {
  return (
    <Tabs value={mode} onValueChange={(value) => onChange(value as OverviewMode)} className="items-center gap-0">
      <TabsList className="h-10 w-full rounded-full bg-onboarding-neutral-100 p-1 sm:w-64 dark:bg-onboarding-neutral-800" aria-label="Overview detail level">
        <TabsTrigger value="casual" className="rounded-full px-6 data-active:text-onboarding-purple-700 dark:data-active:text-onboarding-purple-100">Casual</TabsTrigger>
        <TabsTrigger value="advanced" className="rounded-full px-6 data-active:text-onboarding-purple-700 dark:data-active:text-onboarding-purple-100">Advanced</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
