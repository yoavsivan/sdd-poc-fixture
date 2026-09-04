import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * Open a SQLite database (file path or ':memory:') with WAL and foreign keys.
 */
export function openDb(dbPath: string): Database.Database {
  if (typeof dbPath !== "string" || dbPath.trim() === "") {
    throw new Error("openDb: path is required");
  }
  const resolved = dbPath === ":memory:" ? ":memory:" : dbPath;
  if (resolved !== ":memory:") {
    const dir = path.dirname(path.resolve(resolved));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  const db = new Database(resolved);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  return db;
}
