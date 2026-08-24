import { Loading } from "@/components/ui/Loading";

export default function AppLoading() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#362a89]" aria-label="LeadReacher is loading">
      <Loading label="LeadReacher is loading" />
    </main>
  );
}
