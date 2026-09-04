import { describe, expect, it } from "vitest";
import { normalizeTags } from "../../src/items/tags.ts";

describe("tags", () => {
  it("normalizeTags lowercases, trims, dedupes, caps at 10", () => {
    const many = [
      " Alpha ",
      "alpha",
      "beta",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
      "i",
      "j",
      "k",
      "l",
    ];
    const result = normalizeTags(many);
    expect(result.error).toBeUndefined();
    expect(result.tags[0]).toBe("alpha");
    expect(result.tags).not.toContain("l");
    expect(result.tags.length).toBe(10);
    expect(new Set(result.tags).size).toBe(10);
    const csv = normalizeTags("Inbox, inbox, later");
    expect(csv.tags).toEqual(["inbox", "later"]);
  });

  it('rejects "Bad Tag!"', () => {
    const result = normalizeTags("Bad Tag!");
    expect(result.tags).toEqual([]);
    expect(result.error).toMatch(/Tag/);
  });
});
