import type { RequestHandler } from "express";
import type Database from "better-sqlite3";
import { findApiKeyByPlaintext, touchApiKeyLastUsed } from "../../api-keys/repo.js";
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

function readBearer(req: { get: (name: string) => string | undefined }): string | null {
  const header = req.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(\S+)/i.exec(header.trim());
  if (!match) return null;
  return match[1];
}

/**
 * API-only: if Authorization: Bearer is present, resolve it to the owning user.
 * An invalid Bearer clears the cookie user so /api/* returns 401.
 */
export const loadApiKey: RequestHandler = (req, res, next) => {
  const token = readBearer(req);
  if (token === null) {
    next();
    return;
  }
  const key = findApiKeyByPlaintext(dbOf(req), token);
  if (!key) {
    res.locals.user = undefined;
    next();
    return;
  }
  const row = findById(dbOf(req), key.userId);
  if (!row) {
    res.locals.user = undefined;
    next();
    return;
  }
  touchApiKeyLastUsed(dbOf(req), key.id);
  res.locals.user = toPublicUser(row);
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
