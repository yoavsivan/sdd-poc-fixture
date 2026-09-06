import { describe, expect, it } from "vitest";
import { isoDateUtc } from "../../src/http/dates.ts";

describe("dates", () => {
  it("isoDateUtc returns YYYY-MM-DD from a UTC ISO timestamp", () => {
    expect(isoDateUtc("2026-09-06T11:22:33.000Z")).toBe("2026-09-06");
    expect(isoDateUtc(null)).toBe("");
    expect(isoDateUtc(undefined)).toBe("");
  });
});
