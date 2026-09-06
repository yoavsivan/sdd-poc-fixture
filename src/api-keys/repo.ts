import type Database from "better-sqlite3";
import legacyQuery from "../legacy/query.cjs";
import { all, get, run } from "../db/exec.js";
import { generateApiKeySecret, hashSecret, utcDateStamp } from "./secret.js";

const { compile, insert, update } = legacyQuery;

export interface ApiKeyRow {
  id: number;
  user_id: number;
  name: string;
  prefix: string;
  last4: string;
  secret_hash: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  rotated_at: string | null;
}

export interface ApiKeyListItem {
  id: number;
  name: string;
  prefix: string;
  last4: string;
  createdDate: string;
  lastUsedDate: string | null;
  lastRotatedDate: string | null;
  revoked: boolean;
}

export interface CreatedApiKey {
  id: number;
  name: string;
  plaintext: string;
  prefix: string;
  last4: string;
}

function toListItem(row: ApiKeyRow): ApiKeyListItem {
  const createdDate = utcDateStamp(row.created_at);
  if (!createdDate) throw new Error("api-keys: created_at missing date");
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    last4: row.last4,
    createdDate,
    lastUsedDate: utcDateStamp(row.last_used_at),
    lastRotatedDate: utcDateStamp(row.rotated_at),
    revoked: row.revoked_at != null,
  };
}

/**
 * Insert a named key for the user. Returns plaintext once; only the hash is stored.
 */
export function createApiKey(
  db: Database.Database,
  userId: number,
  name: string,
): CreatedApiKey {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("createApiKey: name is required");
  const minted = generateApiKeySecret();
  const created_at = new Date().toISOString();
  const result = run(
    db,
    insert("api_keys", {
      user_id: userId,
      name: trimmed,
      prefix: minted.prefix,
      last4: minted.last4,
      secret_hash: minted.hash,
      created_at,
    }),
  );
  const id = Number(result.lastInsertRowid);
  return {
    id,
    name: trimmed,
    plaintext: minted.plaintext,
    prefix: minted.prefix,
    last4: minted.last4,
  };
}

/**
 * Keys for a user, newest first (created_at DESC, id DESC).
 */
export function listApiKeys(db: Database.Database, userId: number): ApiKeyListItem[] {
  const rows = all<ApiKeyRow>(
    db,
    compile(
      `SELECT id, user_id, name, prefix, last4, secret_hash, created_at, last_used_at, revoked_at, rotated_at
       FROM api_keys
       WHERE user_id = :userId
       ORDER BY created_at DESC, id DESC`,
      { userId },
    ),
  );
  return rows.map(toListItem);
}

/**
 * Active (non-revoked) key matching the bearer secret, or undefined.
 */
export function findActiveBySecret(
  db: Database.Database,
  secret: string,
): ApiKeyRow | undefined {
  if (typeof secret !== "string" || secret.length === 0) return undefined;
  const hash = hashSecret(secret);
  return get<ApiKeyRow>(
    db,
    compile(
      `SELECT id, user_id, name, prefix, last4, secret_hash, created_at, last_used_at, revoked_at, rotated_at
       FROM api_keys
       WHERE secret_hash = :hash AND revoked_at IS NULL`,
      { hash },
    ),
  );
}

/**
 * Stamp last_used_at in UTC ISO-8601. No-op when the row is missing or revoked.
 */
export function touchLastUsed(db: Database.Database, keyId: number): void {
  const now = new Date().toISOString();
  run(
    db,
    update(
      "api_keys",
      { last_used_at: now },
      "id = :id AND revoked_at IS NULL",
      { id: keyId },
    ),
  );
}

/**
 * Revoke immediately. Returns whether a live key was revoked.
 */
export function revokeApiKey(
  db: Database.Database,
  userId: number,
  keyId: number,
): boolean {
  const now = new Date().toISOString();
  const result = run(
    db,
    update(
      "api_keys",
      { revoked_at: now },
      "id = :id AND user_id = :userId AND revoked_at IS NULL",
      { id: keyId, userId },
    ),
  );
  return result.changes > 0;
}

/**
 * Replace the secret on an existing live key. Same id and name; old secret dies.
 */
export function rotateApiKey(
  db: Database.Database,
  userId: number,
  keyId: number,
): CreatedApiKey | undefined {
  const row = get<ApiKeyRow>(
    db,
    compile(
      `SELECT id, user_id, name, prefix, last4, secret_hash, created_at, last_used_at, revoked_at, rotated_at
       FROM api_keys
       WHERE id = :id AND user_id = :userId AND revoked_at IS NULL`,
      { id: keyId, userId },
    ),
  );
  if (!row) return undefined;
  const minted = generateApiKeySecret();
  const now = new Date().toISOString();
  run(
    db,
    update(
      "api_keys",
      {
        prefix: minted.prefix,
        last4: minted.last4,
        secret_hash: minted.hash,
        rotated_at: now,
      },
      "id = :id AND user_id = :userId AND revoked_at IS NULL",
      { id: keyId, userId },
    ),
  );
  return {
    id: row.id,
    name: row.name,
    plaintext: minted.plaintext,
    prefix: minted.prefix,
    last4: minted.last4,
  };
}

export function getApiKey(
  db: Database.Database,
  userId: number,
  keyId: number,
): ApiKeyListItem | undefined {
  const row = get<ApiKeyRow>(
    db,
    compile(
      `SELECT id, user_id, name, prefix, last4, secret_hash, created_at, last_used_at, revoked_at, rotated_at
       FROM api_keys
       WHERE id = :id AND user_id = :userId`,
      { id: keyId, userId },
    ),
  );
  return row ? toListItem(row) : undefined;
}
