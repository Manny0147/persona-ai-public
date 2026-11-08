import postgres from "postgres";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

let sql: ReturnType<typeof postgres> | null = null;

export async function getDb() {
  if (sql) return sql;

  sql = postgres(env.DATABASE_URL, {
    ssl: "require",
    max: 1,
  });

  logger.info("Neon Postgres connection ready");
  return sql;
}

export async function closeDb() {
  if (sql) {
    await sql.end();
    sql = null;
  }
}
