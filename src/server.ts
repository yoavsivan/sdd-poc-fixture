import { loadConfig } from "./config.js";
import { createLogger } from "./logger.js";
import { openDb } from "./db/open.js";
import { migrate } from "./db/migrate.js";
import { ensureSampleItems, ensureSeedUser } from "./db/seed.js";
import { findByUsername } from "./users/repo.js";
import { createApp } from "./http/app.js";

/**
 * Process entry: config → database → seed → listen.
 */
export function main(): void {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const db = openDb(config.databasePath);
  const result = migrate(db);
  logger.info("migrations complete", {
    applied: result.applied,
    skipped: result.skipped,
  });
  if (config.seedUser && config.seedPassword) {
    const seeded = ensureSeedUser(db, {
      username: config.seedUser,
      password: config.seedPassword,
    });
    logger.info("seed user", { username: config.seedUser, created: seeded.created });
    if (config.seedItems) {
      const user = findByUsername(db, config.seedUser);
      if (user) {
        const n = ensureSampleItems(db, user.id);
        logger.info("seed items", { inserted: n });
      }
    }
  }
  const app = createApp({ db, config, logger });
  app.listen(config.port, () => {
    logger.info(`listening on :${config.port}`, {
      port: config.port,
      database: config.databasePath,
    });
  });
}

main();
