import crypto from "node:crypto";
import type Database from "better-sqlite3";
import legacyQuery from "../legacy/query.cjs";
import { all, get, run } from "../db/exec.js";

const { compile, insert, update } = legacyQuery;

const PREFIX_LEN = 12;
const TAIL_LEN = 4;

const KEY_COLUMNS =
  "id, user_id, name, prefix, tail, secret_hash, created_at, last_used_at, last_rotated_at";

export interface ApiKeyRecord {
  id: number;
  userId: number;
  name: string;
  prefix: string;
  tail: string;
  createdAt: string;
  lastUsedAt: string | null;
  lastRotatedAt: string | null;
}

interface ApiKeyRow {
  id: number;
  user_id: number;
  name: string;
  prefix: string;
  tail: string;
  secret_hash: string;
  created_at: string;
  last_used_at: string | null;
  last_rotated_at: string | null;
}

function hashSecret(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext, "utf8").digest("hex");
}

function mintPlaintext(): { plaintext: string; prefix: string; tail: string; hash: string } {
  const secret = crypto.randomBytes(32).toString("base64url");
  const plaintext = `smk_${secret}`;
  return {
    plaintext,
    prefix: plaintext.slice(0, PREFIX_LEN),
    tail: plaintext.slice(-TAIL_LEN),
    hash: hashSecret(plaintext),
  };
}

function toRecord(row: ApiKeyRow): ApiKeyRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    prefix: row.prefix,
    tail: row.tail,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    lastRotatedAt: row.last_rotated_at,
  };
}

function getKey(db: Database.Database, id: number): ApiKeyRow | undefined {
  return get<ApiKeyRow>(
    db,
    compile(`SELECT ${KEY_COLUMNS} FROM api_keys WHERE id = :id`, { id }),
  );
}

/** ISO-8601 calendar date in UTC for Settings timestamps. */
export function isoDateUtc(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function maskedSecret(prefix: string, tail: string): string {
  return `${prefix}…${tail}`;
}

/**
 * Mint a named key. Plaintext is prefix plus 32 random bytes (base64url); only the hash is stored.
 */
export function createApiKey(
  db: Database.Database,
  userId: number,
  name: string,
): { key: ApiKeyRecord; plaintext: string } {
  const trimmed = name.trim();
  const minted = mintPlaintext();
  const created_at = new Date().toISOString();
  const result = run(
    db,
    insert("api_keys", {
      user_id: userId,
      name: trimmed,
      prefix: minted.prefix,
      tail: minted.tail,
      secret_hash: minted.hash,
      created_at,
    }),
  );
  const row = getKey(db, Number(result.lastInsertRowid));
  if (!row) throw new Error("createApiKey: row missing after insert");
  return { key: toRecord(row), plaintext: minted.plaintext };
}

export function listApiKeys(db: Database.Database, userId: number): ApiKeyRecord[] {
  const rows = all<ApiKeyRow>(
    db,
    compile(
      `SELECT ${KEY_COLUMNS}
       FROM api_keys
       WHERE user_id = :userId
       ORDER BY created_at DESC, id DESC`,
      { userId },
    ),
  );
  return rows.map(toRecord);
}

export function findApiKeyBySecret(
  db: Database.Database,
  plaintext: string,
): ApiKeyRecord | undefined {
  if (!plaintext) return undefined;
  const row = get<ApiKeyRow>(
    db,
    compile(`SELECT ${KEY_COLUMNS} FROM api_keys WHERE secret_hash = :hash`, {
      hash: hashSecret(plaintext),
    }),
  );
  return row ? toRecord(row) : undefined;
}

export function touchApiKeyLastUsed(db: Database.Database, id: number): void {
  run(
    db,
    update("api_keys", { last_used_at: new Date().toISOString() }, "id = :id", { id }),
  );
}

/**
 * Replace the secret in place. Same id and name; old hash no longer matches.
 */
export function rotateApiKey(
  db: Database.Database,
  userId: number,
  id: number,
): { key: ApiKeyRecord; plaintext: string } | undefined {
  const existing = get<ApiKeyRow>(
    db,
    compile(`SELECT ${KEY_COLUMNS} FROM api_keys WHERE id = :id AND user_id = :userId`, {
      id,
      userId,
    }),
  );
  if (!existing) return undefined;
  const minted = mintPlaintext();
  const last_rotated_at = new Date().toISOString();
  run(
    db,
    update(
      "api_keys",
      {
        prefix: minted.prefix,
        tail: minted.tail,
        secret_hash: minted.hash,
        last_rotated_at,
      },
      "id = :id AND user_id = :userId",
      { id, userId },
    ),
  );
  const row = getKey(db, id);
  if (!row) throw new Error("rotateApiKey: row missing after update");
  return { key: toRecord(row), plaintext: minted.plaintext };
}

export function revokeApiKey(db: Database.Database, userId: number, id: number): boolean {
  const result = run(
    db,
    compile("DELETE FROM api_keys WHERE id = :id AND user_id = :userId", { id, userId }),
  );
  return result.changes > 0;
}
