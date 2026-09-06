import type { RequestHandler } from "express";
import type Database from "better-sqlite3";
import { findActiveBySecret, touchLastUsed } from "../../api-keys/repo.js";
import { findById, toPublicUser } from "../../users/repo.js";
import { getSession } from "./session.js";

function dbOf(req: { app: { locals: Record<string, unknown> } }): Database.Database {
  const db = req.app.locals.db as Database.Database | undefined;
  if (!db) throw new Error("loadUser: app.locals.db is missing");
  return db;
}

function nextTarget(req: { originalUrl?: string; url: string }): string {
  const raw = req.originalUrl || req.url || "/items";
  if (!raw.startsWith("/")) return "/items";
  if (raw.startsWith("//")) return "/items";
  return raw;
}

function isApiPath(req: { path: string; originalUrl?: string }): boolean {
  const path = req.path || "";
  const original = req.originalUrl || "";
  return (
    path === "/api" ||
    path.startsWith("/api/") ||
    original === "/api" ||
    original.startsWith("/api/")
  );
}

/** Return the Bearer secret when the Authorization scheme is Bearer; otherwise null. */
export function readBearerSecret(header: string | undefined): string | null {
  if (typeof header !== "string") return null;
  const match = /^Bearer[ \t]+(.*)$/i.exec(header);
  if (!match) return null;
  return match[1].trim();
}

function userFromBearer(
  db: Database.Database,
  secret: string,
): { id: number; username: string } | undefined {
  if (!secret) return undefined;
  const key = findActiveBySecret(db, secret);
  if (!key) return undefined;
  const row = findById(db, key.user_id);
  if (!row) return undefined;
  touchLastUsed(db, key.id);
  return toPublicUser(row);
}

/**
 * Copy session.data.userId onto res.locals.user when the user still exists.
 * On /api/*, an Authorization: Bearer header authenticates as the key's owner
 * and does not fall back to the cookie.
 */
export const loadUser: RequestHandler = (req, res, next) => {
  if (isApiPath(req)) {
    const secret = readBearerSecret(req.headers.authorization);
    if (secret !== null) {
      res.locals.user = userFromBearer(dbOf(req), secret);
      next();
      return;
    }
  }

  const session = getSession(req);
  const userId = session.data.userId;
  if (typeof userId !== "number" || !Number.isInteger(userId) || userId < 1) {
    res.locals.user = undefined;
    next();
    return;
  }
  const row = findById(dbOf(req), userId);
  if (!row) {
    delete session.data.userId;
    res.locals.user = undefined;
    next();
    return;
  }
  res.locals.user = toPublicUser(row);
  next();
};

/**
 * UI guard: unsigned visitors are sent to /signin?next=.
 */
export const requireUser: RequestHandler = (req, res, next) => {
  if (!res.locals.user) {
    const target = encodeURIComponent(nextTarget(req));
    res.redirect(302, `/signin?next=${target}`);
    return;
  }
  next();
};

/**
 * API guard: unsigned callers get 401 {"error":"unauthorized"}.
 */
export const requireApiUser: RequestHandler = (_req, res, next) => {
  if (!res.locals.user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
};
