import { describe, expect, it } from "vitest";
import { generateApiKeySecret, hashSecret } from "../../src/api-keys/secret.ts";

describe("api-key secret", () => {
  it("mints a non-empty secret with a short prefix and at least 32 random bytes", () => {
    const minted = generateApiKeySecret();
    expect(minted.plaintext.length).toBeGreaterThan(0);
    expect(minted.prefix).toMatch(/^[0-9a-f]{8}$/);
    const parts = minted.plaintext.split("_");
    expect(parts[0]).toBe("smk");
    expect(parts[1]).toBe(minted.prefix);
    const secretPart = parts.slice(2).join("_");
    const raw = Buffer.from(secretPart, "base64url");
    expect(raw.length).toBeGreaterThanOrEqual(32);
    expect(minted.hash).toBe(hashSecret(minted.plaintext));
    expect(minted.last4).toBe(minted.plaintext.slice(-4));
  });
});
