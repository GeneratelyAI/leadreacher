import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const preview = vi.hoisted(() => vi.fn());
vi.mock("../../public/preview-api", () => ({ isOnboardingPreview: preview }));

import { CheckoutCard, PaymentTrustBar } from "../Checkout";

describe("production checkout boundary", () => {
  beforeEach(() => preview.mockReturnValue(false));

  it("rejects mock sessions outside onboarding preview without displaying fake payment fields", () => {
    const html = renderToStaticMarkup(<CheckoutCard clientSecret="mock-secret" mockMode onMockSubmit={() => {}} />);
    expect(html).toContain("Secure checkout is unavailable");
    expect(html).not.toContain("4242");
    expect(html).not.toContain("Alex Morgan");
    expect(html).not.toContain("Preview mode");
    expect(html).not.toContain("Subscribe");
  });

  it("keeps illustrative payment fields restricted to onboarding preview", () => {
    preview.mockReturnValue(true);
    const html = renderToStaticMarkup(<CheckoutCard clientSecret="preview-secret" mockMode />);
    expect(html).toContain("Preview mode: no payment will be processed");
  });

  it("does not claim payment-brand support outside Stripe's payment element", () => {
    const html = renderToStaticMarkup(<PaymentTrustBar />);
    expect(html).toContain("Protected checkout");
    expect(html).toContain("stripe");
    expect(html).not.toContain("Accepted cards");
    expect(html).not.toContain("UnionPay");
  });
});
