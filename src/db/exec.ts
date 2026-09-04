import type Database from "better-sqlite3";
import type { Compiled } from "../legacy/query.cjs";

/**
 * Execute a compiled write and return better-sqlite3's RunResult.
 */
export function run(db: Database.Database, q: Compiled): Database.RunResult {
  return db.prepare(q.sql).run(...q.params);
}

/**
 * Execute a compiled query and return the first row, or undefined.
 */
export function get<T>(db: Database.Database, q: Compiled): T | undefined {
  const row = db.prepare(q.sql).get(...q.params) as T | undefined;
  return row;
}

/**
 * Execute a compiled query and return every row.
 */
export function all<T>(db: Database.Database, q: Compiled): T[] {
  return db.prepare(q.sql).all(...q.params) as T[];
}
