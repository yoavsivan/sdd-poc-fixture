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

/**
 * Copy session.data.userId onto res.locals.user when the user still exists.
 */
export const loadUser: RequestHandler = (req, res, next) => {
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

function bearerSecret(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  if (!match) return null;
  return match[1];
}

/**
 * Resolve Authorization: Bearer for /api/* when no cookie user is present.
 * Cookie sessions remain the UI path; this does not touch the legacy session module.
 */
export const loadApiKeyUser: RequestHandler = (req, res, next) => {
  if (res.locals.user) {
    next();
    return;
  }
  const secret = bearerSecret(req.get("authorization") ?? undefined);
  if (!secret) {
    next();
    return;
  }
  const row = findActiveBySecret(dbOf(req), secret);
  if (!row) {
    next();
    return;
  }
  const user = findById(dbOf(req), row.user_id);
  if (!user) {
    next();
    return;
  }
  touchLastUsed(dbOf(req), row.id);
  res.locals.user = toPublicUser(user);
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
