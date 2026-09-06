import { Router } from "express";
import type Database from "better-sqlite3";
import { createApiKey, listApiKeys, revokeApiKey, rotateApiKey } from "../../apikeys/repo.js";
import { maskSecret, uiDate } from "../../apikeys/secret.js";
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

function settingsLocals(
  req: Parameters<typeof getSession>[0],
  res: { locals: { user?: { id: number } } },
  extras: {
    errors?: Record<string, string>;
    passwordError?: string | null;
    nameError?: string | null;
    plaintext?: string | null;
    flash?: string[];
  } = {},
) {
  const user = res.locals.user;
  if (!user) throw new Error("settings: user missing after requireUser");
  const keys = listApiKeys(dbOf(req), user.id).map((k) => ({
    id: k.id,
    name: k.name,
    masked: maskSecret(k.prefix, k.secret_tail),
    created: uiDate(k.created_at),
    lastUsed: uiDate(k.last_used_at),
    lastRotated: uiDate(k.last_rotated_at),
  }));
  return {
    title: "Settings",
    flash: extras.flash ?? takeFlash(req),
    errors: extras.errors ?? {},
    passwordError: extras.passwordError ?? null,
    nameError: extras.nameError ?? null,
    plaintext: extras.plaintext ?? null,
    apiKeys: keys,
  };
}

/**
 * Account page, password change, and named API keys.
 */
export function settingsRouter(): Router {
  const router = Router();
  router.use(requireUser);

  router.get("/", (req, res) => {
    res.render("settings", settingsLocals(req, res));
  });

  router.post("/api-keys", (req, res) => {
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) {
      res.status(400).render(
        "settings",
        settingsLocals(req, res, {
          flash: [],
          nameError: "Name is required",
          errors: { name: "Name is required" },
        }),
      );
      return;
    }
    const created = createApiKey(dbOf(req), res.locals.user!.id, name);
    res.status(200).render(
      "settings",
      settingsLocals(req, res, {
        flash: ["API key created. Copy the secret now — it will not be shown again."],
        plaintext: created.plaintext,
      }),
    );
  });

  router.post("/api-keys/:id/rotate", (req, res) => {
    const id = parseId(String(req.params.id));
    if (id == null) {
      res.status(404).render("error", {
        title: "Not found",
        status: 404,
        message: "That API key was not found.",
      });
      return;
    }
    const rotated = rotateApiKey(dbOf(req), res.locals.user!.id, id);
    if (!rotated) {
      res.status(404).render("error", {
        title: "Not found",
        status: 404,
        message: "That API key was not found.",
      });
      return;
    }
    res.status(200).render(
      "settings",
      settingsLocals(req, res, {
        flash: ["API key rotated. Copy the new secret now — it will not be shown again."],
        plaintext: rotated.plaintext,
      }),
    );
  });

  router.post("/api-keys/:id/revoke", (req, res) => {
    const id = parseId(String(req.params.id));
    if (id == null) {
      res.status(404).render("error", {
        title: "Not found",
        status: 404,
        message: "That API key was not found.",
      });
      return;
    }
    const ok = revokeApiKey(dbOf(req), res.locals.user!.id, id);
    if (!ok) {
      res.status(404).render("error", {
        title: "Not found",
        status: 404,
        message: "That API key was not found.",
      });
      return;
    }
    pushFlash(req, "API key revoked. The secret no longer works.");
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
        settingsLocals(req, res, {
          flash: [],
          errors,
          passwordError,
        }),
      );
      return;
    }
    updatePassword(dbOf(req), user.id, next);
    pushFlash(req, "Password updated.");
    res.redirect(302, "/settings");
  });

  return router;
}
