import type { RequestHandler } from "express";
import type Database from "better-sqlite3";
import { findActiveByPlaintext, touchLastUsed } from "../../apikeys/repo.js";
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

function isApiPath(path: string): boolean {
  return path === "/api" || path.startsWith("/api/");
}

/** Present Bearer token, or null if the Authorization scheme is not Bearer. */
function bearerToken(header: unknown): string | null {
  if (typeof header !== "string") return null;
  const match = /^\s*Bearer(?:\s+(.*))?$/i.exec(header);
  if (!match) return null;
  return (match[1] ?? "").trim();
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
 * On `/api/*`, a Bearer header authenticates exclusively as the key owner.
 * HTML routes ignore Bearer so cookie sessions stay how the UI signs in.
 */
export const loadApiKey: RequestHandler = (req, res, next) => {
  if (!isApiPath(req.path)) {
    next();
    return;
  }
  const token = bearerToken(req.headers.authorization);
  if (token === null) {
    next();
    return;
  }
  const key = findActiveByPlaintext(dbOf(req), token);
  if (!key) {
    res.locals.user = undefined;
    next();
    return;
  }
  touchLastUsed(dbOf(req), key.id);
  const row = findById(dbOf(req), key.user_id);
  res.locals.user = row ? toPublicUser(row) : undefined;
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
