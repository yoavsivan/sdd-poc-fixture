import crypto from "node:crypto";
import type { RequestHandler } from "express";
import { getSession } from "./session.js";

function isApiPath(path: string): boolean {
  return path === "/api" || path.startsWith("/api/");
}

function wantsCsrfCheck(method: string): boolean {
  const m = method.toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
}

function readSubmittedToken(req: { body?: unknown }): string {
  const body = req.body;
  if (body && typeof body === "object" && "_csrf" in body) {
    const v = (body as { _csrf?: unknown })._csrf;
    if (typeof v === "string") return v;
  }
  return "";
}

/**
 * Ensure session.data.csrf exists. Check `_csrf` on every non-/api mutating request.
 */
export const csrfProtection: RequestHandler = (req, res, next) => {
  const session = getSession(req);
  if (!session.data.csrf) {
    session.data.csrf = crypto.randomBytes(16).toString("hex");
  }
  res.locals.csrf = session.data.csrf;

  if (!wantsCsrfCheck(req.method) || isApiPath(req.path)) {
    next();
    return;
  }

  const submitted = readSubmittedToken(req);
  const expected = session.data.csrf;
  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  const ok =
    submitted.length > 0 &&
    a.length === b.length &&
    crypto.timingSafeEqual(a, b);
  if (!ok) {
    res.status(403);
    res.render("error", {
      title: "Forbidden",
      status: 403,
      message: "This form could not be submitted. Reload the page and try again.",
    });
    return;
  }
  next();
};
