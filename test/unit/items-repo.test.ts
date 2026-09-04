import { describe, expect, it } from "vitest";
import { openDb } from "../../src/db/open.ts";
import { migrate } from "../../src/db/migrate.ts";
import { createItem, getItem, listItems, removeItem, updateItem } from "../../src/items/repo.ts";
import { createUser } from "../../src/users/repo.ts";

function setup() {
  const db = openDb(":memory:");
  migrate(db);
  const a = createUser(db, { username: "ada", password: "password-ada-1" });
  const b = createUser(db, { username: "ben", password: "password-ben-1" });
  return { db, a, b };
}

describe("items-repo", () => {
  it("create with tags → tags normalized and attached", () => {
    const { db, a } = setup();
    const item = createItem(db, a.id, {
      url: "https://example.com/a",
      title: "Alpha",
      note: "n",
      tags: ["Later", "later", "inbox"],
    });
    expect(item.tags.sort()).toEqual(["inbox", "later"]);
    expect(item.url).toBe("https://example.com/a");
    db.close();
  });

  it("list filters by tag", () => {
    const { db, a } = setup();
    createItem(db, a.id, {
      url: "https://example.com/1",
      title: "One",
      note: "",
      tags: ["later"],
    });
    createItem(db, a.id, {
      url: "https://example.com/2",
      title: "Two",
      note: "",
      tags: ["inbox"],
    });
    const later = listItems(db, a.id, { tag: "later" });
    expect(later.map((i) => i.title)).toEqual(["One"]);
    db.close();
  });

  it("list with unknown tag → []", () => {
    const { db, a } = setup();
    createItem(db, a.id, {
      url: "https://example.com/1",
      title: "One",
      note: "",
      tags: ["later"],
    });
    expect(listItems(db, a.id, { tag: "missing" })).toEqual([]);
    db.close();
  });

  it("update replaces tags", () => {
    const { db, a } = setup();
    const created = createItem(db, a.id, {
      url: "https://example.com/1",
      title: "One",
      note: "old",
      tags: ["later"],
    });
    const updated = updateItem(db, a.id, created.id, {
      url: "https://example.com/1b",
      title: "One B",
      note: "new",
      tags: ["inbox", "watch"],
    });
    expect(updated?.title).toBe("One B");
    expect(updated?.note).toBe("new");
    expect(updated?.tags.sort()).toEqual(["inbox", "watch"]);
    db.close();
  });

  it("remove cascades item_tags", () => {
    const { db, a } = setup();
    const created = createItem(db, a.id, {
      url: "https://example.com/1",
      title: "One",
      note: "",
      tags: ["later"],
    });
    expect(removeItem(db, a.id, created.id)).toBe(true);
    const links = db.prepare("SELECT * FROM item_tags WHERE item_id = ?").all(created.id);
    expect(links).toEqual([]);
    expect(getItem(db, a.id, created.id)).toBeUndefined();
    db.close();
  });

  it("user A cannot see user B's item (get returns undefined)", () => {
    const { db, a, b } = setup();
    const item = createItem(db, b.id, {
      url: "https://example.com/secret",
      title: "Secret",
      note: "",
      tags: ["later"],
    });
    expect(getItem(db, a.id, item.id)).toBeUndefined();
    expect(listItems(db, a.id, {}).some((i) => i.id === item.id)).toBe(false);
    db.close();
  });
});
