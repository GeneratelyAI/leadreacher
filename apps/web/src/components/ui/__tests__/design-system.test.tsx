import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChoiceCard } from "@/components/onboarding/ChoiceCard";
import { ReviewPanel } from "@/components/onboarding/ReviewPanel";
import { DataTable, type DataTableColumn } from "@/components/patterns/StatTable";
import { ActionBar } from "../ActionBar";
import { Alert } from "../Alert";
import { EmptyState } from "../EmptyState";
import { PageHeader } from "../PageHeader";
import { StatusBadge } from "../StatusBadge";

type MetricRow = {
  id: string;
  name: string;
  total: number;
};

const metricColumns: DataTableColumn<MetricRow>[] = [
  {
    key: "name",
    header: "Channel",
    isLabel: true,
    render: (row) => row.name,
  },
  {
    key: "total",
    header: "Sent",
    align: "right",
    render: (row) => row.total,
  },
];

describe("design system primitives", () => {
  it("renders accessible feedback and empty states", () => {
    const markup = renderToStaticMarkup(
      <>
        <Alert tone="error" title="Could not save">
          Try again.
        </Alert>
        <EmptyState title="No prospects yet" description="Adjust your audience to continue." />
      </>,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Could not save");
    expect(markup).toContain("No prospects yet");
  });

  it("composes a review workspace with a fixed action bar", () => {
    const markup = renderToStaticMarkup(
      <>
        <PageHeader eyebrow="Strategy" title="Review your campaign" />
        <ReviewPanel title="Message review">Campaign content</ReviewPanel>
        <ChoiceCard selected>Recommended option</ChoiceCard>
        <StatusBadge tone="success">Ready</StatusBadge>
        <ActionBar leading="Back" trailing="Continue" />
      </>,
    );

    expect(markup).toContain("Review your campaign");
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain("Ready");
    expect(markup).toContain("onboarding-actions");
    expect(markup).toContain('data-slot="action-bar-item"');
  });

  it("renders the same metric data for desktop and mobile table patterns", () => {
    const markup = renderToStaticMarkup(
      <DataTable
        columns={metricColumns}
        data={[{ id: "linkedin", name: "LinkedIn", total: 24 }]}
        getRowKey={(row) => row.id}
      />,
    );

    expect(markup).toContain("LinkedIn");
    expect(markup).toContain("Sent");
    expect(markup).toContain("lg:hidden");
    expect(markup).toContain("hidden lg:block");
  });
});
