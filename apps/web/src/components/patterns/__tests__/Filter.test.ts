import { describe, expect, it } from "vitest";
import { normalizeFilterValues, type FilterOption } from "../Filter";

const options: FilterOption[] = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "email", label: "Email" },
];

describe("normalizeFilterValues", () => {
  it("removes duplicate and unavailable values from external filter state", () => {
    expect(normalizeFilterValues(["linkedin", "unknown", "linkedin", "email"], options)).toEqual([
      "linkedin",
      "email",
    ]);
  });

  it("returns an empty selection when every external value is stale", () => {
    expect(normalizeFilterValues(["unknown"], options)).toEqual([]);
  });
});
