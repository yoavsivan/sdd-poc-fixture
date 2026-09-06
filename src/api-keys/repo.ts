import crypto from "node:crypto";
import type Database from "better-sqlite3";
import legacyQuery from "../legacy/query.cjs";
import { all, get, run } from "../db/exec.js";

const { compile, insert, update } = legacyQuery;

const PREFIX_RANDOM_BYTES = 4;
const SECRET_RANDOM_BYTES = 32;

export interface ApiKeyRow {
  id: number;
  user_id: number;
  name: string;
  prefix: string;
  last_four: string;
  secret_hash: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export interface ApiKeyPublic {
  id: number;
  userId: number;
  name: string;
  prefix: string;
  lastFour: string;
  createdAt: string;
  lastUsedAt: string | null;
}

function hashSecret(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext, "utf8").digest("hex");
}

function toPublic(row: ApiKeyRow): ApiKeyPublic {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    prefix: row.prefix,
    lastFour: row.last_four,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

/** UTC ISO-8601 timestamp stored internally; UI uses the date part `YYYY-MM-DD`. */
export function formatIsoDate(utc: string | null | undefined): string {
  if (!utc) return "";
  const d = utc.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
}

export function maskedSecret(prefix: string, lastFour: string): string {
  return `${prefix}…${lastFour}`;
}

export function generateApiKeyPlaintext(): { prefix: string; plaintext: string; lastFour: string } {
  const prefix = `smk_${crypto.randomBytes(PREFIX_RANDOM_BYTES).toString("hex")}`;
  const secret = crypto.randomBytes(SECRET_RANDOM_BYTES).toString("base64url");
  const plaintext = `${prefix}.${secret}`;
  const lastFour = plaintext.slice(-4);
  return { prefix, plaintext, lastFour };
}

export function createApiKey(
  db: Database.Database,
  userId: number,
  name: string,
): { key: ApiKeyPublic; plaintext: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("createApiKey: name is required");
  }
  const { prefix, plaintext, lastFour } = generateApiKeyPlaintext();
  const created_at = new Date().toISOString();
  const result = run(
    db,
    insert("api_keys", {
      user_id: userId,
      name: trimmed,
      prefix,
      last_four: lastFour,
      secret_hash: hashSecret(plaintext),
      created_at,
    }),
  );
  const id = Number(result.lastInsertRowid);
  const row = get<ApiKeyRow>(
    db,
    compile(
      `SELECT id, user_id, name, prefix, last_four, secret_hash, created_at, last_used_at, revoked_at
       FROM api_keys WHERE id = :id`,
      { id },
    ),
  );
  if (!row) throw new Error("createApiKey: row missing after insert");
  return { key: toPublic(row), plaintext };
}

export function listApiKeys(db: Database.Database, userId: number): ApiKeyPublic[] {
  const rows = all<ApiKeyRow>(
    db,
    compile(
      `SELECT id, user_id, name, prefix, last_four, secret_hash, created_at, last_used_at, revoked_at
       FROM api_keys
       WHERE user_id = :userId AND revoked_at IS NULL
       ORDER BY created_at DESC, id DESC`,
      { userId },
    ),
  );
  return rows.map(toPublic);
}

export function findActiveApiKeyByPlaintext(
  db: Database.Database,
  plaintext: string,
): ApiKeyPublic | undefined {
  if (!plaintext) return undefined;
  const row = get<ApiKeyRow>(
    db,
    compile(
      `SELECT id, user_id, name, prefix, last_four, secret_hash, created_at, last_used_at, revoked_at
       FROM api_keys
       WHERE secret_hash = :hash AND revoked_at IS NULL`,
      { hash: hashSecret(plaintext) },
    ),
  );
  return row ? toPublic(row) : undefined;
}

export function touchApiKeyLastUsed(db: Database.Database, id: number): void {
  const now = new Date().toISOString();
  run(db, update("api_keys", { last_used_at: now }, "id = :id", { id }));
}

export function revokeApiKey(db: Database.Database, userId: number, id: number): boolean {
  const row = get<ApiKeyRow>(
    db,
    compile(
      `SELECT id, user_id, name, prefix, last_four, secret_hash, created_at, last_used_at, revoked_at
       FROM api_keys
       WHERE id = :id AND user_id = :userId AND revoked_at IS NULL`,
      { id, userId },
    ),
  );
  if (!row) return false;
  const now = new Date().toISOString();
  run(db, update("api_keys", { revoked_at: now }, "id = :id", { id }));
  return true;
}
