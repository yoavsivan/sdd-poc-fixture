import type { RequestHandler } from "express";
import type Database from "better-sqlite3";
import { findActiveApiKeyByPlaintext, touchApiKeyLastUsed } from "../../api-keys/repo.js";
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

function isApiPath(req: { originalUrl?: string; path: string }): boolean {
  const raw = (req.originalUrl || req.path || "").split("?")[0];
  return raw === "/api" || raw.startsWith("/api/");
}

function bearerToken(header: unknown): string | null {
  const raw = Array.isArray(header) ? header[0] : header;
  if (typeof raw !== "string") return null;
  const match = raw.match(/^Bearer\s+(\S+)$/i);
  if (!match) return null;
  return match[1];
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
 * When no session user is present, authenticate `/api/*` with
 * `Authorization: Bearer <key>` as the owning user.
 */
export const loadApiKey: RequestHandler = (req, res, next) => {
  if (res.locals.user || !isApiPath(req)) {
    next();
    return;
  }
  const token = bearerToken(req.headers.authorization);
  if (!token) {
    next();
    return;
  }
  const key = findActiveApiKeyByPlaintext(dbOf(req), token);
  if (!key) {
    next();
    return;
  }
  const row = findById(dbOf(req), key.userId);
  if (!row) {
    next();
    return;
  }
  touchApiKeyLastUsed(dbOf(req), key.id);
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
