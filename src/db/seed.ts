import type Database from "better-sqlite3";
import { createItem, listItems } from "../items/repo.js";
import { createUser, findByUsername } from "../users/repo.js";

const SAMPLE_ITEMS = [
  {
    url: "https://example.com/notes-on-paper",
    title: "Notes on paper sizes",
    note: "Keep this next to the desk reference.",
    tags: ["later", "reference"],
  },
  {
    url: "https://example.org/catalog-cards",
    title: "Catalog cards, a short history",
    note: "Useful pictures of old card drawers.",
    tags: ["later"],
  },
  {
    url: "https://example.net/quiet-tools",
    title: "Quiet tools for a small library",
    note: "",
    tags: ["inbox", "watch"],
  },
];

/**
 * Create the demo user when missing. Returns whether a row was inserted.
 */
export function ensureSeedUser(
  db: Database.Database,
  u: { username: string; password: string },
): { created: boolean } {
  const existing = findByUsername(db, u.username);
  if (existing) return { created: false };
  createUser(db, { username: u.username, password: u.password });
  return { created: true };
}

/**
 * Insert three sample items when the user has none.
 * None of these tags is "reading" — that tag belongs to scripts/sample-import.jsonl.
 */
export function ensureSampleItems(db: Database.Database, userId: number): number {
  const current = listItems(db, userId, {});
  if (current.length > 0) return 0;
  let n = 0;
  for (const row of SAMPLE_ITEMS) {
    createItem(db, userId, row);
    n += 1;
  }
  return n;
}
