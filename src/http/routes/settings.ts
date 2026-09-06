import { Router } from "express";
import type Database from "better-sqlite3";
import { createApiKey, listActiveKeys, revokeApiKey, rotateApiKey } from "../../api-keys/repo.js";
import { maskSecret, utcDateOnly } from "../../api-keys/secret.js";
import type { ApiKeyRecord } from "../../api-keys/repo.js";
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

function takePlaintext(req: Parameters<typeof getSession>[0]): string | null {
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

export interface ApiKeyView {
  id: number;
  name: string;
  masked: string;
  created: string;
  lastUsed: string | null;
  lastRotated: string | null;
}

function toView(row: ApiKeyRecord): ApiKeyView {
  return {
    id: row.id,
    name: row.name,
    masked: maskSecret(row.prefix, row.suffix),
    created: utcDateOnly(row.created_at),
    lastUsed: row.last_used_at ? utcDateOnly(row.last_used_at) : null,
    lastRotated: row.rotated_at ? utcDateOnly(row.rotated_at) : null,
  };
}

function settingsPage(
  req: Parameters<typeof getSession>[0],
  res: { locals: { user?: { id: number } } },
  extra: { errors?: Record<string, string>; passwordError?: string | null },
) {
  const user = res.locals.user!;
  const apiKeys = listActiveKeys(dbOf(req), user.id).map(toView);
  return {
    title: "Settings",
    flash: extra.errors && Object.keys(extra.errors).length > 0 ? [] : takeFlash(req),
    errors: extra.errors ?? {},
    passwordError: extra.passwordError ?? null,
    apiKeys,
    apiKeyPlaintext: takePlaintext(req),
  };
}

/**
 * Account page, password change, and named API keys.
 */
export function settingsRouter(): Router {
  const router = Router();
  router.use(requireUser);

  router.get("/", (req, res) => {
    res.render("settings", settingsPage(req, res, {}));
  });

  router.post("/api-keys", (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      res.status(400).render(
        "settings",
        settingsPage(req, res, { errors: { name: "Name is required" } }),
      );
      return;
    }
    const created = createApiKey(dbOf(req), res.locals.user!.id, name);
    const session = getSession(req);
    session.data.apiKeyPlaintext = created.plaintext;
    pushFlash(req, "API key created. Copy the secret now — it will not be shown again.");
    res.redirect(302, "/settings");
  });

  router.post("/api-keys/:id/revoke", (req, res) => {
    const id = parseId(String(req.params.id));
    if (id != null) {
      const ok = revokeApiKey(dbOf(req), res.locals.user!.id, id);
      if (ok) pushFlash(req, "API key revoked. That secret no longer works.");
    }
    res.redirect(302, "/settings");
  });

  router.post("/api-keys/:id/rotate", (req, res) => {
    const id = parseId(String(req.params.id));
    if (id != null) {
      const rotated = rotateApiKey(dbOf(req), res.locals.user!.id, id);
      if (rotated) {
        const session = getSession(req);
        session.data.apiKeyPlaintext = rotated.plaintext;
        pushFlash(req, "API key rotated. Copy the new secret now — it will not be shown again.");
      }
    }
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
      res.status(400).render(
        "settings",
        settingsPage(req, res, { errors, passwordError }),
      );
      return;
    }
    updatePassword(dbOf(req), user.id, next);
    pushFlash(req, "Password updated.");
    res.redirect(302, "/settings");
  });

  return router;
}
