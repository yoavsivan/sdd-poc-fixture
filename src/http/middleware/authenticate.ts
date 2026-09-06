import type { RequestHandler } from "express";
import type Database from "better-sqlite3";
import { findApiKeyBySecret, touchApiKeyLastUsed } from "../../apikeys/repo.js";
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

function requestPath(req: { originalUrl?: string; url: string }): string {
  const raw = req.originalUrl || req.url || "";
  const q = raw.indexOf("?");
  return q === -1 ? raw : raw.slice(0, q);
}

function isApiPath(path: string): boolean {
  return path === "/api" || path.startsWith("/api/");
}

/**
 * On /api/*, Authorization Bearer authenticates as the key owner.
 * An invalid Bearer does not fall back to the cookie.
 */
export const loadApiKey: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (typeof header !== "string") {
    next();
    return;
  }
  const match = header.match(/^Bearer\s+(\S+)/i);
  if (!match) {
    next();
    return;
  }
  if (!isApiPath(requestPath(req))) {
    next();
    return;
  }
  const token = match[1];
  const key = findApiKeyBySecret(dbOf(req), token);
  if (!key) {
    res.locals.apiKeyInvalid = true;
    res.locals.user = undefined;
    next();
    return;
  }
  const row = findById(dbOf(req), key.userId);
  if (!row) {
    res.locals.apiKeyInvalid = true;
    res.locals.user = undefined;
    next();
    return;
  }
  touchApiKeyLastUsed(dbOf(req), key.id);
  res.locals.apiKeyInvalid = false;
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
  if (res.locals.apiKeyInvalid || !res.locals.user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
};
