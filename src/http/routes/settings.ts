import { Router } from "express";
import type Database from "better-sqlite3";
import {
  createApiKey,
  listApiKeys,
  normalizeKeyName,
  revokeApiKey,
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

function settingsLocals(
  req: Parameters<typeof getSession>[0],
  res: { locals: { user?: { id: number } } },
  extra: {
    flash?: string[];
    errors?: Record<string, string>;
    passwordError?: string | null;
    apiKeyError?: string | null;
  },
) {
  const user = res.locals.user!;
  return {
    title: "Settings",
    flash: extra.flash ?? takeFlash(req),
    errors: extra.errors ?? {},
    passwordError: extra.passwordError ?? null,
    apiKeyError: extra.apiKeyError ?? null,
    apiKeyPlaintext: takePlaintext(req),
    apiKeys: listApiKeys(dbOf(req), user.id),
  };
}

/**
 * Account page, password change, and named API keys.
 */
export function settingsRouter(): Router {
  const router = Router();
  router.use(requireUser);

  router.get("/", (req, res) => {
    res.render("settings", settingsLocals(req, res, {}));
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
        settingsLocals(req, res, { flash: [], errors, passwordError }),
      );
      return;
    }
    updatePassword(dbOf(req), user.id, next);
    pushFlash(req, "Password updated.");
    res.redirect(302, "/settings");
  });

  router.post("/api-keys", (req, res) => {
    const parsed = normalizeKeyName(req.body?.api_key_name);
    if (parsed.error) {
      res.status(400).render(
        "settings",
        settingsLocals(req, res, {
          flash: [],
          apiKeyError: parsed.error,
          errors: { api_key_name: parsed.error },
        }),
      );
      return;
    }
    const created = createApiKey(dbOf(req), res.locals.user!.id, parsed.name);
    getSession(req).data.apiKeyPlaintext = created.plaintext;
    pushFlash(req, "API key created. Copy the secret now; it is shown only once.");
    res.redirect(302, "/settings");
  });

  router.post("/api-keys/:id/revoke", (req, res) => {
    const id = parseId(String(req.params.id));
    if (id != null) {
      revokeApiKey(dbOf(req), res.locals.user!.id, id);
    }
    pushFlash(req, "API key revoked. That secret no longer works.");
    res.redirect(302, "/settings");
  });

  return router;
}
