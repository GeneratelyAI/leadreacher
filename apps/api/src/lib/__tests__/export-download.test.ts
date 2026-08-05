import { describe, expect, it } from "vitest";
import { GoneError, ValidationError } from "../errors.js";
import { assertExportDownloadReady } from "../export-download.js";

describe("export download status", () => {
  const now = new Date("2026-08-05T12:00:00.000Z");

  it("returns 410 semantics for an expired export", () => {
    expect(() => assertExportDownloadReady({
      status: "ready",
      objectKey: "exports/org.json",
      expiresAt: new Date("2026-08-05T11:59:59.000Z"),
    }, now)).toThrow(GoneError);
  });

  it("keeps an unfinished export as a validation error", () => {
    expect(() => assertExportDownloadReady({
      status: "processing",
      objectKey: null,
      expiresAt: null,
    }, now)).toThrow(ValidationError);
  });
});
