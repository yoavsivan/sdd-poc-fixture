import type express from "express";
import { loadConfig } from "../../src/config.ts";
import { openDb } from "../../src/db/open.ts";
import { migrate } from "../../src/db/migrate.ts";
import { ensureSeedUser } from "../../src/db/seed.ts";
import { createApp } from "../../src/http/app.ts";
import { MemoryStore } from "../../src/http/middleware/session.ts";
import { createLogger } from "../../src/logger.ts";

/** Shared test config: in-memory DB, non-default session secret, quiet logs. */
export function testConfig() {
  return loadConfig({
    NODE_ENV: "test",
    SESSION_SECRET: "test-session-secret-not-default",
    DATABASE_PATH: ":memory:",
    LOG_LEVEL: "error",
    PORT: "3000",
    COOKIE_SECURE: "false",
  });
}

/**
 * In-memory DB, migrated, seed user demo / demo-pass-1234, then createApp.
 * Returns the Express app only.
 */
export function makeTestApp(): express.Express {
  const db = openDb(":memory:");
  migrate(db);
  ensureSeedUser(db, { username: "demo", password: "demo-pass-1234" });
  return createApp({
    db,
    config: testConfig(),
    store: new MemoryStore({ sweepIntervalMs: 0 }),
    logger: createLogger("error"),
  });
}
