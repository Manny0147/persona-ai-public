import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { env } from "../config/env.js";
import { SCHEMA_SQL } from "./schema.js";
import { logger } from "../utils/logger.js";

let db: Database.Database | null = null;

function ensureColumns(database: Database.Database) {
  const cols = database
    .prepare(`PRAGMA table_info(person_model)`)
    .all() as Array<{ name: string }>;
  const names = new Set(cols.map((c) => c.name));

  const addIfMissing: Array<[string, string]> = [
    ["voice_json", "TEXT NOT NULL DEFAULT '{}'"],
    ["interests_json", "TEXT NOT NULL DEFAULT '[]'"],
    ["behavior_json", "TEXT NOT NULL DEFAULT '{}'"],
    ["audience_json", "TEXT NOT NULL DEFAULT '[]'"],
    ["performance_tiers_json", "TEXT NOT NULL DEFAULT '{}'"],
  ];

  for (const [col, def] of addIfMissing) {
    if (!names.has(col)) {
      database.exec(`ALTER TABLE person_model ADD COLUMN ${col} ${def}`);
      logger.info(`Migrated person_model: added ${col}`);
    }
  }

  const draftCols = database
    .prepare(`PRAGMA table_info(drafts)`)
    .all() as Array<{ name: string }>;
  const draftNames = new Set(draftCols.map((c) => c.name));
  if (!draftNames.has("opportunity_id")) {
    database.exec(`ALTER TABLE drafts ADD COLUMN opportunity_id TEXT`);
  }
  if (!draftNames.has("scheduled_for")) {
    database.exec(`ALTER TABLE drafts ADD COLUMN scheduled_for TEXT`);
  }
}

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = env.DATABASE_PATH;
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  ensureColumns(db);

  const row = db.prepare("SELECT id FROM person_model WHERE id = 1").get();
  if (!row) {
    db.prepare(
      `INSERT INTO person_model (id, traits_json, preferences_json, voice_style, goals_json)
       VALUES (1, '{}', '{}', 'clear, professional, human', '[]')`
    ).run();
  }

  logger.info(`Database ready at ${dbPath}`);
  return db;
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
