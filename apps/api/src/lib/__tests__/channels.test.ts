import { describe, expect, it } from "vitest";
import {
  channelForStepType,
  normalizeUnipilePlatform,
  whatsappAttendeeId,
} from "../channels.js";
import { normalizePhoneE164 } from "../phone.js";

describe("channels", () => {
  it("maps step types to channels", () => {
    expect(channelForStepType("linkedin_invite")).toBe("linkedin");
    expect(channelForStepType("whatsapp_message")).toBe("whatsapp");
    expect(channelForStepType("email")).toBe("email");
    expect(channelForStepType("unknown")).toBeNull();
  });

  it("normalizes Unipile account types", () => {
    expect(normalizeUnipilePlatform("MESSENGER")).toBe("facebook");
    expect(normalizeUnipilePlatform("GOOGLE")).toBe("email");
    expect(normalizeUnipilePlatform("OUTLOOK")).toBe("email");
    expect(normalizeUnipilePlatform("MAIL")).toBe("email");
    expect(normalizeUnipilePlatform("WHATSAPP")).toBe("whatsapp");
  });

  it("builds WhatsApp attendee ids", () => {
    expect(whatsappAttendeeId("+1 (415) 555-0100")).toBe("14155550100@s.whatsapp.net");
    expect(whatsappAttendeeId("123")).toBeNull();
  });
});

describe("phone", () => {
  it("normalizes phones to E.164-ish form", () => {
    expect(normalizePhoneE164("+1 (415) 555-0100")).toBe("+14155550100");
    expect(normalizePhoneE164("abc")).toBeNull();
  });
});
