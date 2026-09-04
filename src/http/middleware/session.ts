import type { Request, RequestHandler } from "express";
import type { Config } from "../../config.js";
import legacySession from "../../legacy/session.cjs";
import type { Session, SessionStore } from "../../legacy/session.cjs";

const { createSessionMiddleware, MemoryStore } = legacySession;

export { MemoryStore };

declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
    interface Locals {
      user?: { id: number; username: string };
      csrf?: string;
      flash?: string[];
      title?: string;
    }
  }
}

/**
 * Attach the legacy signed-cookie session middleware.
 */
export function sessionMiddleware(cfg: Config, store?: SessionStore): RequestHandler {
  return createSessionMiddleware({
    secret: cfg.sessionSecret,
    cookieName: "shelfmark.sid",
    maxAgeMs: 7 * 24 * 60 * 60 * 1000,
    secure: cfg.cookieSecure,
    store: store ?? new MemoryStore(),
  });
}

/**
 * Typed accessor for req.session. Throws when the middleware did not run.
 */
export function getSession(req: Request): Session {
  if (!req.session) {
    throw new Error("getSession: session middleware is not attached");
  }
  return req.session;
}
