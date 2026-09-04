import type Database from "better-sqlite3";
import legacyQuery from "../legacy/query.cjs";
import { all, get, run } from "../db/exec.js";
import type { Item, ItemFilter, ItemRow, NewItem } from "./types.js";
import { normalizeTags } from "./tags.js";

const { compile, insert, update, whereIn } = legacyQuery;

interface TagRow {
  id: number;
  name: string;
}

function rowToItem(row: ItemRow, tags: string[]): Item {
  return {
    id: row.id,
    userId: row.user_id,
    url: row.url,
    title: row.title,
    note: row.note,
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function loadTagsForItem(db: Database.Database, itemId: number): string[] {
  const rows = all<{ name: string }>(
    db,
    compile(
      `SELECT t.name AS name
       FROM item_tags it
       JOIN tags t ON t.id = it.tag_id
       WHERE it.item_id = :itemId
       ORDER BY t.name ASC`,
      { itemId },
    ),
  );
  return rows.map((r) => r.name);
}

function loadTagsForItems(db: Database.Database, itemIds: number[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const id of itemIds) map.set(id, []);
  if (itemIds.length === 0) return map;
  const inn = whereIn("item_id", itemIds);
  const fetched = all<{ item_id: number; name: string }>(db, {
    sql: `SELECT it.item_id AS item_id, t.name AS name
       FROM item_tags it
       JOIN tags t ON t.id = it.tag_id
       WHERE it.${inn.sql}
       ORDER BY t.name ASC`,
    params: inn.params,
  });
  for (const r of fetched) {
    const list = map.get(r.item_id);
    if (list) list.push(r.name);
    else map.set(r.item_id, [r.name]);
  }
  return map;
}

function getOrCreateTag(db: Database.Database, userId: number, name: string): number {
  const existing = get<TagRow>(
    db,
    compile("SELECT id, name FROM tags WHERE user_id = :userId AND name = :name", {
      userId,
      name,
    }),
  );
  if (existing) return existing.id;
  const result = run(
    db,
    insert("tags", {
      user_id: userId,
      name,
    }),
  );
  return Number(result.lastInsertRowid);
}

function setTags(db: Database.Database, userId: number, itemId: number, tags: string[]): void {
  db.prepare("DELETE FROM item_tags WHERE item_id = ?").run(itemId);
  for (const name of tags) {
    const tagId = getOrCreateTag(db, userId, name);
    run(
      db,
      compile(
        "INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (:itemId, :tagId)",
        { itemId, tagId },
      ),
    );
  }
}

function fetchItemRow(
  db: Database.Database,
  userId: number,
  id: number,
): ItemRow | undefined {
  return get<ItemRow>(
    db,
    compile(
      `SELECT id, user_id, url, title, note, created_at, updated_at
       FROM items
       WHERE id = :id AND user_id = :userId`,
      { id, userId },
    ),
  );
}

/**
 * List items for a user, optionally filtered by one tag name and a substring `q`.
 */
export function listItems(db: Database.Database, userId: number, f: ItemFilter = {}): Item[] {
  const tag = f.tag && f.tag.trim() !== "" ? f.tag.trim().toLowerCase() : undefined;
  const q = f.q && f.q.trim() !== "" ? f.q.trim() : undefined;
  const like = q ? `%${q}%` : undefined;

  let sql = `SELECT i.id, i.user_id, i.url, i.title, i.note, i.created_at, i.updated_at
     FROM items i
     WHERE i.user_id = :userId`;
  const params: Record<string, unknown> = { userId };

  if (q) {
    sql += ` AND (i.title LIKE :like OR i.url LIKE :like OR i.note LIKE :like)`;
    params.like = like;
  }
  if (tag) {
    sql += ` AND i.id IN (
       SELECT it.item_id
       FROM item_tags it
       JOIN tags t ON t.id = it.tag_id
       WHERE t.user_id = :userId AND t.name = :tag
     )`;
    params.tag = tag;
  }
  sql += " ORDER BY i.created_at DESC, i.id DESC";

  const rows = all<ItemRow>(db, compile(sql, params));
  const ids = rows.map((r) => r.id);
  const tagMap = loadTagsForItems(db, ids);
  return rows.map((row) => rowToItem(row, tagMap.get(row.id) ?? []));
}

/**
 * Fetch one item owned by the user, or undefined.
 */
export function getItem(db: Database.Database, userId: number, id: number): Item | undefined {
  const row = fetchItemRow(db, userId, id);
  if (!row) return undefined;
  return rowToItem(row, loadTagsForItem(db, row.id));
}

function preparedTags(tags: string[]): string[] {
  const norm = normalizeTags(tags);
  if (norm.error) throw new Error(norm.error);
  return norm.tags;
}

/**
 * Insert an item and attach tags. Always scoped to userId.
 */
export function createItem(db: Database.Database, userId: number, n: NewItem): Item {
  const tags = preparedTags(n.tags);
  const now = new Date().toISOString();
  const created = db.transaction(() => {
    const result = run(
      db,
      insert("items", {
        user_id: userId,
        url: n.url,
        title: n.title,
        note: n.note,
        created_at: now,
        updated_at: now,
      }),
    );
    const id = Number(result.lastInsertRowid);
    setTags(db, userId, id, tags);
    return id;
  })();
  const item = getItem(db, userId, created);
  if (!item) throw new Error("createItem: row missing after insert");
  return item;
}

/**
 * Replace fields and tags for an owned item. Returns undefined when not found.
 */
export function updateItem(
  db: Database.Database,
  userId: number,
  id: number,
  n: NewItem,
): Item | undefined {
  const existing = fetchItemRow(db, userId, id);
  if (!existing) return undefined;
  const tags = preparedTags(n.tags);
  const now = new Date().toISOString();
  db.transaction(() => {
    run(
      db,
      update(
        "items",
        {
          url: n.url,
          title: n.title,
          note: n.note,
          updated_at: now,
        },
        "id = :id AND user_id = :userId",
        { id, userId },
      ),
    );
    setTags(db, userId, id, tags);
  })();
  return getItem(db, userId, id);
}

/**
 * Delete an owned item. Tags rows cascade via item_tags. Returns whether a row was removed.
 */
export function removeItem(db: Database.Database, userId: number, id: number): boolean {
  const result = run(
    db,
    compile("DELETE FROM items WHERE id = :id AND user_id = :userId", { id, userId }),
  );
  return result.changes > 0;
}
