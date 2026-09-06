import { Router } from "express";
import type Database from "better-sqlite3";
import { createApiKey, listApiKeys, revokeApiKey } from "../../apikeys/repo.js";
import { findById, updatePassword } from "../../users/repo.js";
import { verifyPassword } from "../../users/password.js";
import { isoDateUtc } from "../dates.js";
import { requireUser } from "../middleware/authenticate.js";
import { getSession } from "../middleware/session.js";

function dbOf(req: { app: { locals: Record<string, unknown> } }): Database.Database {
  const db = req.app.locals.db as Database.Database | undefined;
  if (!db) throw new Error("settings routes: app.locals.db is missing");
  return db;
}

function takeFlash(req: Parameters<typeof getSession>[0]): string[] {
  const session = getSession(req);
  const list = session.data.flash ? session.data.flash.slice() : [];
  session.data.flash = [];
  return list;
}

function pushFlash(req: Parameters<typeof getSession>[0], msg: string): void {
  const session = getSession(req);
  const list = session.data.flash ? session.data.flash.slice() : [];
  list.push(msg);
  session.data.flash = list;
}

function takeApiKeyPlaintext(req: Parameters<typeof getSession>[0]): string | null {
  const session = getSession(req);
  const value = session.data.apiKeyPlaintext;
  delete session.data.apiKeyPlaintext;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseId(raw: string): number | null {
  if (!/^[0-9]+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function apiKeyViews(db: Database.Database, userId: number) {
  return listApiKeys(db, userId).map((key) => ({
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    last4: key.last4,
    createdDate: isoDateUtc(key.createdAt),
    lastUsedDate: isoDateUtc(key.lastUsedAt),
  }));
}

/**
 * Account page, password change, and named API keys.
 */
export function settingsRouter(): Router {
  const router = Router();
  router.use(requireUser);

  router.get("/", (req, res) => {
    const user = res.locals.user!;
    res.render("settings", {
      title: "Settings",
      flash: takeFlash(req),
      errors: {},
      passwordError: null,
      apiKeys: apiKeyViews(dbOf(req), user.id),
      apiKeyPlaintext: takeApiKeyPlaintext(req),
      apiKeyNameError: null,
    });
  });

  router.post("/api-keys", (req, res) => {
    const user = res.locals.user!;
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      res.status(400).render("settings", {
        title: "Settings",
        flash: [],
        errors: {},
        passwordError: null,
        apiKeys: apiKeyViews(dbOf(req), user.id),
        apiKeyPlaintext: null,
        apiKeyNameError: "Name is required",
      });
      return;
    }
    const created = createApiKey(dbOf(req), user.id, name);
    const session = getSession(req);
    session.data.apiKeyPlaintext = created.plaintext;
    pushFlash(req, "API key created. Copy the secret now — it is shown once.");
    res.redirect(302, "/settings");
  });

  router.post("/api-keys/:id/revoke", (req, res) => {
    const user = res.locals.user!;
    const id = parseId(String(req.params.id));
    if (id != null) {
      revokeApiKey(dbOf(req), user.id, id);
    }
    pushFlash(req, "API key revoked. That secret no longer works.");
    res.redirect(302, "/settings");
  });

  router.post("/password", (req, res) => {
    const current = typeof req.body?.current === "string" ? req.body.current : "";
    const next = typeof req.body?.next === "string" ? req.body.next : "";
    const confirm = typeof req.body?.confirm === "string" ? req.body.confirm : "";
    const user = res.locals.user!;
    const row = findById(dbOf(req), user.id);
    const errors: Record<string, string> = {};
    let passwordError: string | null = null;

    if (!row || !verifyPassword(current, row.password_hash)) {
      errors.current = "Current password is not correct";
      passwordError = "Current password is not correct";
    }
    if (!next || next.length < 8) {
      errors.next = "New password must be at least 8 characters";
    }
    if (next !== confirm) {
      errors.confirm = "New password and confirmation do not match";
    }
    if (Object.keys(errors).length > 0) {
      res.status(400).render("settings", {
        title: "Settings",
        flash: [],
        errors,
        passwordError,
        apiKeys: apiKeyViews(dbOf(req), user.id),
        apiKeyPlaintext: null,
        apiKeyNameError: null,
      });
      return;
    }
    updatePassword(dbOf(req), user.id, next);
    pushFlash(req, "Password updated.");
    res.redirect(302, "/settings");
  });

  return router;
}
