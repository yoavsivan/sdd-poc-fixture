import { Router } from "express";
import type Database from "better-sqlite3";
import { findByUsername } from "../../users/repo.js";
import { verifyPassword } from "../../users/password.js";
import { getSession } from "../middleware/session.js";

function dbOf(req: { app: { locals: Record<string, unknown> } }): Database.Database {
  const db = req.app.locals.db as Database.Database | undefined;
  if (!db) throw new Error("auth routes: app.locals.db is missing");
  return db;
}

function safeNext(raw: unknown): string {
  if (typeof raw !== "string") return "/items";
  const v = raw.trim();
  if (!v.startsWith("/")) return "/items";
  if (v.startsWith("//")) return "/items";
  if (v.startsWith("/signin")) return "/items";
  if (v.startsWith("/signout")) return "/items";
  return v;
}

function flashOf(session: { data: { flash?: string[] } }): string[] {
  const list = session.data.flash ? session.data.flash.slice() : [];
  session.data.flash = [];
  return list;
}

/**
 * Sign-in form and sign-out. Bad credentials re-render with 401.
 */
export function authRouter(): Router {
  const router = Router();

  router.get("/signin", (req, res) => {
    if (res.locals.user) {
      res.redirect(302, safeNext(req.query.next));
      return;
    }
    const session = getSession(req);
    res.status(200).render("signin", {
      title: "Sign in",
      next: safeNext(req.query.next),
      error: null,
      username: "",
      flash: flashOf(session),
    });
  });

  router.post("/signin", (req, res) => {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const nextUrl = safeNext(req.body?.next ?? req.query.next);
    const session = getSession(req);
    const row = username ? findByUsername(dbOf(req), username) : undefined;
    const ok = row ? verifyPassword(password, row.password_hash) : false;
    if (!ok || !row) {
      res.status(401).render("signin", {
        title: "Sign in",
        next: nextUrl,
        error: "Those credentials did not match.",
        username,
        flash: [],
      });
      return;
    }
    session.data.userId = row.id;
    session.regenerate((err) => {
      if (err) {
        res.status(500).render("error", {
          title: "Server error",
          status: 500,
          message: "Could not start a session.",
        });
        return;
      }
      session.data.userId = row.id;
      res.redirect(302, nextUrl);
    });
  });

  router.post("/signout", (req, res) => {
    const session = getSession(req);
    session.destroy(() => {
      res.redirect(302, "/signin");
    });
  });

  return router;
}
