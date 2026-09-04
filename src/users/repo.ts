import type Database from "better-sqlite3";
import legacyQuery from "../legacy/query.cjs";
import { get, run } from "../db/exec.js";
import { hashPassword } from "./password.js";

const { compile, insert, update } = legacyQuery;

export interface UserRecord {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface PublicUser {
  id: number;
  username: string;
}

function toPublic(row: UserRecord): PublicUser {
  return { id: row.id, username: row.username };
}

/**
 * Look up a user by username (case-insensitive via the column collation).
 */
export function findByUsername(db: Database.Database, username: string): UserRecord | undefined {
  return get<UserRecord>(
    db,
    compile("SELECT id, username, password_hash, created_at FROM users WHERE username = :username", {
      username,
    }),
  );
}

/**
 * Look up a user by primary key.
 */
export function findById(db: Database.Database, id: number): UserRecord | undefined {
  return get<UserRecord>(
    db,
    compile("SELECT id, username, password_hash, created_at FROM users WHERE id = :id", { id }),
  );
}

/**
 * Insert a user with a hashed password. Returns the public view.
 */
export function createUser(
  db: Database.Database,
  input: { username: string; password: string },
): PublicUser {
  const password_hash = hashPassword(input.password);
  const created_at = new Date().toISOString();
  const result = run(
    db,
    insert("users", {
      username: input.username,
      password_hash,
      created_at,
    }),
  );
  const id = Number(result.lastInsertRowid);
  const row = findById(db, id);
  if (!row) throw new Error("createUser: row missing after insert");
  return toPublic(row);
}

/**
 * Replace the stored password hash for a user.
 */
export function updatePassword(db: Database.Database, userId: number, password: string): void {
  const password_hash = hashPassword(password);
  run(
    db,
    update("users", { password_hash }, "id = :id", { id: userId }),
  );
}

/**
 * Public fields only, used by views and loadUser.
 */
export function toPublicUser(row: UserRecord): PublicUser {
  return toPublic(row);
}
