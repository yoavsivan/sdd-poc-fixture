import { describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import legacyQuery from "../../src/legacy/query.cjs";

const { compile, insert, update, whereIn, QueryError } = legacyQuery;

describe("legacy-query", () => {
  it('value containing "\' OR 1=1 --" stays a parameter', () => {
    const db = new Database(":memory:");
    db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, title TEXT)");
    db.prepare("INSERT INTO items (title) VALUES (?)").run("safe");
    const q = compile("SELECT id FROM items WHERE title = :title", {
      title: "' OR 1=1 --",
    });
    expect(q.sql.includes("?")).toBe(true);
    expect(q.sql.includes("' OR 1=1")).toBe(false);
    expect(q.params).toEqual(["' OR 1=1 --"]);
    const rows = db.prepare(q.sql).all(...q.params);
    expect(rows).toEqual([]);
    const remaining = db.prepare("SELECT title FROM items").all() as { title: string }[];
    expect(remaining).toEqual([{ title: "safe" }]);
    db.close();
  });

  it("compile maps :name to ? in order, repeats allowed", () => {
    const q = compile(
      "SELECT * FROM items WHERE user_id = :userId AND (title = :q OR note = :q)",
      { userId: 3, q: "paper" },
    );
    expect(q.sql).toBe("SELECT * FROM items WHERE user_id = ? AND (title = ? OR note = ?)");
    expect(q.params).toEqual([3, "paper", "paper"]);
  });

  it("missing :name throws QueryError", () => {
    expect(() => compile("SELECT * FROM items WHERE id = :id", {})).toThrow(QueryError);
    try {
      compile("SELECT * FROM items WHERE id = :id", {});
    } catch (err) {
      expect(err).toBeInstanceOf(QueryError);
      expect((err as { token?: string }).token).toBe("id");
    }
  });

  it('{{ident}} rejects "items; DROP"', () => {
    expect(() => compile("SELECT * FROM {{items; DROP}}")).toThrow(QueryError);
    const ok = compile("SELECT * FROM {{items}}");
    expect(ok.sql).toBe("SELECT * FROM items");
  });

  it("whereIn([]) yields 0=1", () => {
    const empty = whereIn("id", []);
    expect(empty).toEqual({ sql: "0=1", params: [] });
    const some = whereIn("id", [1, 2]);
    expect(some.sql).toBe("id IN (?,?)");
    expect(some.params).toEqual([1, 2]);
  });

  it("insert/update build correct SQL", () => {
    const ins = insert("items", { url: "https://example.com", title: "A" });
    expect(ins.sql).toBe("INSERT INTO items (url, title) VALUES (?, ?)");
    expect(ins.params).toEqual(["https://example.com", "A"]);
    const upd = update("items", { title: "B" }, "id = :id AND user_id = :userId", {
      id: 9,
      userId: 1,
    });
    expect(upd.sql).toBe("UPDATE items SET title = ? WHERE id = ? AND user_id = ?");
    expect(upd.params).toEqual(["B", 9, 1]);
  });
});
