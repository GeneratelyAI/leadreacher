import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OrderSummaryCard } from "../OrderSummaryCard";

describe("order summary card", () => {
  it("renders supplied billing values without inventing included channels or prices", () => {
    const html = renderToStaticMarkup(<OrderSummaryCard
      loading={false}
      products={[{ key: "plan", label: "Workspace Plus", value: "CA$249 / year" }]}
      channels={[{ key: "email", label: "Email", value: "Unavailable" }, { key: "linkedin", label: "LinkedIn", value: "Included" }]}
      subtotal="Calculated at checkout"
    />);
    expect(html).toContain("Workspace Plus");
    expect(html.replace(/<[^>]+>/g, "")).toContain("CA$249 / year");
    expect(html).toContain("<dt>Email</dt><dd>Unavailable</dd>");
    expect(html).toContain("<dt>LinkedIn</dt><dd>Included</dd>");
    expect(html).not.toMatch(/Campaign setup|campaign-setup-heading|Audience|<dt>Campaign<\/dt>|<dt>Video<\/dt>/);
    expect(html).toContain("Taxes calculated by Stripe");
    expect(html).not.toContain("Total due today");
    expect(html).not.toContain("199.99");
  });

  it("announces loading instead of displaying a fabricated zero price", () => {
    const html = renderToStaticMarkup(<OrderSummaryCard loading products={[]} channels={[]} subtotal="Loading..." />);
    expect(html).toContain('role="status"');
    expect(html).toContain("Loading plan");
    expect(html).not.toContain("$0");
  });
});
