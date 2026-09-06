import { describe, expect, it } from "vitest";
import { openDb } from "../../src/db/open.ts";
import { migrate } from "../../src/db/migrate.ts";
import {
  createApiKey,
  findActiveBySecret,
  listApiKeys,
  revokeApiKey,
  touchLastUsed,
} from "../../src/api-keys/repo.ts";
import { hashSecret } from "../../src/api-keys/secret.ts";
import { createUser } from "../../src/users/repo.ts";

function setup() {
  const db = openDb(":memory:");
  migrate(db);
  const user = createUser(db, { username: "ada", password: "password-ada-1" });
  const other = createUser(db, { username: "ben", password: "password-ben-1" });
  return { db, user, other };
}

describe("api-keys-repo", () => {
  it("create returns plaintext once and stores only the hash", () => {
    const { db, user } = setup();
    const created = createApiKey(db, user.id, "  scripts  ");
    expect(created.name).toBe("scripts");
    expect(created.plaintext.length).toBeGreaterThan(0);
    const row = db.prepare("SELECT name, secret_hash FROM api_keys WHERE id = ?").get(created.id) as {
      name: string;
      secret_hash: string;
    };
    expect(row.name).toBe("scripts");
    expect(row.secret_hash).toBe(hashSecret(created.plaintext));
    expect(row.secret_hash).not.toContain(created.plaintext);
    db.close();
  });

  it("lists newest first and looks up an active secret", () => {
    const { db, user, other } = setup();
    const first = createApiKey(db, user.id, "older");
    const second = createApiKey(db, user.id, "newer");
    createApiKey(db, other.id, "not-mine");
    const listed = listApiKeys(db, user.id);
    expect(listed.map((k) => k.name)).toEqual(["newer", "older"]);
    expect(listed[0].id).toBe(second.id);
    expect(listed[1].id).toBe(first.id);
    expect(listed[0].createdDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const found = findActiveBySecret(db, second.plaintext);
    expect(found?.id).toBe(second.id);
    expect(findActiveBySecret(db, "not-a-key")).toBeUndefined();
    db.close();
  });

  it("revoke is immediate and touchLastUsed stamps UTC", () => {
    const { db, user } = setup();
    const created = createApiKey(db, user.id, "rotate-me");
    touchLastUsed(db, created.id);
    const listed = listApiKeys(db, user.id);
    expect(listed[0].lastUsedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(revokeApiKey(db, user.id, created.id)).toBe(true);
    expect(findActiveBySecret(db, created.plaintext)).toBeUndefined();
    expect(revokeApiKey(db, user.id, created.id)).toBe(false);
    db.close();
  });
});
