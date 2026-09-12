import OnboardingFlow from "./flow";
import { guardOnboardingRoute } from "./server-guard";
import type { OnboardingRouteId } from "./navigation";

export async function OnboardingRoutePage({ route }: { route: OnboardingRouteId }) {
  await guardOnboardingRoute(route);
  return <OnboardingFlow route={route} />;
}
