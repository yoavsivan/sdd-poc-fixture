import { Router } from "express";
import type Database from "better-sqlite3";
import {
  createApiKey,
  formatIsoDate,
  listApiKeys,
  maskedSecret,
  revokeApiKey,
  rotateApiKey,
} from "../../api-keys/repo.js";
import { findById, updatePassword } from "../../users/repo.js";
import { verifyPassword } from "../../users/password.js";
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

function parseId(raw: string): number | null {
  if (!/^[0-9]+$/.test(raw)) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

function takeCreatedPlaintext(req: Parameters<typeof getSession>[0]): string | null {
  const session = getSession(req);
  const value = session.data.apiKeyPlaintext;
  delete session.data.apiKeyPlaintext;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function keysForView(req: { app: { locals: Record<string, unknown> } }, userId: number) {
  return listApiKeys(dbOf(req), userId).map((k) => ({
    id: k.id,
    name: k.name,
    masked: maskedSecret(k.prefix, k.lastFour),
    created: formatIsoDate(k.createdAt),
    lastUsed: formatIsoDate(k.lastUsedAt),
    lastRotated: formatIsoDate(k.lastRotatedAt),
  }));
}

/**
 * Account page, password change, and named API keys for Bearer auth on /api/*.
 */
export function settingsRouter(): Router {
  const router = Router();
  router.use(requireUser);

  router.get("/", (req, res) => {
    const user = res.locals.user!;
    const keys = keysForView(req, user.id);
    res.render("settings", {
      title: "Settings",
      flash: takeFlash(req),
      errors: {},
      passwordError: null,
      apiKeys: keys,
      apiKeyPlaintext: takeCreatedPlaintext(req),
      apiKeyNameError: null,
    });
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
      const keys = keysForView(req, user.id);
      res.status(400).render("settings", {
        title: "Settings",
        flash: [],
        errors,
        passwordError,
        apiKeys: keys,
        apiKeyPlaintext: null,
        apiKeyNameError: null,
      });
      return;
    }
    updatePassword(dbOf(req), user.id, next);
    pushFlash(req, "Password updated.");
    res.redirect(302, "/settings");
  });

  router.post("/api-keys", (req, res) => {
    const name = typeof req.body?.["api-key-name"] === "string" ? req.body["api-key-name"] : "";
    const trimmed = name.trim();
    const user = res.locals.user!;
    if (!trimmed) {
      const keys = keysForView(req, user.id);
      res.status(400).render("settings", {
        title: "Settings",
        flash: [],
        errors: {},
        passwordError: null,
        apiKeys: keys,
        apiKeyPlaintext: null,
        apiKeyNameError: "Give this key a name",
      });
      return;
    }
    const created = createApiKey(dbOf(req), user.id, trimmed);
    getSession(req).data.apiKeyPlaintext = created.plaintext;
    pushFlash(req, "API key created. Copy the secret now — it is shown once.");
    res.redirect(302, "/settings");
  });

  router.post("/api-keys/:id/revoke", (req, res) => {
    const id = parseId(String(req.params.id));
    const user = res.locals.user!;
    if (id != null) {
      revokeApiKey(dbOf(req), user.id, id);
    }
    pushFlash(req, "API key revoked. That secret no longer works.");
    res.redirect(302, "/settings");
  });

  router.post("/api-keys/:id/rotate", (req, res) => {
    const id = parseId(String(req.params.id));
    const user = res.locals.user!;
    if (id != null) {
      const rotated = rotateApiKey(dbOf(req), user.id, id);
      if (rotated) {
        getSession(req).data.apiKeyPlaintext = rotated.plaintext;
        pushFlash(req, "API key rotated. Copy the new secret now — it is shown once.");
      }
    }
    res.redirect(302, "/settings");
  });

  return router;
}
