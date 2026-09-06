import { describe, expect, it } from "vitest";
import { openDb } from "../../src/db/open.ts";
import { migrate } from "../../src/db/migrate.ts";
import { createUser } from "../../src/users/repo.ts";
import {
  createApiKey,
  findApiKeyBySecret,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
  touchApiKeyLastUsed,
} from "../../src/apikeys/repo.ts";

function setup() {
  const db = openDb(":memory:");
  migrate(db);
  const a = createUser(db, { username: "ada", password: "password-ada-1" });
  const b = createUser(db, { username: "ben", password: "password-ben-1" });
  return { db, a, b };
}

describe("apikeys-repo", () => {
  it("migrate creates api_keys table", () => {
    const db = openDb(":memory:");
    const result = migrate(db);
    expect(result.applied).toContain("0004_api_keys.sql");
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).toContain("api_keys");
    db.close();
  });

  it("create returns plaintext once and stores a hash, not the secret", () => {
    const { db, a } = setup();
    const created = createApiKey(db, a.id, "scripts");
    expect(created.name).toBe("scripts");
    expect(created.plaintext.length).toBeGreaterThan(0);
    expect(created.prefix.length).toBeGreaterThan(0);
    expect(created.last4.length).toBe(4);
    expect(created.plaintext.startsWith(created.prefix)).toBe(true);
    expect(created.plaintext.endsWith(created.last4)).toBe(true);
    const encoded = created.plaintext.split("_").pop() ?? "";
    const raw = Buffer.from(encoded, "base64url");
    expect(raw.length).toBeGreaterThanOrEqual(32);
    const rows = db.prepare("SELECT secret_hash, name FROM api_keys").all() as {
      secret_hash: string;
      name: string;
    }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("scripts");
    expect(rows[0].secret_hash).not.toBe(created.plaintext);
    expect(rows[0].secret_hash).not.toContain(created.plaintext);
    db.close();
  });

  it("list is newest first and scoped to the owner", () => {
    const { db, a, b } = setup();
    const first = createApiKey(db, a.id, "older");
    const second = createApiKey(db, a.id, "newer");
    createApiKey(db, b.id, "other");
    const listed = listApiKeys(db, a.id);
    expect(listed.map((k) => k.name)).toEqual(["newer", "older"]);
    expect(listed.map((k) => k.id)).toEqual([second.id, first.id]);
    expect(listed[0].lastUsedAt).toBeNull();
    db.close();
  });

  it("lookup by secret finds the key; unknown secret misses", () => {
    const { db, a } = setup();
    const created = createApiKey(db, a.id, "cli");
    const found = findApiKeyBySecret(db, created.plaintext);
    expect(found?.id).toBe(created.id);
    expect(found?.userId).toBe(a.id);
    expect(findApiKeyBySecret(db, "not-a-key")).toBeUndefined();
    db.close();
  });

  it("rotate keeps id and name, retires the old secret, and stamps lastRotatedAt", () => {
    const { db, a } = setup();
    const created = createApiKey(db, a.id, "scripts");
    const rotated = rotateApiKey(db, a.id, created.id);
    expect(rotated).toBeTruthy();
    expect(rotated?.id).toBe(created.id);
    expect(rotated?.name).toBe("scripts");
    expect(rotated?.plaintext).not.toBe(created.plaintext);
    expect(rotated?.plaintext.length).toBeGreaterThan(0);
    expect(findApiKeyBySecret(db, created.plaintext)).toBeUndefined();
    expect(findApiKeyBySecret(db, rotated!.plaintext)?.id).toBe(created.id);
    expect(rotated?.lastRotatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(listApiKeys(db, a.id)).toHaveLength(1);
    db.close();
  });

  it("revoke stops lookup immediately", () => {
    const { db, a } = setup();
    const created = createApiKey(db, a.id, "temp");
    expect(revokeApiKey(db, a.id, created.id)).toBe(true);
    expect(findApiKeyBySecret(db, created.plaintext)).toBeUndefined();
    expect(listApiKeys(db, a.id)).toEqual([]);
    db.close();
  });

  it("touch last-used stamps UTC and leaves other keys alone", () => {
    const { db, a } = setup();
    const created = createApiKey(db, a.id, "used");
    const other = createApiKey(db, a.id, "idle");
    touchApiKeyLastUsed(db, created.id);
    const listed = listApiKeys(db, a.id);
    const used = listed.find((k) => k.id === created.id);
    const idle = listed.find((k) => k.id === other.id);
    expect(used?.lastUsedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(idle?.lastUsedAt).toBeNull();
    db.close();
  });
});
