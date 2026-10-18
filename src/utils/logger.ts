import { env } from "../config/env.js";

type Level = "debug" | "info" | "warn" | "error";

const levels: Record<Level, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const current = levels[env.LOG_LEVEL] ?? 1;

function log(level: Level, message: string, meta?: unknown) {
  if (levels[level] < current) return;
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}]`;
  if (meta !== undefined) {
    console[level === "debug" ? "log" : level](prefix, message, meta);
  } else {
    console[level === "debug" ? "log" : level](prefix, message);
  }
}

export const logger = {
  debug: (msg: string, meta?: unknown) => log("debug", msg, meta),
  info: (msg: string, meta?: unknown) => log("info", msg, meta),
  warn: (msg: string, meta?: unknown) => log("warn", msg, meta),
  error: (msg: string, meta?: unknown) => log("error", msg, meta),
};
