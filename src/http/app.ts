import express from "express";
import type Database from "better-sqlite3";
import type { Config } from "../config.js";
import { createLogger, requestLog, type Logger } from "../logger.js";
import type { SessionStore } from "../legacy/session.cjs";
import { configureViews, publicDir } from "./views.js";
import { sessionMiddleware } from "./middleware/session.js";
import { csrfProtection } from "./middleware/csrf.js";
import { loadUser } from "./middleware/authenticate.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { authRouter } from "./routes/auth.js";
import { itemsRouter } from "./routes/items.js";
import { settingsRouter } from "./routes/settings.js";
import { apiRouter } from "./routes/api.js";
import { healthRouter } from "./routes/health.js";
import { getSession } from "./middleware/session.js";

export interface AppDeps {
  db: Database.Database;
  config: Config;
  store?: SessionStore;
  logger?: Logger;
}

/**
 * Build the Express application. Middleware order lives only here:
 * static → session → csrf → loadUser → routers → 404 → error handler.
 */
export function createApp(deps: AppDeps): express.Express {
  const app = express();
  const logger = deps.logger ?? createLogger(deps.config.logLevel);
  app.locals.db = deps.db;
  app.locals.config = deps.config;
  app.set("env", deps.config.nodeEnv);
  app.disable("x-powered-by");

  configureViews(app);
  app.use(express.urlencoded({ extended: false, limit: "32kb" }));
  app.use(express.json({ limit: "64kb" }));
  app.use(express.static(publicDir, { index: false, maxAge: 0 }));
  app.use(requestLog(logger));
  app.use(sessionMiddleware(deps.config, deps.store));
  app.use(csrfProtection);
  app.use(loadUser);
  app.use((req, res, next) => {
    const session = getSession(req);
    res.locals.csrf = session.data.csrf;
    if (!res.locals.flash) res.locals.flash = [];
    next();
  });

  app.get("/", (_req, res) => {
    res.redirect(302, "/items");
  });
  app.use(healthRouter());
  app.use(authRouter());
  app.use("/items", itemsRouter());
  app.use("/settings", settingsRouter());
  app.use("/api", apiRouter());
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
