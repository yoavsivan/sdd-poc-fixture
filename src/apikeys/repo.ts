import type Database from "better-sqlite3";
import legacyQuery from "../legacy/query.cjs";
import { all, get, run } from "../db/exec.js";
import { displayPrefix, hashSecret, mintPlaintext, maskedTail } from "./secret.js";

const { compile, insert, update } = legacyQuery;

export interface ApiKeyRecord {
  id: number;
  user_id: number;
  name: string;
  prefix: string;
  secret_tail: string;
  secret_hash: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface CreatedApiKey {
  record: ApiKeyRecord;
  plaintext: string;
}

function toRecord(row: ApiKeyRecord): ApiKeyRecord {
  return {
    ...row,
    last_used_at: row.last_used_at ?? null,
    revoked_at: row.revoked_at ?? null,
  };
}

/**
 * Insert an active key. Returns the row plus one-time plaintext.
 */
export function createApiKey(
  db: Database.Database,
  userId: number,
  name: string,
): CreatedApiKey {
  const plaintext = mintPlaintext();
  const created_at = new Date().toISOString();
  const prefix = displayPrefix(plaintext);
  const secret_tail = maskedTail(plaintext);
  const secret_hash = hashSecret(plaintext);
  const result = run(
    db,
    insert("api_keys", {
      user_id: userId,
      name,
      prefix,
      secret_tail,
      secret_hash,
      created_at,
      last_used_at: null,
      revoked_at: null,
    }),
  );
  const id = Number(result.lastInsertRowid);
  const row = getById(db, userId, id);
  if (!row) throw new Error("createApiKey: row missing after insert");
  return { record: row, plaintext };
}

export function listApiKeys(db: Database.Database, userId: number): ApiKeyRecord[] {
  const rows = all<ApiKeyRecord>(
    db,
    compile(
      `SELECT id, user_id, name, prefix, secret_tail, secret_hash, created_at, last_used_at, revoked_at
       FROM api_keys
       WHERE user_id = :userId AND revoked_at IS NULL
       ORDER BY created_at DESC, id DESC`,
      { userId },
    ),
  );
  return rows.map((r) => toRecord(r));
}

export function getById(
  db: Database.Database,
  userId: number,
  id: number,
): ApiKeyRecord | undefined {
  const row = get<ApiKeyRecord>(
    db,
    compile(
      `SELECT id, user_id, name, prefix, secret_tail, secret_hash, created_at, last_used_at, revoked_at
       FROM api_keys
       WHERE id = :id AND user_id = :userId`,
      { id, userId },
    ),
  );
  return row ? toRecord(row) : undefined;
}

/**
 * Active key whose hash matches the presented plaintext, or undefined.
 */
export function findActiveByPlaintext(
  db: Database.Database,
  plaintext: string,
): ApiKeyRecord | undefined {
  if (!plaintext) return undefined;
  const secret_hash = hashSecret(plaintext);
  const row = get<ApiKeyRecord>(
    db,
    compile(
      `SELECT id, user_id, name, prefix, secret_tail, secret_hash, created_at, last_used_at, revoked_at
       FROM api_keys
       WHERE secret_hash = :secret_hash AND revoked_at IS NULL`,
      { secret_hash },
    ),
  );
  return row ? toRecord(row) : undefined;
}

export function touchLastUsed(db: Database.Database, id: number): void {
  const last_used_at = new Date().toISOString();
  run(db, update("api_keys", { last_used_at }, "id = :id", { id }));
}

export function revokeApiKey(db: Database.Database, userId: number, id: number): boolean {
  const row = getById(db, userId, id);
  if (!row || row.revoked_at) return false;
  const revoked_at = new Date().toISOString();
  run(
    db,
    update("api_keys", { revoked_at }, "id = :id AND user_id = :userId AND revoked_at IS NULL", {
      id,
      userId,
    }),
  );
  return true;
}
