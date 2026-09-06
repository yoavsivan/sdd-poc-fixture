import type Database from "better-sqlite3";
import legacyQuery from "../legacy/query.cjs";
import { all, get, run } from "../db/exec.js";
import { mintSecret } from "./secret.js";

const { compile, insert, update } = legacyQuery;

export interface ApiKeyRecord {
  id: number;
  user_id: number;
  name: string;
  prefix: string;
  suffix: string;
  token_hash: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  rotated_at: string | null;
}

export interface CreatedApiKey {
  record: ApiKeyRecord;
  plaintext: string;
}

function parseNullable(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function mapRow(row: ApiKeyRecord): ApiKeyRecord {
  return {
    ...row,
    last_used_at: parseNullable(row.last_used_at),
    revoked_at: parseNullable(row.revoked_at),
    rotated_at: parseNullable(row.rotated_at),
  };
}

const COLS =
  "id, user_id, name, prefix, suffix, token_hash, created_at, last_used_at, revoked_at, rotated_at";

export function createApiKey(
  db: Database.Database,
  userId: number,
  name: string,
): CreatedApiKey {
  const minted = mintSecret();
  const created_at = new Date().toISOString();
  const result = run(
    db,
    insert("api_keys", {
      user_id: userId,
      name,
      prefix: minted.prefix,
      suffix: minted.suffix,
      token_hash: minted.tokenHash,
      created_at,
    }),
  );
  const id = Number(result.lastInsertRowid);
  const record = getById(db, id);
  if (!record) throw new Error("createApiKey: row missing after insert");
  return { record, plaintext: minted.plaintext };
}

export function getById(db: Database.Database, id: number): ApiKeyRecord | undefined {
  const row = get<ApiKeyRecord>(
    db,
    compile(`SELECT ${COLS} FROM api_keys WHERE id = :id`, { id }),
  );
  return row ? mapRow(row) : undefined;
}

export function listActiveKeys(db: Database.Database, userId: number): ApiKeyRecord[] {
  const rows = all<ApiKeyRecord>(
    db,
    compile(
      `SELECT ${COLS}
       FROM api_keys
       WHERE user_id = :userId AND revoked_at IS NULL
       ORDER BY created_at DESC, id DESC`,
      { userId },
    ),
  );
  return rows.map(mapRow);
}

export function findActiveByTokenHash(
  db: Database.Database,
  tokenHash: string,
): ApiKeyRecord | undefined {
  const row = get<ApiKeyRecord>(
    db,
    compile(
      `SELECT ${COLS}
       FROM api_keys
       WHERE token_hash = :tokenHash AND revoked_at IS NULL`,
      { tokenHash },
    ),
  );
  return row ? mapRow(row) : undefined;
}

export function touchLastUsed(db: Database.Database, id: number): void {
  run(
    db,
    update("api_keys", { last_used_at: new Date().toISOString() }, "id = :id", { id }),
  );
}

export function revokeApiKey(db: Database.Database, userId: number, id: number): boolean {
  const row = getById(db, id);
  if (!row || row.user_id !== userId || row.revoked_at) return false;
  run(
    db,
    update("api_keys", { revoked_at: new Date().toISOString() }, "id = :id", { id }),
  );
  return true;
}

/**
 * Replace the secret in place. Same id and name. Old hash no longer authenticates.
 */
export function rotateApiKey(
  db: Database.Database,
  userId: number,
  id: number,
): CreatedApiKey | undefined {
  const row = getById(db, id);
  if (!row || row.user_id !== userId || row.revoked_at) return undefined;
  const minted = mintSecret();
  run(
    db,
    update(
      "api_keys",
      {
        prefix: minted.prefix,
        suffix: minted.suffix,
        token_hash: minted.tokenHash,
        rotated_at: new Date().toISOString(),
      },
      "id = :id",
      { id },
    ),
  );
  const record = getById(db, id);
  if (!record) throw new Error("rotateApiKey: row missing after update");
  return { record, plaintext: minted.plaintext };
}
