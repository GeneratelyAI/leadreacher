import { describe, expect, it } from "vitest";
import { getWhatsAppReachability } from "../channel-reachability.js";

describe("getWhatsAppReachability", () => {
  it("requires a valid number, consent evidence, and no suppression", () => {
    const consentAt = new Date("2026-08-01T12:00:00.000Z");
    expect(getWhatsAppReachability([
      { phone: "+14165550123", whatsappConsentAt: consentAt, whatsappConsentSource: "signup form", outreachSuppressedAt: null },
      { phone: "bad", whatsappConsentAt: consentAt, whatsappConsentSource: "signup form", outreachSuppressedAt: null },
      { phone: "+14165550124", whatsappConsentAt: null, whatsappConsentSource: null, outreachSuppressedAt: null },
      { phone: "+14165550125", whatsappConsentAt: consentAt, whatsappConsentSource: "event", outreachSuppressedAt: consentAt },
    ])).toEqual({ total: 4, reachable: 1, invalidPhone: 1, missingConsent: 1, suppressed: 1 });
  });
});
