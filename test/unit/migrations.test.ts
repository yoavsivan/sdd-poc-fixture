import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { openDb } from "../../src/db/open.ts";
import { migrate } from "../../src/db/migrate.ts";

describe("migrations", () => {
  it("fresh db applies 0001..0003 in order and records them", () => {
    const db = openDb(":memory:");
    const result = migrate(db);
    expect(result.applied).toEqual([
      "0001_users.sql",
      "0002_items_tags.sql",
      "0003_items_updated_at.sql",
      "0004_api_keys.sql",
      "0005_api_keys_last_rotated.sql",
    ]);
    expect(result.skipped).toEqual([]);
    const names = db.prepare("SELECT name FROM schema_migrations ORDER BY name").all() as {
      name: string;
    }[];
    expect(names.map((r) => r.name)).toEqual(result.applied);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("items");
    expect(tableNames).toContain("tags");
    expect(tableNames).toContain("item_tags");
    expect(tableNames).toContain("api_keys");
    db.close();
  });

  it("second run applies nothing", () => {
    const db = openDb(":memory:");
    migrate(db);
    const second = migrate(db);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual([
      "0001_users.sql",
      "0002_items_tags.sql",
      "0003_items_updated_at.sql",
      "0004_api_keys.sql",
      "0005_api_keys_last_rotated.sql",
    ]);
    db.close();
  });

  it("a failing migration rolls back and leaves schema_migrations unchanged", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shelfmark-mig-"));
    try {
      fs.writeFileSync(path.join(dir, "0001_ok.sql"), "CREATE TABLE t (id INTEGER PRIMARY KEY);");
      fs.writeFileSync(path.join(dir, "0002_bad.sql"), "THIS IS NOT SQL;");
      const db = openDb(":memory:");
      expect(() => migrate(db, dir)).toThrow(/0002_bad/);
      const names = db.prepare("SELECT name FROM schema_migrations").all() as { name: string }[];
      expect(names.map((r) => r.name)).toEqual(["0001_ok.sql"]);
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 't'")
        .all();
      expect(tables.length).toBe(1);
      db.close();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
