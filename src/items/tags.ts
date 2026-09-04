import type Database from "better-sqlite3";
import legacyQuery from "../legacy/query.cjs";
import { all } from "../db/exec.js";

const { compile } = legacyQuery;

const TAG_RE = /^[a-z0-9-]{1,32}$/;
const MAX_TAGS = 10;

function splitCsv(input: string): string[] {
  return input
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function asList(input: string | string[] | undefined): string[] {
  if (input == null) return [];
  if (Array.isArray(input)) {
    const out: string[] = [];
    for (const item of input) {
      if (typeof item !== "string") continue;
      out.push(...splitCsv(item));
    }
    return out;
  }
  if (typeof input === "string") return splitCsv(input);
  return [];
}

/**
 * Lowercase, trim, dedupe, and cap at 10 tags.
 * Returns an error when a tag does not match ^[a-z0-9-]{1,32}$.
 */
export function normalizeTags(
  input: string | string[] | undefined,
): { tags: string[]; error?: string } {
  const raw = asList(input);
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const piece of raw) {
    const name = piece.trim().toLowerCase();
    if (!name) continue;
    if (!TAG_RE.test(name)) {
      return {
        tags: [],
        error: `Tag "${piece.trim()}" may only use lowercase letters, digits, and hyphens (1–32 chars)`,
      };
    }
    if (seen.has(name)) continue;
    seen.add(name);
    tags.push(name);
    if (tags.length >= MAX_TAGS) break;
  }
  return { tags };
}

export interface TagCount {
  name: string;
  count: number;
}

/**
 * Distinct tags for a user, with how many items each tag is on.
 */
export function listTagsForUser(db: Database.Database, userId: number): TagCount[] {
  return all<TagCount>(
    db,
    compile(
      `SELECT t.name AS name, COUNT(it.item_id) AS count
       FROM tags t
       LEFT JOIN item_tags it ON it.tag_id = t.id
       WHERE t.user_id = :userId
       GROUP BY t.id, t.name
       HAVING COUNT(it.item_id) > 0
       ORDER BY t.name ASC`,
      { userId },
    ),
  );
}
