import crypto from "node:crypto";
import type Database from "better-sqlite3";
import legacyQuery from "../legacy/query.cjs";
import { all, get, run } from "../db/exec.js";

const { compile, insert, update } = legacyQuery;

const PREFIX_BYTES = 4;
const SECRET_BYTES = 32;

export interface ApiKeyRecord {
  id: number;
  userId: number;
  name: string;
  prefix: string;
  displayTail: string;
  secretHash: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ApiKeyPublic {
  id: number;
  name: string;
  prefix: string;
  masked: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface ApiKeyRow {
  id: number;
  user_id: number;
  name: string;
  prefix: string;
  display_tail: string;
  secret_hash: string;
  created_at: string;
  last_used_at: string | null;
}

function hashSecret(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext, "utf8").digest("hex");
}

function mintPlaintext(): { plaintext: string; prefix: string } {
  const prefix = crypto.randomBytes(PREFIX_BYTES).toString("hex");
  const secret = crypto.randomBytes(SECRET_BYTES).toString("base64url");
  return { prefix, plaintext: `smk_${prefix}_${secret}` };
}

function toRecord(row: ApiKeyRow): ApiKeyRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    prefix: row.prefix,
    displayTail: row.display_tail,
    secretHash: row.secret_hash,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

function toPublic(row: ApiKeyRow): ApiKeyPublic {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    masked: `${row.prefix}…${row.display_tail}`,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

/**
 * Format a stored UTC timestamp as YYYY-MM-DD for the settings UI.
 */
export function dateOnlyUtc(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function fetchRow(
  db: Database.Database,
  userId: number,
  id: number,
): ApiKeyRow | undefined {
  return get<ApiKeyRow>(
    db,
    compile(
      `SELECT id, user_id, name, prefix, display_tail, secret_hash, created_at, last_used_at
       FROM api_keys
       WHERE id = :id AND user_id = :userId`,
      { id, userId },
    ),
  );
}

/**
 * Insert a named key for the user. Returns the public row and one-time plaintext.
 */
export function createApiKey(
  db: Database.Database,
  userId: number,
  name: string,
): { key: ApiKeyPublic; plaintext: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("createApiKey: name is required");
  }
  const { plaintext, prefix } = mintPlaintext();
  const secret_hash = hashSecret(plaintext);
  const display_tail = plaintext.slice(-4);
  const created_at = new Date().toISOString();
  const result = run(
    db,
    insert("api_keys", {
      user_id: userId,
      name: trimmed,
      prefix,
      display_tail,
      secret_hash,
      created_at,
    }),
  );
  const id = Number(result.lastInsertRowid);
  const row = fetchRow(db, userId, id);
  if (!row) throw new Error("createApiKey: row missing after insert");
  return { key: toPublic(row), plaintext };
}

/**
 * List keys for a user, newest first.
 */
export function listApiKeys(db: Database.Database, userId: number): ApiKeyPublic[] {
  const rows = all<ApiKeyRow>(
    db,
    compile(
      `SELECT id, user_id, name, prefix, display_tail, secret_hash, created_at, last_used_at
       FROM api_keys
       WHERE user_id = :userId
       ORDER BY created_at DESC, id DESC`,
      { userId },
    ),
  );
  return rows.map((row) => toPublic(row));
}

/**
 * Resolve a Bearer secret to the owning key, or undefined.
 */
export function findApiKeyByPlaintext(
  db: Database.Database,
  plaintext: string,
): ApiKeyRecord | undefined {
  if (!plaintext) return undefined;
  const secret_hash = hashSecret(plaintext);
  const row = get<ApiKeyRow>(
    db,
    compile(
      `SELECT id, user_id, name, prefix, display_tail, secret_hash, created_at, last_used_at
       FROM api_keys
       WHERE secret_hash = :secret_hash`,
      { secret_hash },
    ),
  );
  return row ? toRecord(row) : undefined;
}

/**
 * Stamp last_used_at to now (UTC ISO).
 */
export function touchApiKeyLastUsed(db: Database.Database, id: number): void {
  run(
    db,
    update("api_keys", { last_used_at: new Date().toISOString() }, "id = :id", { id }),
  );
}

/**
 * Delete a key owned by the user. Returns whether a row was removed.
 */
export function revokeApiKey(db: Database.Database, userId: number, id: number): boolean {
  const result = run(
    db,
    compile("DELETE FROM api_keys WHERE id = :id AND user_id = :userId", { id, userId }),
  );
  return result.changes > 0;
}
