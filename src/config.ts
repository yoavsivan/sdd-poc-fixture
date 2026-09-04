export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Config {
  port: number;
  databasePath: string;
  sessionSecret: string;
  cookieSecure: boolean;
  seedUser?: string;
  seedPassword?: string;
  seedItems: boolean;
  logLevel: LogLevel;
  nodeEnv: string;
}

const DEFAULT_SESSION_SECRET = "dev-only-secret-change-me";
const LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];
let warnedDefaultSecret = false;

function readString(env: NodeJS.ProcessEnv, key: string, fallback: string): string {
  const raw = env[key];
  if (raw == null || raw.trim() === "") return fallback;
  return raw;
}

function readBool(env: NodeJS.ProcessEnv, key: string, fallback: boolean): boolean {
  const raw = env[key];
  if (raw == null || raw.trim() === "") return fallback;
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return fallback;
}

function readPort(env: NodeJS.ProcessEnv): number {
  const raw = env.PORT;
  if (raw == null || raw.trim() === "") return 3000;
  const n = Number.parseInt(raw, 10);
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`PORT must be an integer 1–65535, got ${raw}`);
  }
  return n;
}

function readLogLevel(env: NodeJS.ProcessEnv): LogLevel {
  const raw = (env.LOG_LEVEL || "info").trim().toLowerCase();
  if ((LEVELS as string[]).includes(raw)) return raw as LogLevel;
  return "info";
}

/**
 * Read process environment into a typed Config.
 * Warns once on stderr when SESSION_SECRET is still the built-in default.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const sessionSecret = readString(env, "SESSION_SECRET", DEFAULT_SESSION_SECRET);
  if (sessionSecret === DEFAULT_SESSION_SECRET && !warnedDefaultSecret) {
    warnedDefaultSecret = true;
    console.warn(
      "[shelfmark] SESSION_SECRET is the built-in default; do not share this process.",
    );
  }
  const seedUserRaw = env.SEED_USER;
  const seedPasswordRaw = env.SEED_PASSWORD;
  const seedUser =
    seedUserRaw && seedUserRaw.trim() !== "" ? seedUserRaw.trim() : undefined;
  const seedPassword =
    seedPasswordRaw && seedPasswordRaw !== "" ? seedPasswordRaw : undefined;
  return {
    port: readPort(env),
    databasePath: readString(env, "DATABASE_PATH", "./data/shelfmark.db"),
    sessionSecret,
    cookieSecure: readBool(env, "COOKIE_SECURE", false),
    seedUser,
    seedPassword,
    seedItems: readBool(env, "SEED_ITEMS", false),
    logLevel: readLogLevel(env),
    nodeEnv: readString(env, "NODE_ENV", "development"),
  };
}
