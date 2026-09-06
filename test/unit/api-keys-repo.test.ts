import { describe, expect, it } from "vitest";
import {
  createApiKey,
  dateOnlyUtc,
  findApiKeyByPlaintext,
  listApiKeys,
  revokeApiKey,
  touchApiKeyLastUsed,
} from "../../src/api-keys/repo.ts";
import { openDb } from "../../src/db/open.ts";
import { migrate } from "../../src/db/migrate.ts";
import { createUser } from "../../src/users/repo.ts";

function setup() {
  const db = openDb(":memory:");
  migrate(db);
  const user = createUser(db, { username: "ada", password: "password-ada-1" });
  return { db, user };
}

describe("api-keys-repo", () => {
  it("create stores a hash, returns plaintext with >=32 random bytes encoded, lists newest first", () => {
    const { db, user } = setup();
    const first = createApiKey(db, user.id, " Scripts ");
    expect(first.plaintext.length).toBeGreaterThan(40);
    expect(first.plaintext.startsWith("smk_")).toBe(true);
    expect(first.key.name).toBe("Scripts");
    expect(first.key.prefix.length).toBe(8);
    const secretPart = first.plaintext.slice(`smk_${first.key.prefix}_`.length);
    const decoded = Buffer.from(secretPart, "base64url");
    expect(decoded.length).toBeGreaterThanOrEqual(32);
    const second = createApiKey(db, user.id, "CI");
    const listed = listApiKeys(db, user.id);
    expect(listed.map((k) => k.name)).toEqual(["CI", "Scripts"]);
    expect(listed[0].id).toBe(second.key.id);
    expect(findApiKeyByPlaintext(db, first.plaintext)?.id).toBe(first.key.id);
    expect(findApiKeyByPlaintext(db, "not-a-key")).toBeUndefined();
    db.close();
  });

  it("revoke removes the row so the secret no longer resolves", () => {
    const { db, user } = setup();
    const created = createApiKey(db, user.id, "gone");
    expect(revokeApiKey(db, user.id, created.key.id)).toBe(true);
    expect(findApiKeyByPlaintext(db, created.plaintext)).toBeUndefined();
    expect(listApiKeys(db, user.id)).toEqual([]);
    db.close();
  });

  it("touchApiKeyLastUsed sets last_used_at; dateOnlyUtc is YYYY-MM-DD", () => {
    const { db, user } = setup();
    const created = createApiKey(db, user.id, "used");
    expect(created.key.lastUsedAt).toBeNull();
    touchApiKeyLastUsed(db, created.key.id);
    const listed = listApiKeys(db, user.id)[0];
    expect(listed.lastUsedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(dateOnlyUtc(listed.lastUsedAt)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dateOnlyUtc(listed.createdAt)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    db.close();
  });
});
