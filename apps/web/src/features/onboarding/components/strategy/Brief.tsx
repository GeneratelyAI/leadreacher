import type { StrategyBrief } from "../../state/strategy-model";

export function StrategyBriefContent({
  brief,
  audiencePending = false,
}: {
  brief: StrategyBrief;
  audiencePending?: boolean;
}) {
  return (
    <div className="strategy-brief-content text-left">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.12em] text-brand-purple uppercase dark:text-brand-300">
            Your outreach strategy
          </p>
          <h2 className="mt-2 text-xl font-bold text-onboarding-ink dark:text-onboarding-neutral-0">
            A focused plan for {brief.audience}
          </h2>
        </div>
        {audiencePending ? (
          <span className="inline-flex rounded-full bg-brand-purple/8 px-3 py-1.5 text-xs font-semibold text-brand-purple dark:bg-brand-purple/20 dark:text-brand-100">
            Matching people will be found after connection
          </span>
        ) : null}
      </div>

      <p className="mt-3 max-w-3xl text-sm leading-6 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
        {brief.goal}
      </p>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">Positioning</h3>
          <p className="mt-2 text-sm leading-6 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
            {brief.valueProposition}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {brief.decisionMakerRoles.map((role) => (
              <span
                key={role}
                className="rounded-full bg-onboarding-purple-50 px-3 py-1.5 text-xs font-semibold text-onboarding-purple-700 dark:bg-onboarding-purple-900/60 dark:text-onboarding-purple-100"
              >
                {role}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">Message angles</h3>
          <ul className="mt-2 space-y-2.5">
            {brief.outreachAngles.map((angle) => (
              <li key={angle.title} className="text-sm leading-5 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">
                <span className="font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">{angle.title}: </span>
                {angle.description}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ol className="mt-6 grid gap-3 border-t border-neutral-200 pt-5 sm:grid-cols-3 dark:border-neutral-700">
        {brief.executionPlan.map((item) => (
          <li key={item.step} className="min-w-0">
            <span className="text-xs font-bold text-brand-purple dark:text-brand-300">{String(item.step).padStart(2, "0")}</span>
            <p className="mt-1 text-sm font-semibold text-onboarding-ink dark:text-onboarding-neutral-0">{item.title}</p>
            <p className="mt-1 text-xs leading-5 text-onboarding-neutral-600 dark:text-onboarding-neutral-400">{item.description}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
