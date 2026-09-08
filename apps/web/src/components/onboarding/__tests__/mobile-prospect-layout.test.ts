import { describe, expect, it } from "vitest";
import { fitProspectRows } from "../MobileProspectCategory";

describe("mobile audience two-row partition", () => {
  it("keeps all values when their measured widths fit two rows", () => {
    expect(fitProspectRows([88, 88, 88, 88, 88, 88], [0, 70], 280)).toBe(6);
    expect(fitProspectRows([], [0], 280)).toBe(0);
  });

  it("reserves the measured overflow trigger inside the second row", () => {
    expect(
      fitProspectRows([100, 100, 100, 100, 100], [0, 70, 70, 70, 70, 70], 208),
    ).toBe(3);
    expect(
      fitProspectRows(
        [130, 130, 130, 130, 130],
        [0, 70, 140, 140, 140, 140],
        268,
      ),
    ).toBe(2);
  });

  it("responds to available width, count-label width and configured gaps", () => {
    const widths = [100, 100, 100, 100, 100];
    const more = [0, 70, 70, 70, 70, 70];
    expect(fitProspectRows(widths, more, 208)).toBe(3);
    expect(fitProspectRows(widths, more, 316)).toBe(5);
    expect(fitProspectRows(widths, more, 200, 0)).toBe(3);
    expect(fitProspectRows(widths, more, 200, 8)).toBe(2);
    expect(widths).toEqual([100, 100, 100, 100, 100]);
    expect(more).toEqual([0, 70, 70, 70, 70, 70]);
  });

  it("keeps an oversized first value reachable through the overflow sheet", () => {
    expect(fitProspectRows([900, 90, 90], [0, 70, 70, 70], 280)).toBe(0);
  });

  it("promotes the next hidden value after a visible value is removed", () => {
    const values = ["First", "Second", "Third", "Fourth", "Fifth"];
    const count = fitProspectRows(
      values.map(() => 100),
      [0, 70, 70, 70, 70, 70],
      208,
    );
    const remaining = values.filter((value) => value !== "Second");
    const nextCount = fitProspectRows(
      remaining.map(() => 100),
      [0, 70, 70, 70, 70],
      208,
    );
    expect(values.slice(0, count)).toEqual(["First", "Second", "Third"]);
    expect(remaining.slice(0, nextCount)).toEqual([
      "First",
      "Third",
      "Fourth",
      "Fifth",
    ]);
  });
});
