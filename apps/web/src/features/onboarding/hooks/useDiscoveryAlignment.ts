import { useLayoutEffect } from "react";
import type { ProspectProfile } from "../state/prospect-profile";
import type { WebsiteScrapeStatus } from "../public/website-status";

export function useDiscoveryAlignment(profile: ProspectProfile, status: WebsiteScrapeStatus["status"]) {
  useLayoutEffect(() => {
    const task = document.querySelector<HTMLElement>(".onboarding-discovery-task");
    const detailEntry = task?.querySelector<HTMLElement>(".discovery-detail-entry");
    const actionRow = task?.querySelector<HTMLElement>(".onboarding-campaign-actions");
    const pill = document.querySelector<HTMLElement>(".signup-campaign-pill");
    const desktop = window.matchMedia("(min-width: 63.0625rem)");
    if (!task || !detailEntry || !actionRow || !pill) return;

    const alignColumn = () => {
      if (!desktop.matches) {
        task.style.removeProperty("--discovery-column-offset");
        task.style.removeProperty("--discovery-content-offset");
        return;
      }

      // The selector reserves its own space in normal flow. Keeping the parent
      // fixed while it is present prevents measuring a translated action row.
      if (task.querySelector(".discovery-detail-selector")) return;

      const currentColumnOffset = Number.parseFloat(task.style.getPropertyValue("--discovery-column-offset")) || 0;
      const currentContentOffset = Number.parseFloat(task.style.getPropertyValue("--discovery-content-offset")) || 0;
      const pillBottom = pill.getBoundingClientRect().bottom;
      const columnDelta = pillBottom - actionRow.getBoundingClientRect().bottom;
      const gap = actionRow.getBoundingClientRect().top - detailEntry.getBoundingClientRect().bottom;

      task.style.setProperty("--discovery-column-offset", `${currentColumnOffset + columnDelta}px`);
      task.style.setProperty("--discovery-content-offset", `${Math.max(0, currentContentOffset + gap - 24)}px`);
      window.dispatchEvent(new Event("discovery-layout-change"));
    };

    alignColumn();
    const resizeObserver = new ResizeObserver(alignColumn);
    resizeObserver.observe(task);
    const detailObserver = new MutationObserver(() => {
      window.requestAnimationFrame(alignColumn);
    });
    detailObserver.observe(detailEntry.parentElement ?? task, { childList: true, subtree: true });
    window.addEventListener("resize", alignColumn);

    return () => {
      resizeObserver.disconnect();
      detailObserver.disconnect();
      window.removeEventListener("resize", alignColumn);
    };
  }, [profile, status]);
}
