import type Database from "better-sqlite3";
import legacyQuery from "../legacy/query.cjs";
import { all, get, run } from "../db/exec.js";
import { generateApiKeySecret, hashSecret, isoDateUtc, maskApiKey } from "./secret.js";

const { compile, insert, update } = legacyQuery;

export interface ApiKeyRecord {
  id: number;
  user_id: number;
  name: string;
  prefix: string;
  tail: string;
  secret_hash: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface ApiKeyView {
  id: number;
  name: string;
  masked: string;
  created: string;
  lastUsed: string;
}

export interface CreatedApiKey {
  id: number;
  name: string;
  plaintext: string;
  view: ApiKeyView;
}

function toView(row: ApiKeyRecord): ApiKeyView {
  return {
    id: row.id,
    name: row.name,
    masked: maskApiKey(row.prefix, row.tail),
    created: isoDateUtc(row.created_at),
    lastUsed: isoDateUtc(row.last_used_at),
  };
}

function nowUtc(): string {
  return new Date().toISOString();
}

export function normalizeKeyName(raw: unknown): { name: string; error?: string } {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) return { name: "", error: "Name is required" };
  if (name.length > 80) return { name: "", error: "Name must be 80 characters or fewer" };
  return { name };
}

export function createApiKey(
  db: Database.Database,
  userId: number,
  name: string,
): CreatedApiKey {
  const secret = generateApiKeySecret();
  const created_at = nowUtc();
  const result = run(
    db,
    insert("api_keys", {
      user_id: userId,
      name,
      prefix: secret.prefix,
      tail: secret.tail,
      secret_hash: secret.secretHash,
      created_at,
    }),
  );
  const id = Number(result.lastInsertRowid);
  const row = get<ApiKeyRecord>(
    db,
    compile(
      `SELECT id, user_id, name, prefix, tail, secret_hash, created_at, last_used_at, revoked_at
       FROM api_keys WHERE id = :id`,
      { id },
    ),
  );
  if (!row) throw new Error("createApiKey: row missing after insert");
  return { id, name: row.name, plaintext: secret.plaintext, view: toView(row) };
}

export function listApiKeys(db: Database.Database, userId: number): ApiKeyView[] {
  const rows = all<ApiKeyRecord>(
    db,
    compile(
      `SELECT id, user_id, name, prefix, tail, secret_hash, created_at, last_used_at, revoked_at
       FROM api_keys
       WHERE user_id = :userId AND revoked_at IS NULL
       ORDER BY created_at DESC, id DESC`,
      { userId },
    ),
  );
  return rows.map(toView);
}

export function findActiveBySecret(
  db: Database.Database,
  plaintext: string,
): ApiKeyRecord | undefined {
  if (!plaintext) return undefined;
  return get<ApiKeyRecord>(
    db,
    compile(
      `SELECT id, user_id, name, prefix, tail, secret_hash, created_at, last_used_at, revoked_at
       FROM api_keys
       WHERE secret_hash = :secretHash AND revoked_at IS NULL`,
      { secretHash: hashSecret(plaintext) },
    ),
  );
}

export function touchLastUsed(db: Database.Database, id: number): void {
  run(db, update("api_keys", { last_used_at: nowUtc() }, "id = :id", { id }));
}

export function revokeApiKey(db: Database.Database, userId: number, id: number): boolean {
  const result = run(
    db,
    update(
      "api_keys",
      { revoked_at: nowUtc() },
      "id = :id AND user_id = :userId AND revoked_at IS NULL",
      { id, userId },
    ),
  );
  return result.changes > 0;
}
