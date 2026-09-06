import type Database from "better-sqlite3";
import legacyQuery from "../legacy/query.cjs";
import { all, get, run } from "../db/exec.js";
import { hashSecret, mintApiKeySecret } from "./secret.js";

const { compile, insert, update } = legacyQuery;

interface ApiKeyRow {
  id: number;
  user_id: number;
  name: string;
  prefix: string;
  last4: string;
  created_at: string;
  last_used_at: string | null;
  last_rotated_at: string | null;
}

export interface ApiKeyRecord {
  id: number;
  userId: number;
  name: string;
  prefix: string;
  last4: string;
  createdAt: string;
  lastUsedAt: string | null;
  lastRotatedAt: string | null;
}

export interface CreatedApiKey extends ApiKeyRecord {
  plaintext: string;
}

function toRecord(row: ApiKeyRow): ApiKeyRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    prefix: row.prefix,
    last4: row.last4,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    lastRotatedAt: row.last_rotated_at,
  };
}

function fetchById(db: Database.Database, id: number): ApiKeyRow | undefined {
  return get<ApiKeyRow>(
    db,
    compile(
      `SELECT id, user_id, name, prefix, last4, created_at, last_used_at, last_rotated_at
       FROM api_keys WHERE id = :id`,
      { id },
    ),
  );
}

/**
 * Create a named API key for a user. Returns the public row plus one-time plaintext.
 */
export function createApiKey(db: Database.Database, userId: number, name: string): CreatedApiKey {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("createApiKey: name is required");
  const minted = mintApiKeySecret();
  const created_at = new Date().toISOString();
  const result = run(
    db,
    insert("api_keys", {
      user_id: userId,
      name: trimmed,
      prefix: minted.prefix,
      last4: minted.last4,
      secret_hash: minted.secretHash,
      created_at,
    }),
  );
  const id = Number(result.lastInsertRowid);
  const row = fetchById(db, id);
  if (!row) throw new Error("createApiKey: row missing after insert");
  return { ...toRecord(row), plaintext: minted.plaintext };
}

/**
 * List a user's API keys, newest first.
 */
export function listApiKeys(db: Database.Database, userId: number): ApiKeyRecord[] {
  const rows = all<ApiKeyRow>(
    db,
    compile(
      `SELECT id, user_id, name, prefix, last4, created_at, last_used_at, last_rotated_at
       FROM api_keys
       WHERE user_id = :userId
       ORDER BY created_at DESC, id DESC`,
      { userId },
    ),
  );
  return rows.map(toRecord);
}

/**
 * Look up a live key by the bearer secret. Unknown or revoked secrets miss.
 */
export function findApiKeyBySecret(db: Database.Database, plaintext: string): ApiKeyRecord | undefined {
  if (typeof plaintext !== "string" || plaintext.length === 0) return undefined;
  const row = get<ApiKeyRow>(
    db,
    compile(
      `SELECT id, user_id, name, prefix, last4, created_at, last_used_at, last_rotated_at
       FROM api_keys
       WHERE secret_hash = :hash`,
      { hash: hashSecret(plaintext) },
    ),
  );
  return row ? toRecord(row) : undefined;
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
 * Replace the secret for an owned key. Keeps id and name. Returns the new plaintext once.
 */
export function rotateApiKey(
  db: Database.Database,
  userId: number,
  id: number,
): CreatedApiKey | undefined {
  const existing = get<ApiKeyRow>(
    db,
    compile(
      `SELECT id, user_id, name, prefix, last4, created_at, last_used_at, last_rotated_at
       FROM api_keys WHERE id = :id AND user_id = :userId`,
      { id, userId },
    ),
  );
  if (!existing) return undefined;
  const minted = mintApiKeySecret();
  const last_rotated_at = new Date().toISOString();
  run(
    db,
    update(
      "api_keys",
      {
        prefix: minted.prefix,
        last4: minted.last4,
        secret_hash: minted.secretHash,
        last_rotated_at,
      },
      "id = :id AND user_id = :userId",
      { id, userId },
    ),
  );
  const row = fetchById(db, id);
  if (!row) throw new Error("rotateApiKey: row missing after update");
  return { ...toRecord(row), plaintext: minted.plaintext };
}
