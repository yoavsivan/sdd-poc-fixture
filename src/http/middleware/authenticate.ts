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

function parseBearer(header: unknown): string | null {
  const raw = Array.isArray(header) ? header[0] : header;
  if (typeof raw !== "string") return null;
  const match = /^Bearer\s+(\S+)$/i.exec(raw.trim());
  return match ? match[1] : null;
}

/**
 * Copy session.data.userId onto res.locals.user when the user still exists.
 * If there is no session user, accept a valid API key Bearer secret.
 */
export const loadUser: RequestHandler = (req, res, next) => {
  const session = getSession(req);
  const userId = session.data.userId;
  if (typeof userId === "number" && Number.isInteger(userId) && userId >= 1) {
    const row = findById(dbOf(req), userId);
    if (row) {
      res.locals.user = toPublicUser(row);
      next();
      return;
    }
    delete session.data.userId;
  }
  res.locals.user = undefined;

  const token = parseBearer(req.headers.authorization);
  if (!token) {
    next();
    return;
  }
  const db = dbOf(req);
  const key = findApiKeyBySecret(db, token);
  if (!key) {
    next();
    return;
  }
  const owner = findById(db, key.userId);
  if (!owner) {
    next();
    return;
  }
  touchApiKeyLastUsed(db, key.id);
  res.locals.user = toPublicUser(owner);
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
