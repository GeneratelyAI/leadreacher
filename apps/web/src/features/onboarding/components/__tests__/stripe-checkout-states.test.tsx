import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ useCheckoutElements: vi.fn() }));
vi.mock("@stripe/react-stripe-js/checkout", () => ({
  useCheckoutElements: state.useCheckoutElements,
  CheckoutElementsProvider: () => null,
  ContactDetailsElement: () => <div data-secure-contact />,
  PaymentElement: () => <div data-secure-payment />,
}));
vi.mock("@stripe/stripe-js", () => ({ loadStripe: vi.fn() }));
import { CheckoutForm } from "../StripeCheckout";

describe("secure checkout states", () => {
  it("announces loading without rendering a payment action", () => {
    state.useCheckoutElements.mockReturnValue({ type: "loading" });
    const html = renderToStaticMarkup(<CheckoutForm />);
    expect(html).toContain('role="status"');
    expect(html).not.toContain("<button");
    expect(html).toContain("stripeSkeleton");
    expect(html).toContain("skeletonButton");
  });

  it("offers an explicit retry when secure initialization fails", () => {
    state.useCheckoutElements.mockReturnValue({ type: "error", error: { message: "Session expired" } });
    const html = renderToStaticMarkup(<CheckoutForm onRetry={() => {}} />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("Session expired");
    expect(html).toContain("Retry secure checkout");
    expect(html).not.toContain("Subscribe");
  });

  it.each([false, true])("defers confirmation eligibility to Stripe: %s", (canConfirm) => {
    state.useCheckoutElements.mockReturnValue({ type: "success", checkout: { canConfirm } });
    const html = renderToStaticMarkup(<CheckoutForm planName="Workspace Plus" />);
    expect(html).toContain("data-secure-contact");
    expect(html).toContain("data-secure-payment");
    expect(html).toContain("Subscribe to Workspace Plus");
    expect(html.includes('disabled=""')).toBe(!canConfirm);
    expect(html).not.toContain("4242");
    expect(html).not.toContain("Preview mode");
  });
});
