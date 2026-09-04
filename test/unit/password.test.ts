import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../src/users/password.ts";

describe("password", () => {
  it("hash/verify roundtrip", () => {
    const stored = hashPassword("demo-pass-1234");
    expect(stored.startsWith("scrypt$")).toBe(true);
    const parts = stored.split("$");
    expect(parts).toHaveLength(4);
    expect(verifyPassword("demo-pass-1234", stored)).toBe(true);
  });

  it("verify rejects wrong password and malformed stored string", () => {
    const stored = hashPassword("demo-pass-1234");
    expect(verifyPassword("nope", stored)).toBe(false);
    expect(verifyPassword("demo-pass-1234", "not-a-hash")).toBe(false);
    expect(verifyPassword("demo-pass-1234", "scrypt$nope")).toBe(false);
    expect(verifyPassword("x", "")).toBe(false);
  });
});
