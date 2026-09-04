import type { RequestHandler } from "express";
import type { LogLevel } from "./config.js";

export interface Logger {
  debug(msg: string, extra?: Record<string, unknown>): void;
  info(msg: string, extra?: Record<string, unknown>): void;
  warn(msg: string, extra?: Record<string, unknown>): void;
  error(msg: string, extra?: Record<string, unknown>): void;
}

const RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function formatExtra(extra?: Record<string, unknown>): string {
  if (!extra || Object.keys(extra).length === 0) return "";
  try {
    return " " + JSON.stringify(extra);
  } catch {
    return "";
  }
}

function write(level: LogLevel, msg: string, extra?: Record<string, unknown>): void {
  const line = `[${level}] ${msg}${formatExtra(extra)}`;
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

/**
 * Console logger that drops records below the configured level.
 */
export function createLogger(level: LogLevel): Logger {
  const min = RANK[level] ?? RANK.info;
  const emit = (at: LogLevel, msg: string, extra?: Record<string, unknown>) => {
    if (RANK[at] < min) return;
    write(at, msg, extra);
  };
  return {
    debug: (msg, extra) => emit("debug", msg, extra),
    info: (msg, extra) => emit("info", msg, extra),
    warn: (msg, extra) => emit("warn", msg, extra),
    error: (msg, extra) => emit("error", msg, extra),
  };
}

/**
 * Log method, path, and status when the response finishes.
 */
export function requestLog(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const started = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - started;
      const path = req.originalUrl || req.url;
      logger.info(`${req.method} ${path} ${res.statusCode} ${ms}ms`);
    });
    next();
  };
}
