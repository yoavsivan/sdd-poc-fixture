import type { RequestHandler } from "express";
import type Database from "better-sqlite3";
import { findActiveByTokenHash, touchLastUsed } from "../../api-keys/repo.js";
import { hashSecret } from "../../api-keys/secret.js";
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

function headerValue(raw: string | string[] | undefined): string {
  if (!raw) return "";
  return Array.isArray(raw) ? (raw[0] ?? "") : raw;
}

/**
 * If the header is a Bearer scheme, return { present: true, token }.
 * Other schemes (or no header) return { present: false }.
 */
export function parseBearerAuthorization(header: string | string[] | undefined): {
  present: boolean;
  token: string;
} {
  const value = headerValue(header).trim();
  if (!value) return { present: false, token: "" };
  const match = /^Bearer(?:\s+(.*))?$/i.exec(value);
  if (!match) return { present: false, token: "" };
  return { present: true, token: (match[1] ?? "").trim() };
}

/**
 * Copy session.data.userId onto res.locals.user when the user still exists.
 * On `/api/*`, a Bearer header is decisive and ignores the cookie.
 */
export const loadUser: RequestHandler = (req, res, next) => {
  const db = dbOf(req);
  if (isApiPath(req.path)) {
    const bearer = parseBearerAuthorization(req.headers.authorization);
    if (bearer.present) {
      if (!bearer.token) {
        res.locals.user = undefined;
        next();
        return;
      }
      const key = findActiveByTokenHash(db, hashSecret(bearer.token));
      if (!key) {
        res.locals.user = undefined;
        next();
        return;
      }
      const row = findById(db, key.user_id);
      if (!row) {
        res.locals.user = undefined;
        next();
        return;
      }
      touchLastUsed(db, key.id);
      res.locals.user = toPublicUser(row);
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
  const row = findById(db, userId);
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
