import { Router } from "express";
import type Database from "better-sqlite3";
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

/**
 * Account page and password change. The "using the API" section is a seam
 * a later change can extend with another section in the same template.
 */
export function settingsRouter(): Router {
  const router = Router();
  router.use(requireUser);

  router.get("/", (req, res) => {
    res.render("settings", {
      title: "Settings",
      flash: takeFlash(req),
      errors: {},
      passwordError: null,
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
      res.status(400).render("settings", {
        title: "Settings",
        flash: [],
        errors,
        passwordError,
      });
      return;
    }
    updatePassword(dbOf(req), user.id, next);
    pushFlash(req, "Password updated.");
    res.redirect(302, "/settings");
  });

  return router;
}
