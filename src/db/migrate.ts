import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const defaultDir = path.join(repoRoot, "src", "db", "migrations");

function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
}

function listSqlFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    throw new Error(`migrate: directory not found: ${dir}`);
  }
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function appliedSet(db: Database.Database): Set<string> {
  const rows = db.prepare("SELECT name FROM schema_migrations").all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

/**
 * Apply pending lexicographic *.sql files, one transaction per file.
 * A failing file rolls back and leaves schema_migrations unchanged for that file.
 */
export function migrate(
  db: Database.Database,
  dir: string = defaultDir,
): { applied: string[]; skipped: string[] } {
  ensureMigrationsTable(db);
  const files = listSqlFiles(dir);
  const already = appliedSet(db);
  const applied: string[] = [];
  const skipped: string[] = [];
  for (const name of files) {
    if (already.has(name)) {
      skipped.push(name);
      continue;
    }
    const full = path.join(dir, name);
    const sql = fs.readFileSync(full, "utf8");
    const run = db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)").run(
        name,
        new Date().toISOString(),
      );
    });
    try {
      run();
      applied.push(name);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`migrate: ${name} failed: ${message}`);
    }
  }
  return { applied, skipped };
}
